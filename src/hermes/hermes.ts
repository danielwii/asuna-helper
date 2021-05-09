import BullQueue from 'bull';
import { validate } from 'class-validator';
import _ from 'lodash';
import ow from 'ow';
import { defer, Observable, of, Subject, throwError, from } from 'rxjs';
import { concatAll, map } from 'rxjs/operators';

import { AppEnv } from '../app.env';
import { ConfigKeys } from '../config';
import { LoggerFactory } from '../logger';
import { RedisConfigObject } from '../providers/redis/config';
import { random } from '../random';
import { r } from '../serializer';

import type { IAsunaAction, IAsunaCommand, IAsunaEvent, IAsunaJob, IAsunaObserver, IAsunaRule } from './interfaces';

const logger = LoggerFactory.getLogger('Hermes');

export const AsunaSystemQueue = {
  UPLOAD: 'UPLOAD',
  IN_MEMORY_UPLOAD: 'IN_MEMORY_UPLOAD',
  IN_MEMORY_JOB: 'IN_MEMORY_JOB',
};

export class AsunaEvent<User> implements IAsunaEvent {
  payload: any;
  source: string;
  name: string;
  type: string;
  createdAt: any;
  createdBy: any;
  rules: IAsunaRule[] = [];
  identifier: any;

  constructor(opts: { payload: any; source: string; name: string; type?: any; user?: User; identifier?: any }) {
    this.payload = opts.payload;
    this.source = opts.source;
    this.name = opts.name;
    this.type = opts.type;
    this.createdBy = opts.user;
    this.createdAt = Date.now();
    this.identifier = opts.identifier;
  }
}

export interface AsunaQueue {
  name: string;
  opts?: BullQueue.QueueOptions;
  queue: BullQueue.Queue;
  handle?: (payload: any) => Promise<any>;
}

export interface EventRuleResolver {
  identifier: { version: 'default/v1alpha'; type: 'EventRule' };
  resolve: (event: IAsunaEvent) => IAsunaAction[];
}

export interface CommandResolver<User> {
  identifier: { version: 'default/v1alpha'; type: 'Command' };
  resolve: (command: IAsunaCommand<User>) => IAsunaEvent[];
}

export class HermesExchange {
  private static _commands: IAsunaCommand<any>[];

  private static _resolvers: { [key: string]: CommandResolver<any> } = {};

  private static _eventRules: { [key: string]: EventRuleResolver } = {};

  static get resolvers() {
    return HermesExchange._resolvers;
  }

  static regCommandResolver(key: string, commandResolver: CommandResolver<any>) {
    this._resolvers[key] = commandResolver;
  }

  static regEventRule(key: string, eventRuleResolver: EventRuleResolver) {
    this._eventRules[key] = eventRuleResolver;
  }
}

export class Hermes {
  private static subject = new Subject<IAsunaEvent>();
  private static observers: IAsunaObserver[];
  private static initialized: boolean;
  private static instance: Hermes;
  private static queues: { [key: string]: AsunaQueue };
  private static inMemoryQueues: { [key: string]: InMemoryAsunaQueue };

  // constructor() {}

  public static async initialize(): Promise<void> {
    if (Hermes.initialized) {
      return;
    }

    Hermes.instance = new Hermes();

    logger.log('init ...');
    Hermes.observers = [];
    Hermes.queues = {};
    Hermes.inMemoryQueues = {};

    Hermes.subject.subscribe(
      (event: IAsunaEvent) => {
        Hermes.observers.forEach((observer) => {
          if (observer.routePattern !== 'fanout' && !observer.routePattern.test(event.name)) {
            return;
          }
          observer.next?.(event);
        });
      },
      (error) => logger.error(`error occurred: ${error}`, error.trace),
      () => logger.log('Hermes completed'),
    );

    const configObject = RedisConfigObject.loadOr('job');
    logger.log(`init queues with redis: ${r(configObject, { transform: true })}`);
    if (configObject.enable) {
      const db = AppEnv.configLoader.loadNumericConfig(ConfigKeys.JOB_REDIS_DB, 1) as number;
      logger.log(`init job with redis db: ${db}`);
      // redis.ClientOpts have to convert to ioredis.RedisOptions
      Hermes.regQueue(AsunaSystemQueue.UPLOAD, { redis: configObject.getOptions(db) as any });

      logger.log('sync status with redis.');
    }

    Hermes.regInMemoryQueue(AsunaSystemQueue.IN_MEMORY_UPLOAD);
  }

  static emitEvents(source: string, events: IAsunaEvent[]) {
    logger.log(`emit events from [${source}]: ${r(events)}`);
    if (events && events.length > 0) {
      events.forEach(async (event) => {
        const errors = await validate(event);
        if (errors && errors.length > 0) {
          return logger.warn(`validate error. event: ${r(event)}, errors: ${r(errors)}`);
        }
        return event && this.subject.next(event);
      });
    }
  }

  static emit<Payload = any, User = any>(
    source: string,
    event: string,
    payload: Payload,
    extras: { identifier?: any; user?: User; type?: string } = {},
  ) {
    logger.log(`emit events from [${source}: ${event}]`);
    this.subject.next(
      new AsunaEvent({
        name: event,
        payload,
        source,
        user: extras.user,
        type: extras.type,
        identifier: extras.identifier,
      }),
    );
  }

  static regInMemoryQueue(queueName: string): InMemoryAsunaQueue {
    ow(queueName, 'queueName', ow.string.nonEmpty);

    if (Hermes.inMemoryQueues[queueName]) {
      return Hermes.inMemoryQueues[queueName];
    }

    logger.log(`reg in-memory queue: ${queueName}`);
    const subject = new Subject();
    subject
      .pipe(
        map<{ jobId: string; data: any }, any>(({ jobId, data }) => {
          logger.log(`job(${jobId}) call func in map ... data: ${r(data)}`);
          const inMemoryQueue = Hermes.getInMemoryQueue(queueName);
          const status = inMemoryQueue.status[jobId];
          if (typeof inMemoryQueue.handle !== 'function') {
            const message = `no handler registered for ${queueName}`;
            logger.error(message);
            status.state = 'UN_READY';
            status.events.push({ state: 'UN_READY', at: new Date().toUTCString(), message });
            return of({ jobId, data, result: { error: message } });
          }

          return defer(() => {
            logger.log(`job(${jobId}) call func in defer ...`);
            status.state = 'RUNNING';
            status.events.push({ state: 'RUNNING', at: new Date().toUTCString() });
            // execute the function and then examine the returned value.
            // if the returned value is *not* an Rx.Observable, then
            // wrap it using Observable.return
            const result = inMemoryQueue.handle!(data);
            const isPromise = typeof result.then === 'function';
            logger.log(`job(${jobId}) call func in defer ... result is ${r(result)} ${typeof result}`);
            if (isPromise) {
              return from<any>(result.then((value) => ({ result: value, jobId, data })));
            }
            return result instanceof Observable ? of({ jobId, data, result }) : of(result);
          });
        }) as any,
        concatAll(),
      )
      .subscribe(
        ({ jobId, data, result }: any) => {
          logger.log(`job(${jobId}) queue(${queueName}) run ${r(data)} with result ${r(result)}`);

          const status = this.getInMemoryQueue(queueName).status[jobId];
          if (result.error) {
            return throwError({ jobId, data, result });
          }

          if (status) {
            status.state = 'DONE';
            status.events.push({ state: 'DONE', at: new Date().toUTCString() });
          } else {
            logger.warn(`no status found in queue ${r({ queueName, jobId })}`);
          }
        },
        (error) => {
          const { jobId, data } = error;
          logger.warn(`job(${jobId}) error occurred in ${queueName}: ${r(error)}`);
          if (jobId && this.getInMemoryQueue(queueName).status[jobId]) {
            const status = this.getInMemoryQueue(queueName).status[jobId];
            if (status) {
              status.state = 'ERROR';
              status.events.push({ state: 'ERROR', at: new Date().toUTCString(), message: data });
            }
          }
        },
      );

    const status = {};
    this.inMemoryQueues[queueName] = {
      name: queueName,
      queue: subject,
      status,
      next(data) {
        const jobId = random(6);
        _.set(this.status as any, jobId, {
          state: 'PENDING',
          events: [{ state: 'PENDING', at: new Date().toUTCString() }],
        });
        // this.status[jobId] = { state: 'PENDING', events: [{ state: 'PENDING', at: new Date().toUTCString() }] };
        logger.log(`job(${jobId}) pending ... ${r({ data, status: this.status[jobId] })}`);
        subject.next({ jobId, data });
        return { jobId };
      },
    };
    return this.getInMemoryQueue(queueName);
  }

  static getInMemoryQueue(queueName: string): InMemoryAsunaQueue {
    return this.inMemoryQueues[queueName];
  }

  static regQueue(queueName: string, opts?: BullQueue.QueueOptions): AsunaQueue {
    ow(queueName, 'queueName', ow.string.nonEmpty);

    if (this.queues[queueName]) {
      return this.queues[queueName];
    }

    const queue = new BullQueue(queueName, opts);
    queue.process((job: BullQueue.Job, done) => {
      logger.log(`queue(${queueName}) run job ${job.name} with ${r(job.data)}`);
      return this.getQueue(queueName).handle
        ? this.getQueue(queueName).handle?.(job)
        : done(new Error(`no processor registered for ${queueName}`));
    });
    this.queues[queueName] = { name: queueName, opts, queue };
    return this.getQueue(queueName);
  }

  static getQueue(queueName: string): AsunaQueue {
    return this.queues[queueName];
  }

  /**
   * return index
   * @param queueName
   * @param handle
   */
  static setupJobProcessor(queueName: string, handle: (payload: any) => Promise<any>): void {
    ow(queueName, 'queueName', ow.string.nonEmpty);

    const queue = queueName.startsWith('IN_MEMORY_') ? this.getInMemoryQueue(queueName) : this.getQueue(queueName);
    if (!queue) {
      logger.error(`queue(${queueName}) not found`);
      return;
    }
    queue.handle = handle;
  }

  static subscribe(source: string, routePattern: 'fanout' | RegExp, next?: (event: IAsunaEvent) => void): void {
    logger.log(`subscribe from [${source}] ... total: ${this.observers.length + 1}`);
    this.observers.push({ source, routePattern, next });
    // this.subject.subscribe(observer);
  }
}

export class HermesProcessManager {
  static initialized: boolean;

  static queue: InMemoryAsunaQueue;

  static start() {
    if (!this.initialized) {
      this.initialized = true;

      logger.log('initialize process manager');
      this.queue = Hermes.regInMemoryQueue(AsunaSystemQueue.IN_MEMORY_JOB);
      Hermes.setupJobProcessor(AsunaSystemQueue.IN_MEMORY_JOB, (job: IAsunaJob) => {
        logger.log(`jobProcessor job: ${r(job)}`);
        if (!job) {
          throw new Error(`no job received in processor at queue: ${AsunaSystemQueue.IN_MEMORY_JOB}`);
        }
        return job.process(job.payload);
      });
    }
  }

  static handleCommand(command: IAsunaCommand<any>) {
    _.forEach(HermesExchange.resolvers, (resolver: CommandResolver<any>) => {
      logger.log(`check command ${r(command)} with resolver: ${r(resolver.identifier)}`);
      if (_.isMatch(command, resolver.identifier)) {
        logger.log(`matched command with identifier ${r(resolver.identifier)}`);
        const events = resolver.resolve(command);
        if (!events) {
          logger.warn(`no events parsed from command: ${r(command)}`);
          return;
        }
        events.forEach((event) => {
          logger.log(`handle event: ${r(event)}`);
          this.dispatch(event);
        });
        // eslint-disable-next-line no-param-reassign
        command.events = events;
      }
    });
  }

  static dispatch(event: IAsunaEvent) {
    if (event.rules && event.rules.length > 0) {
      event.rules.forEach((rule) => {
        logger.log(`handle rule ${r(rule)}`);
        if (rule.actions && rule.actions.length > 0) {
          rule.actions.forEach((action) => {
            logger.log(`add jobs to queue in action: ${r(action)}`);
            if (action.jobs && action.jobs.length > 0) {
              action.jobs.forEach((job) => {
                logger.log(`send ${r(job)} to queue ${this.queue.name}`);
                // this.queue.queue.next(job);
                // eslint-disable-next-line no-param-reassign
                job.state = 'OPEN';
                const { jobId } = this.queue.next(job);
                // eslint-disable-next-line no-param-reassign
                job.id = jobId;
              });
            }
          });
        }
      });
    }
  }
}

export class AsunaDefaultEvent implements IAsunaEvent {
  createdAt: any;
  createdBy: any;
  name: string;
  payload: any;
  rules: IAsunaRule[];
  source: string;
  type: string;
  constructor(name: string, source: string, type: string, data: any, process: (data: any) => Promise<any>) {
    this.name = name;
    this.rules = [
      new (class implements IAsunaRule {
        actions: IAsunaAction[];
        createdAt: any;
        createdBy: any;
        name?: string;
        payload: any;
        source?: string;
        type?: string;
        constructor() {
          this.actions = [
            new (class implements IAsunaAction {
              createdAt: any;
              createdBy: any;
              jobs: IAsunaJob[];
              name?: string;
              payload: any;
              source?: string;
              type?: string;
              constructor() {
                this.jobs = [
                  new (class implements IAsunaJob {
                    createdAt: any;
                    createdBy: any;
                    name?: string;
                    payload: any;
                    source?: string;
                    type?: string;
                    process: (data: any) => Promise<any>;
                    constructor() {
                      this.payload = data;
                      this.process = process;
                    }
                  })(),
                ];
              }
            })(),
          ];
        }
      })(),
    ];
    this.source = source;
    this.type = type;
  }
}

export interface InMemoryAsunaQueue {
  name: string;
  queue: Subject<any>;
  next: (data: any) => { jobId: string };
  handle?: (payload: any) => Promise<any>;
  status: { [jobId: string]: { state: string; events: any[] } };
}
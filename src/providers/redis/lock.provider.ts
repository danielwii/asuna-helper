import { Logger } from '@nestjs/common';

import { fileURLToPath } from 'node:url';

import Redis from 'ioredis';
import _ from 'lodash';
import RedLock, { Lock } from 'redlock';

import { AppEnv } from '../../app.env';
import { resolveModule } from '../../logger/factory';
import { waitUtil } from '../../promise';
import { LifecycleRegister } from '../../register';
import { r } from '../../serializer';
import { RedisConfigKeys, RedisConfigObject } from './config';

export class RedisLockProvider {
  private readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), RedisLockProvider.name));
  public readonly client?: Redis;
  public readonly redLock?: RedLock;

  public static locks: Record<string, Lock> = {};
  public static instance: RedisLockProvider;

  constructor() {
    const redisConfig = RedisConfigObject.loadOr('lock');
    this.logger.log(`init redis for redlock ${r(redisConfig, { transform: true })}`);
    if (redisConfig.enable) {
      this.client = new Redis(redisConfig.getIoOptions());
      this.client.on('error', (reason) => {
        this.logger.error(`ioredis connection error ${r(reason)}`);
      });
      if (!this.redLock && this.client) {
        this.logger.log(`init redlock ...`);
        this.redLock = new RedLock(
          // you should have one client for each independent redis node or cluster
          [this.client],
          {
            // the expected clock drift; for more details
            // see http://redis.io/topics/distlock
            driftFactor: 0.01, // time in ms

            // the max number of times Redlock will attempt
            // to lock a resource before erroring
            retryCount: 10,

            // the time in ms between attempts
            retryDelay: 200, // time in ms

            // the max time in ms randomly added to retries
            // to improve performance under high contention
            // see https://www.awsarchitectureblog.com/2015/03/backoff.html
            retryJitter: 200, // time in ms
          },
        );
        this.redLock.on('clientError', (err) => this.logger.error('A redis error has occurred:', err));
      }

      LifecycleRegister.regExitProcessor('RedisLock', async () => {
        this.logger.log(`signal: SIGINT. Release locks ${r(_.keys(RedisLockProvider.locks))}`);
        await Promise.all(
          _.map(RedisLockProvider.locks, (lock, resource) =>
            lock
              .release()
              .catch((err) => this.logger.error(`unlock [${resource}] error: ${err}`))
              .finally(() => this.logger.verbose(`unlock [${resource}]`)),
          ),
        );
        this.logger.log(`signal: SIGINT. Remove all listeners.`);
        return this.redLock?.removeAllListeners();
      });

      process.on('beforeExit', () => {
        this.logger.log(`beforeExit ...`);
        this.redLock?.removeAllListeners();
      });
    } else {
      this.logger.log(`skip setup redis, REDIS_ENABLE is ${redisConfig.enable}`);
    }
  }

  public static async init(): Promise<void> {
    if (!this.instance) this.instance = new RedisLockProvider();
  }

  isEnabled = (): boolean | null => AppEnv.configLoader.loadBoolConfig(RedisConfigKeys.REDIS_ENABLE);

  async checkLock(resource: string): Promise<string | null> {
    return this.client!.get(resource);
  }

  async lockProcess<T>(
    // the string identifier for the resource you want to lock
    operation: string,
    handler: () => Promise<T>,
    options: {
      // the maximum amount of time you want the resource locked in milliseconds,
      // keeping in mind that you can extend the lock up until
      // the point when it expires
      ttl: number;
      // waiting for lock released
      waiting?: boolean;
    },
  ): Promise<{ exists: boolean; results: T | undefined | void }> {
    if (!this.redLock) {
      throw new Error(`can not get redLock instance, REDIS_ENABLE: ${this.isEnabled()}`);
    }

    const ttl = options ? options.ttl : 1000;
    const resource = `lock:${operation}`;

    // const exists = this.client.get
    const exists = await this.checkLock(resource);
    if (exists) {
      this.logger.verbose(`lock [${resource}] already exists: ${exists}`);

      if (options.waiting) {
        const exists = await waitUtil(() => this.checkLock(resource));
        return { exists: !!exists, results: undefined };
      }

      return { exists: true, results: undefined };
    }

    // eslint-disable-next-line consistent-return
    return this.redLock.acquire([resource], ttl).then(
      async (lock) => {
        RedisLockProvider.locks[resource] = lock;
        this.logger.verbose(
          `lock [${resource}]: ${r(_.omit(lock, 'redlock', 'unlock', 'extend', 'attempts'))} ttl: ${ttl}ms`,
        );
        const results = await handler()
          .then((value) => {
            this.logger.verbose(`release lock [${resource}], result is ${r(value)}`);
            return value;
          })
          .catch((reason) =>
            this.logger.error(`execute [${resource}] handler: ${handler} error: ${reason} ${r(options)}`),
          )
          .finally(() =>
            lock
              .release()
              .catch((err) => {
                this.logger.error(`unlock [${resource}] error: ${err} ${r(options)}`);
              })
              .finally(() => this.logger.verbose(`unlock [${resource}]`)),
          );
        delete RedisLockProvider.locks[resource];
        return { exists: false, results };
      },
      (reason) => {
        // TODO lock error handler needed
        this.logger.error(`get [${resource}] lock error: ${reason}`);
        return { exists: false, results: undefined };
      },
    );
  }
}

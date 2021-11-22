// target es5 for ie11 support
import * as Bluebird from 'bluebird';
import { Expose, plainToInstance, Transform } from 'class-transformer';
import { ClientOpts, createClient, RedisClient } from 'redis';

import { LoggerFactory } from '../../logger';
import { LifecycleRegister } from '../../register';
import { r } from '../../serializer';
import { RedisConfigObject } from './config';

const logger = LoggerFactory.getLogger('RedisProvider');

export class RedisClientObject {
  @Expose({ name: 'created-client', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public client: RedisClient | undefined;

  public isEnabled: boolean | undefined;
  public isHealthy: boolean | undefined;
  public redisOptions: ClientOpts | undefined;
}

export class RedisProvider {
  public clients: { [key: string]: RedisClientObject } = {};

  public static instance: RedisProvider;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static async init(): Promise<void> {
    if (!this.instance) this.instance = new RedisProvider();
  }

  public getRedisClient(prefix = 'default', db = 0): RedisClientObject {
    const key = `${prefix}-${db}`;
    if (this.clients[key] /* && this.clients[key].isHealthy */) {
      return this.clients[key];
    }

    const configObject = RedisConfigObject.loadOr(prefix);
    const redisOptions = configObject.getOptions(db);
    logger.log(
      `init redis provider: ${r({ configObject, redisOptions }, { transform: true })} with ${r({ prefix, db })}`,
    );
    const redisClientObject = plainToInstance(
      RedisClientObject,
      { client: undefined, isHealthy: false, isEnabled: configObject.enable, redisOptions },
      { enableImplicitConversion: true },
    );

    this.clients[key] = redisClientObject;

    if (!configObject.enable) {
      return redisClientObject;
    }

    const client = createClient(redisOptions);
    redisClientObject.client = client;
    client.on('connect', () => {
      redisClientObject.isHealthy = true;
      logger.log(`Redis ${key} connection open to ${r({ redisClientObject, prefix, key }, { transform: true })}`);
    });

    client.on('error', (err) => {
      redisClientObject.isHealthy = false;
      logger.error(`Redis ${key} connection error ${r(err)}`);
    });

    LifecycleRegister.regExitProcessor(
      `Redis(${key})`,
      async () =>
        new Bluebird.Promise((resolve) => {
          client.quit((err, reply) => {
            redisClientObject.isHealthy = false;
            logger.log(`signal: SIGINT. Redis ${key} connection disconnected ${r({ err, reply })}`);
            resolve();
          });
        }),
    );

    process.on('beforeExit', () =>
      client.quit((err, reply) => {
        redisClientObject.isHealthy = false;
        logger.log(`beforeExit. Redis ${key} connection disconnected ${r({ err, reply })}`);
      }),
    );

    /*
    process.on('removeListener', () => {
      client.quit((err: Error, res: string) => {
        redisClientObject.isHealthy = false;
        logger.log(`removeListener. Redis default connection disconnected ${r({ err, res })}`);
      });
    });
*/

    return redisClientObject;
  }
}

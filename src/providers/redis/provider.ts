import { Expose, plainToInstance, Transform } from 'class-transformer';
import consola from 'consola';
import * as Redis from 'redis';

import { LoggerFactory } from '../../logger';
import { LifecycleRegister } from '../../register';
import { r } from '../../serializer';
import { RedisConfigObject } from './config';

import type { RedisOptions } from 'ioredis';

const logger = LoggerFactory.getLogger('RedisProvider');

export class RedisClientObject {
  @Expose({ name: 'created-client', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public client: Redis.RedisClientType | undefined;

  public isEnabled: boolean | undefined;
  // public isHealthy: boolean | undefined;
  public redisOptions: RedisOptions | undefined;
  public redisOptionsV4: Redis.RedisClientOptions | undefined;

  public get isOpen(): boolean {
    return !!(this.isEnabled && this.client?.isOpen);
  }
}

export class RedisProvider {
  public static clients: { [key: string]: RedisClientObject } = {};

  // public static instance: RedisProvider;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // private constructor() {}

  /*
  public static async init(): Promise<void> {
    if (!this.instance) this.instance = new RedisProvider();
  }
*/

  public static getRedisClient(prefix = 'default', db = 0, legacyMode = false): RedisClientObject {
    const key = `${prefix}-${db}`;
    if (this.clients[key] /* && this.clients[key].isHealthy */) {
      return this.clients[key];
    }

    const configObject = RedisConfigObject.loadOr(prefix);
    const redisOptionsV4 = configObject.getOptionsV4(db);
    redisOptionsV4.legacyMode = legacyMode;
    logger.log(
      `init redis provider: ${r({ configObject, redisOptionsV4 }, { transform: true })} with ${r({ prefix, db })}`,
    );
    const redisClientObject = plainToInstance(
      RedisClientObject,
      { client: undefined, isEnabled: configObject.enable, redisOptionsV4, redisOptions: configObject.getOptions(db) },
      { enableImplicitConversion: true },
    );

    this.clients[key] = redisClientObject;

    if (!configObject.enable) {
      return redisClientObject;
    }

    const client = Redis.createClient(redisOptionsV4);
    redisClientObject.client = client as any;
    client.on('connect', () => {
      // redisClientObject.isHealthy = true;
      logger.log(`Redis ${key} connection open to ${r({ prefix, key }, { transform: true })}`);
    });

    client.on('error', (err) => {
      // redisClientObject.isHealthy = false;
      logger.error(`Redis ${key} to ${r({ prefix, redisClientObject })} connection error ${r(err)}`);
    });

    LifecycleRegister.regExitProcessor(`Redis(${key})`, async () => {
      await client.quit();
      // redisClientObject.isHealthy = false;
      logger.log(`signal: SIGINT. Redis ${key} connection disconnected.`);
    });

    process.on('beforeExit', async () => {
      await client.quit();
      // redisClientObject.isHealthy = false;
      logger.log(`beforeExit. Redis ${key} connection disconnected`);
    });

    /*
    process.on('removeListener', () => {
      client.quit((err: Error, res: string) => {
        redisClientObject.isHealthy = false;
        logger.log(`removeListener. Redis default connection disconnected ${r({ err, res })}`);
      });
    });
*/

    logger.debug(`connect to redis ${r({ prefix, db, legacyMode, host: configObject.host })}`);
    client.connect().catch((reason) => {
      logger.error(`connect to redis error: ${r({ prefix, key, configObject, reason })}`);
      consola.error(reason);
      process.exit(1);
    });

    return redisClientObject;
  }
}

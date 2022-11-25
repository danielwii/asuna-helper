import { Logger } from '@nestjs/common';

import { Expose, plainToInstance, Transform } from 'class-transformer';
import consola from 'consola';
import * as Redis from 'redis';

import { resolveModule } from '../../logger/factory';
import { LifecycleRegister } from '../../register';
import { r } from '../../serializer';
import { RedisConfigObject } from './config';

import type { RedisOptions } from 'ioredis';

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
  private static readonly logger = new Logger(resolveModule(__filename, RedisProvider.name));
  public static clients: { [key: string]: RedisClientObject } = {};

  // public static instance: RedisProvider;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // private constructor() {}

  /*
  public static async init(): Promise<void> {
    if (!this.instance) this.instance = new RedisProvider();
  }
*/

  public static getRedisClient(prefix = 'default', db = 0, legacyMode = false): RedisClientObject | undefined {
    const key = `${prefix}-${db}`;
    if (this.clients[key] /* && this.clients[key].isHealthy */) {
      return this.clients[key];
    }

    const configObject = RedisConfigObject.loadOr(prefix);
    const redisOptionsV4 = configObject.getOptionsV4(db);
    redisOptionsV4.legacyMode = legacyMode;
    RedisProvider.logger.log(
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
      RedisProvider.logger.log(`Redis ${key} connection open to ${r({ prefix, key }, { transform: true })}`);
    });

    client.on('error', (err) => {
      // redisClientObject.isHealthy = false;
      RedisProvider.logger.error(`Redis ${key} to ${r({ prefix, configObject })} connection error ${r(err)}`);
    });

    LifecycleRegister.regExitProcessor(`Redis(${key})`, async () => {
      await client.quit();
      // redisClientObject.isHealthy = false;
      RedisProvider.logger.log(`signal: SIGINT. Redis ${key} connection disconnected.`);
    });

    process.on('beforeExit', async () => {
      await client.quit();
      // redisClientObject.isHealthy = false;
      RedisProvider.logger.log(`beforeExit. Redis ${key} connection disconnected`);
    });

    /*
    process.on('removeListener', () => {
      client.quit((err: Error, res: string) => {
        redisClientObject.isHealthy = false;
        RedisProvider.logger.log(`removeListener. Redis default connection disconnected ${r({ err, res })}`);
      });
    });
*/

    RedisProvider.logger.debug(`connect to redis ${r({ prefix, db, legacyMode, host: configObject.host })}`);
    client.connect().catch((reason) => {
      RedisProvider.logger.error(`connect to redis error: ${r({ prefix, key, configObject, reason })}`);
      consola.error(reason);
      process.exit(1);
    });

    return redisClientObject;
  }
}

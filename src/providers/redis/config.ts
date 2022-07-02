import { Logger } from '@nestjs/common';

import { Expose, plainToInstance, Transform } from 'class-transformer';
import _ from 'lodash';
import * as Redis from 'redis';

import { AppEnv } from '../../app.env';
import { AbstractConfigLoader, YamlConfigKeys } from '../../config';
import { r } from '../../serializer';
import { withP, withP2 } from '../../utils';

import type { RedisOptions } from 'ioredis';

export const RedisConfigKeys = {
  REDIS_ENABLE: 'REDIS_ENABLE',
  REDIS_HOST: 'REDIS_HOST',
  REDIS_PORT: 'REDIS_PORT',
  REDIS_PASSWORD: 'REDIS_PASSWORD',
  REDIS_DB: 'REDIS_DB',
};

export enum RedisConfigKeys2 {
  enable = 'enable',
  host = 'host',
  port = 'port',
  password = 'password',
  db = 'db',
}

export class RedisConfigObject extends AbstractConfigLoader<RedisConfigObject> {
  private static key = YamlConfigKeys.redis;
  private static prefix = `${RedisConfigObject.key}_`;

  public host?: string;
  public port?: number;
  public db?: number;
  public enable?: boolean;

  @Expose({ name: 'with-password', toPlainOnly: true })
  @Transform(({ value }) => !!value, { toPlainOnly: true })
  public password?: string;

  public constructor(o: Partial<RedisConfigObject>) {
    super();
    Object.assign(this, plainToInstance(RedisConfigObject, o, { enableImplicitConversion: true }));
  }

  public static load(redisPrefix = ''): RedisConfigObject {
    const appendPrefix = `${this.prefix}${redisPrefix ? `${redisPrefix}_`.toUpperCase() : ''}`;
    Logger.verbose(`try load env: ${appendPrefix}${RedisConfigKeys2.enable}`);
    return withP2(
      (p: string): any => AppEnv.configLoader.loadConfig2(RedisConfigObject.key, p),
      RedisConfigKeys2,
      (loader, keys) =>
        new RedisConfigObject({
          enable: withP(keys.enable, loader),
          host: withP(keys.host, loader),
          port: withP(keys.port, loader),
          password: withP(keys.password, loader),
          db: withP(keys.db, loader),
        }),
    );
  }

  // using default configs when specific not found
  public static loadOr(prefix = ''): RedisConfigObject {
    const appendPrefix = (prefix.length > 0 ? `${prefix}_` : '').toUpperCase();
    const key = `${appendPrefix}${RedisConfigKeys.REDIS_ENABLE}`;
    const enable = AppEnv.configLoader.loadBoolConfig(key);
    // Logger.verbose(`try loadOr env: ${key} ${enable ? 'fallback to default' : ''}`);
    if (enable === true) {
      return RedisConfigObject.load(prefix);
    }
    // if (enable === false) {
    //   return null;
    // }
    return RedisConfigObject.load();
  }

  public get options(): RedisOptions {
    const retryStrategy = (options: any) => {
      Logger.log(`retryStrategy ${r(options)}`);
      if (options) {
        Logger.warn(`retry_strategy ${r({ db: this.db, host: this.host, port: this.port })} ${r(options)}`);
        if (options.error && options.error.code === 'ECONNREFUSED') {
          // End reconnecting on a specific error and flush all commands with
          // a individual error
          Logger.error(`The server refused the connection, wait for 10s.`);
          // return new Error('The server refused the connection');
          return 10_000;
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          // End reconnecting after a specific timeout and flush all commands
          // with a individual error
          Logger.error(`Retry time exhausted, wait for 10s.`);
          // return new Error('Retry time exhausted');
          return 10_000;
        }
        if (options.attempt > 10) {
          Logger.error(`Reach to 10 times, wait for 30s.`);
          // End reconnecting with built in error
          return 30_000;
        }
        // reconnect after
        const waitFor = Math.min(options.attempt * 100, 3000);
        Logger.error(`Reconnect after ${waitFor / 1000}s`);
        return waitFor;
      }
      Logger.verbose(`Connect in 3s...`);
      return 3_000;
    };
    return {
      host: this.host,
      port: this.port,
      ...(this.password ? { password: this.password } : {}),
      db: this.db,
      connectTimeout: 2e3,
      // connect_timeout: 10_000,
      // retry_strategy: retryStrategy,
      retryStrategy: (retries: number) => {
        if (_.isNumber(retries)) {
          if (retries > 10) {
            Logger.error('cannot connect to redis, exit.');
            process.exit(1);
          }
          const delay = Math.min((retries ?? 0) * 1000, 5_000);
          Logger.log(`retryStrategy ${r({ retries, delay })}`);
          return delay;
        }
        return retryStrategy(retries);
      },
    };
  }

  public getIoOptions(db?: number): RedisOptions {
    return { ...this.options, db: db ?? this.db };
  }

  public getOptions(db?: number): Redis.RedisClientOptions {
    return { ...(this.options as any), database: db ?? this.db };
  }

  public getOptionsV4(db?: number): Redis.RedisClientOptions {
    return {
      database: db,
      password: this.options.password,
      // redis[s]://[[username][:password]@][host][:port][/db-number]
      // url: `redis://${this.options.host}:${this.options.port}`,
      socket: {
        host: this.options.host,
        port: this.options.port,
        connectTimeout: 3e3,
        timeout: 6e3,
        reconnectStrategy: (retries) => {
          const delay = Math.min((retries ?? 1) * 1000, 5_000);
          Logger.log(`reconnectStrategy ${r({ retries, delay })}`);
          return delay;
        },
      },
    };
  }
}

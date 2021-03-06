import { ConfigLoader } from 'node-buffs';

import { deserializeSafely } from './validate';

/**
 * all fields need null as default value to load all keys
 */
export class AbstractConfigLoader<Config> {
  public constructor(o?: Omit<Config, 'fromConfigurator'>) {
    Object.assign(this, deserializeSafely(this.constructor as any, o));
  }

  public fromConfigurator(configLoader: ConfigLoader): Config {
    Object.keys(this).forEach((key) => {
      // @ts-ignore
      this[key] = configLoader.loadConfig(key, undefined, true);
      // logger.log(`load ${r({ key, value: this[key] })}`);
    });
    return this as any;
  }
}

export enum YamlConfigKeys {
  graphql = 'graphql',
  sentry = 'sentry',
  features = 'features',
  app = 'app',
  tracing = 'tracing',
  mq = 'mq',
  email = 'email',
  live = 'live',
  sms = 'sms',
  uploader = 'uploader',
  redis = 'redis',
  storage = 'storage',
}

export const ConfigKeys = {
  ADMIN_SECRET_KEY: 'ADMIN_SECRET_KEY',
  SECRET_KEY: 'SECRET_KEY',
  WX_SECRET_KEY: 'WX_SECRET_KEY',
  DEBUG: 'DEBUG',
  PORT: 'PORT',
  DB_TYPE: 'DB_TYPE',
  COOKIE_SUPPORT: 'COOKIE_SUPPORT',

  LOGGER_LEVEL: 'LOGGER_LEVEL',

  CHROMIUM_PATH: 'CHROMIUM_PATH',

  RATE_LIMIT_ENABLED: 'RATE_LIMIT_ENABLED',
  RATE_LIMIT: 'RATE_LIMIT',

  /**
   * 用于访问上传文件的资源地址
   */
  ASSETS_ENDPOINT: 'ASSETS_ENDPOINT',
  ASSETS_INTERNAL_ENDPOINT: 'ASSETS_INTERNAL_ENDPOINT',

  /**
   * @deprecated
   */
  VIDEOS_STORAGE: 'VIDEOS_STORAGE',
  /**
   * @deprecated
   */
  IMAGES_STORAGE: 'IMAGES_STORAGE',
  /**
   * @deprecated
   */
  FILES_STORAGE: 'FILES_STORAGE',
  /**
   * @deprecated
   */
  CHUNKS_STORAGE: 'CHUNKS_STORAGE',

  STORAGE_DEFAULT: 'STORAGE_DEFAULT',

  // WS_REDIS_HOST: 'WS_REDIS_HOST',
  // WS_REDIS_PORT: 'WS_REDIS_PORT',
  // WS_REDIS_PASSWORD: 'WS_REDIS_PASSWORD',
  WS_REDIS_ENABLE: 'WS_REDIS_ENABLE',
  WS_REDIS_DB: 'WS_REDIS_DB',

  JOB_REDIS_ENABLE: 'JOB_REDIS_ENABLE',
  JOB_REDIS_DB: 'JOB_REDIS_DB',

  // mongo
  MONGO_ENABLE: 'MONGO_ENABLE',

  OTP_SECRET: 'OTP_SECRET',
};

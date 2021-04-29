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

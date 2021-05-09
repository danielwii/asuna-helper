import { ConfigLoader } from 'node-buffs';

import { LoggerFactory } from './logger';
import { r } from './serializer';

const logger = LoggerFactory.getLogger('AppEnv');

export class AppEnv {
  public static readonly instance = new AppEnv();
  private static _configLoader: ConfigLoader;

  public static regConfigLoader(configLoader: ConfigLoader): void {
    AppEnv._configLoader = configLoader;
  }

  public static get configLoader(): ConfigLoader {
    return AppEnv._configLoader;
  }

  private state = {
    version: process.env.npm_package_version,
    upTime: new Date(),
  };

  private constructor() {
    logger.log(`initialized. ${r(this.state)}`);
  }

  get version() {
    return this.state.version;
  }

  get upTime(): Date {
    return this.state.upTime;
  }
}
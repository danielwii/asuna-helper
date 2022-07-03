import { Logger } from '@nestjs/common';

import { ConfigLoader } from 'node-buffs';

import { resolveModule } from './logger/factory';
import { r } from './serializer';

export class AppEnv {
  private static readonly logger = new Logger(resolveModule(__filename, AppEnv.name));
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
    AppEnv.logger.log(`initialized. ${r(this.state)}`);
  }

  get version() {
    return this.state.version;
  }

  get upTime(): Date {
    return this.state.upTime;
  }
}

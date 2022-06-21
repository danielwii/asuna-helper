import { Logger } from '@nestjs/common';

import _ from 'lodash';

import { resolveModule } from './logger';
import { r } from './serializer';

import type { NestExpressApplication } from '@nestjs/platform-express';

const logger = new Logger(resolveModule(__filename));

export interface AppLifecycleType {
  beforeBootstrap?: (app: NestExpressApplication) => Promise<void>;
  appStarted?: () => Promise<void>;
}

export class LifecycleRegister {
  public static handlers: AppLifecycleType[] = [];
  public static exitProcessors: Record<string, () => Promise<any>> = {};

  public static reg(handler: AppLifecycleType): void {
    this.handlers.push(handler);
    logger.debug(`reg handler ${r(handler)} total: ${this.handlers.length}`);
  }

  public static regExitProcessor(resource: string, fn: () => Promise<any>) {
    this.exitProcessors[resource] = fn;
    logger.debug(`reg exit processor ${resource} total: ${_.keys(this.exitProcessors).length}`);
  }
}

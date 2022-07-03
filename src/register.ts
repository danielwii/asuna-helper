import { Logger } from '@nestjs/common';

import _ from 'lodash';

import { resolveModule } from './logger/factory';
import { r } from './serializer';

import type { NestExpressApplication } from '@nestjs/platform-express';

export interface AppLifecycleType {
  beforeBootstrap?: (app: NestExpressApplication) => Promise<void>;
  appStarted?: () => Promise<void>;
}

export class LifecycleRegister {
  private static readonly logger = new Logger(resolveModule(__filename, LifecycleRegister.name));
  public static handlers: AppLifecycleType[] = [];
  public static exitProcessors: Record<string, () => Promise<any>> = {};

  public static reg(handler: AppLifecycleType): void {
    this.handlers.push(handler);
    LifecycleRegister.logger.debug(`reg handler ${r(handler)} total: ${this.handlers.length}`);
  }

  public static regExitProcessor(resource: string, fn: () => Promise<any>) {
    this.exitProcessors[resource] = fn;
    LifecycleRegister.logger.debug(`reg exit processor ${resource} total: ${_.keys(this.exitProcessors).length}`);
  }
}

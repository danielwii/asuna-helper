import { noop } from 'react-use/lib/misc/util';

import type { Consola, ConsolaLogObject } from 'consola';

export const getLogger = (scope: string) => {
  if (process.env.NODE_ENV === 'production') {
    return { log: noop, info: noop, warn: noop, success: noop, error: console.error.bind(console) };
  } else {
    return new ConsolaLogger(scope);
  }
};

export class ConsolaLogger {
  private logger: Consola;
  public constructor(scope?: string) {
    const consola = require('consola');
    this.logger = scope ? consola.withScope(scope) : consola;
  }

  // public withScope(tag: string): Consola {
  //   return this.logger.withScope(tag);
  // }
  public log(message: ConsolaLogObject | any, ...args: any[]): void {
    this.logger.log(message, ...args);
  }
  public info(message: ConsolaLogObject | any, ...args: any[]): void {
    this.logger.info(message, ...args);
  }
  public success(message: ConsolaLogObject | any, ...args: any[]): void {
    this.logger.success(message, ...args);
  }
  public warn(message: ConsolaLogObject | any, ...args: any[]): void {
    this.logger.warn(message, ...args);
  }
  public error(message: ConsolaLogObject | any, ...args: any[]): void {
    this.logger.error(message, ...args);
  }
}

import consola, { Consola, ConsolaLogObject } from 'consola';

import { isProd } from '../env';

export class ConsolaLogger {
  private logger: Consola;
  public constructor(private readonly scope?: string) {
    this.logger = scope ? consola.withScope(scope) : consola;
  }

  // public withScope(tag: string): Consola {
  //   return this.logger.withScope(tag);
  // }
  public log(message: ConsolaLogObject | any, ...args: any[]): void {
    !isProd && this.logger.log(message, ...args);
  }
  public info(message: ConsolaLogObject | any, ...args: any[]): void {
    !isProd && this.logger.info(message, ...args);
  }
  public success(message: ConsolaLogObject | any, ...args: any[]): void {
    !isProd && this.logger.success(message, ...args);
  }
  public warn(message: ConsolaLogObject | any, ...args: any[]): void {
    !isProd && this.logger.warn(message, ...args);
  }
  public error(message: ConsolaLogObject | any, ...args: any[]): void {
    !isProd && this.logger.error(message, ...args);
  }
}

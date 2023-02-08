import { Logger } from '@nestjs/common';

import { fileURLToPath } from 'node:url';

import { resolveModule } from './logger/factory';
import { r } from './serializer';

const logger = new Logger(resolveModule(fileURLToPath(import.meta.url), 'InitContainer'));

/**
 * may add logger enable mark in configs for debug.
 */
export abstract class InitContainer {
  async init(fn?: () => Promise<any> | any) {
    const timestamp = Date.now();
    const timer = setTimeout(() => logger.warn(`init... <<${this.constructor.name}>> timeout.`), 3e3);
    try {
      logger.log(`init... <<${this.constructor.name}>>`);
      fn && (await fn());
      logger.log(`init... <<${this.constructor.name}>> done in ${Date.now() - timestamp}ms.`);
      clearTimeout(timer);
    } catch (reason) {
      logger.error(`init... <<${this.constructor.name}>> error! ${r(reason)})}`);
      process.exit(2);
    }
  }
}

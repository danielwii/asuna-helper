/**
 * may add logger enable mark in configs for debug.
 */
export abstract class InitContainer {
  async init(fn?: () => Promise<any> | any) {
    const timestamp = Date.now();
    const timer = setTimeout(() => console.warn(`[InitContainer] init... <<${this.constructor.name}>> timeout.`), 3e3);
    try {
      console.log(`[InitContainer] init... <<${this.constructor.name}>>`);
      fn && (await fn());
      console.log(`[InitContainer] init... <<${this.constructor.name}>> done in ${Date.now() - timestamp}ms.`);
      clearTimeout(timer);
    } catch (reason) {
      console.error(`[InitContainer] init... <<${this.constructor.name}>> error!`);
      console.error(reason);
      process.exit(2);
    }
  }
}

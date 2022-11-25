import bluebird from 'bluebird';
import { exec } from 'child_process';
import _ from 'lodash';

const { Promise } = bluebird;

export function promisify<T extends (...args: any[]) => R, R>(
  fn: T,
  bind?: any,
): (...args: Parameters<T>) => Promise<R> {
  return Promise.promisify(fn).bind(bind);
}

export function isPromiseAlike<T>(value: any): value is Promise<T> {
  return !!value.then;
}

export type FutureResolveType<T> = ((...args: any[]) => Promise<T> | T) | T;

export const fnResolve =
  <T>(fn: FutureResolveType<T>): ((...args: any[]) => Promise<T>) =>
  async (...args): Promise<T> =>
    _.isFunction(fn) ? (isPromiseAlike(fn) ? fn(...args) : Promise.resolve(fn(...args))) : Promise.resolve(fn);

export function execAsync(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout ?? stderr);
    });
  });
}

export async function waitUtil<T>(fn: () => Promise<T>): Promise<T> {
  const exists = await fn();
  if (exists) {
    // logger.debug(`found wait ${r(exists)}, waiting 1s...`);
    await Promise.delay(1000);
    return waitUtil(fn);
  }
  return exists;
}

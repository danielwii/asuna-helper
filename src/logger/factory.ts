import { Logger } from '@nestjs/common';

import _ from 'lodash';
import fp from 'lodash/fp';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __entrance = pathToFileURL(process.argv[1] as any).href;
const __rootPath = dirname(dirname(fileURLToPath(__entrance)));
// const root = dirname(require.main?.filename ?? '.');

export const resolveModule = (path: string, name?: string) => {
  const diff = _.difference(path.split('/'), __rootPath.split('/'));
  return name ? `${diff.join('/')}::${name}` : diff.join('/');
};

export class LoggerFactory {
  public static getLogger(name: string): Logger {
    // --------------------------------------------------------------
    // get caller function from stack
    // --------------------------------------------------------------
    let caller;
    let callerPath;
    {
      const aRegexResult = new Error().stack?.match(/([^(]+)@|at ([^(]+) \([^)]+/g);
      if (aRegexResult) {
        caller = aRegexResult[1] || aRegexResult[2];
        [callerPath] = caller?.match(/\/.+\//g) ?? [];
      }
    }

    const flows = [];
    if (!_.isEmpty(__rootPath)) {
      flows.push(
        fp.replace(resolve(__rootPath, '../dist'), ''),
        fp.replace(resolve(__rootPath, '../src'), ''),
        fp.replace(__rootPath, ''),
      );
    }
    if (callerPath && require.main?.path) {
      // flows.push(fp.replace(resolve(callerPath, '../..'), ''));
      flows.push(fp.replace(resolve(require.main.path, '../../..'), ''));
    }

    /*
    path: /xxx/packages/asuna-node-server/src/modules/cache/CacheUtils
    main: /xxx/modules/server/src
    caller: /xxx/packages/asuna-node-server/src/modules/cache/
     */
    const path = join(callerPath ?? '.', name);
    const context = _.flow(
      ...flows,
      fp.replace(__rootPath, ''),
      (path) => join('/', path).slice(1), // //a/b/c -> a/b/c
      fp.replace(/\//g, '.'), // a/b/c -> a.b.c
      (path: string) => (path.includes('@') ? path.slice(path.indexOf('@')) : path),
    )(path);

    return new Logger(context);
  }
}

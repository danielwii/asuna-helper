import _ from 'lodash';
import * as fp from 'lodash/fp';
import { dirname, join, resolve } from 'path';

import type { ConsoleLogger } from '@nestjs/common';

const root = dirname(require.main?.filename ?? '.');

export class LoggerFactory {
  public static getLogger(name: string): ConsoleLogger {
    // --------------------------------------------------------------
    // get caller function from stack
    // --------------------------------------------------------------
    let caller;
    let callerPath;
    {
      const aRegexResult = new Error().stack?.match(/([^(]+)@|at ([^(]+) \([^)]+/g);
      if (aRegexResult) {
        caller = aRegexResult[1] || aRegexResult[2];
        [callerPath] = caller.match(/\/.+\//g) ?? [];
      }
    }

    const flows = [];
    if (!_.isEmpty(root)) {
      flows.push(
        fp.replace(resolve(root, '../dist'), ''),
        fp.replace(resolve(root, '../src'), ''),
        fp.replace(root, ''),
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
      fp.replace(root, ''),
      (path) => join('/', path).slice(1), // //a/b/c -> a/b/c
      fp.replace(/\//g, '.'), // a/b/c -> a.b.c
    )(path);

    const ConsoleLogger = require('@nestjs/common').ConsoleLogger;
    return new ConsoleLogger(context);
  }
}

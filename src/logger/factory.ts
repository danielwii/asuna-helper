import { Logger } from '@nestjs/common';
import _ from 'lodash';
import * as fp from 'lodash/fp';
import { dirname, join, resolve } from 'path';

const root = dirname(require.main?.filename ?? '.');
const { packageDir } = global as any;

export class LoggerFactory {
  static getLogger(name: string): Logger {
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
    if (!_.isEmpty(packageDir)) {
      flows.push(
        fp.replace(resolve(packageDir, '../dist'), ''),
        fp.replace(resolve(packageDir, '../src'), ''),
        fp.replace(packageDir, ''),
      );
    }
    if (callerPath) {
      flows.push(fp.replace(resolve(callerPath, '../..'), ''));
    }

    const context = _.flow(
      ...flows,
      fp.replace(root, ''),
      (path) => join('/', path).slice(1), // //a/b/c -> a/b/c
      fp.replace(/\//g, '.'), // a/b/c -> a.b.c
    )(join(callerPath ?? '.', name));

    return new Logger(context);
  }
}

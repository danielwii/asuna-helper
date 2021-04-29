import _ from 'lodash';
import path from 'path';

export function resolveBasename(dir: string, withExt = false): string {
  if (!_.isString(dir)) {
    return dir;
  }
  return withExt ? path.basename(dir) : path.basename(dir).replace(/\.[^./]+$/, '');
}

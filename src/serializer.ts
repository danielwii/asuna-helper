import { instanceToPlain } from 'class-transformer';
import JSON5 from 'json5';
import _ from 'lodash';
import util from 'util';

import { isProductionEnv } from './utils';

export const safeStringify = (obj: any, indent = 2): string => {
  let cache: any[] = [];
  const retVal = JSON5.stringify(
    obj,
    (key, value) =>
      typeof value === 'object' && value !== null
        ? cache.includes(value)
          ? undefined // Duplicate reference found, discard key
          : cache.push(value) && value // Store value in our collection
        : value,
    indent,
  );
  cache = null as any;
  return retVal;
};

export function r(
  o: any,
  { transform, stringify, depth }: { transform?: boolean; stringify?: boolean; depth?: number } = {},
): string {
  if (!_.isObjectLike(o)) {
    return o;
  }
  const colors = !process.env.NO_COLOR;
  const value = transform || stringify ? instanceToPlain(o) : o;
  return isProductionEnv || stringify ? safeStringify(value, 0) : inspect(value, { colors, depth: depth ?? 5 });
}

export function inspect(o: any, options: util.InspectOptions = {}): string {
  const colors = !process.env.NO_COLOR;
  return isProductionEnv
    ? util.inspect(o, { breakLength: Infinity, colors, ...options })
    : util.inspect(o, { colors, ...options });
}

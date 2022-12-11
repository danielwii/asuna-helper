import JSON5 from 'json5';

export const isProductionEnv = process.env.NODE_ENV === 'production';

export const withP = <P, R>(parameter: P, fn: (p: P) => R) => fn(parameter);
export const withP2 = <P1, P2, R>(parameter1: P1, parameter2: P2, fn: (p1: P1, p2: P2) => R) =>
  fn(parameter1, parameter2);
export const withP3 = <P1, P2, P3, R>(
  parameter1: P1,
  parameter2: P2,
  parameter3: P3,
  fn: (p1: P1, p2: P2, p3: P3) => R,
) => fn(parameter1, parameter2, parameter3);
export const fnWithP2 =
  <P1, P2, R>(parameter1: P1, parameter2: P2) =>
  (fn: (p1: P1, p2: P2) => R): R =>
    fn(parameter1, parameter2);
export const fnWithP3 =
  <P1, P2, P3, R>(parameter1: P1, parameter2: P2, parameter3: P3) =>
  (fn: (p1: P1, p2: P2, p3: P3) => R): R =>
    fn(parameter1, parameter2, parameter3);

export function parseJSONIfCould(value?: string): any {
  try {
    return JSON5.parse(value ?? '');
    // eslint-disable-next-line no-empty
  } catch {}
  return value;
}

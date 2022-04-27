/* class decorator */
export function StaticImplements<T>() {
  return (constructor: T) => {};
}

export type FunctionRecord<T> = {
  [Property in keyof T]: () => T[Property] | Promise<T[Property]>;
};

export type ClassType<T> = new (...args: any[]) => T;
export type Constructor = new (...args: any[]) => {};
export type ConstrainedConstructor<T = {}> = new (...args: any[]) => T;
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

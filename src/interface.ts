export type ClassType<T> = new (...args: any[]) => T;
export type Constructor = new (...args: any[]) => {};
export type ConstrainedConstructor<T = {}> = new (...args: any[]) => T;

const SINGLETON_KEY = Symbol('Singleton');

type Singleton<T extends new (...args: any[]) => any> = T & {
  [SINGLETON_KEY]: T extends new (...args: any[]) => infer I ? I : never;
};

/**
 * made class singleton via constructor
 * @param classTarget
 */
export const singleton = <T extends new (...args: any[]) => any>(classTarget: T) =>
  new Proxy(classTarget, {
    construct(target: Singleton<T>, argumentsList, newTarget) {
      if (target.prototype !== newTarget.prototype) {
        return Reflect.construct(target, argumentsList, newTarget);
      }

      if (!target[SINGLETON_KEY]) {
        target[SINGLETON_KEY] = Reflect.construct(target, argumentsList, newTarget);
      }

      return target[SINGLETON_KEY];
    },
  });

import consola from 'consola';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import useUpdateEffect from 'react-use/lib/useUpdateEffect';

export const useLogger = (componentName: string, ...rest: any[]): void => {
  const isProd = process.env.NODE_ENV === 'production';
  const logger = consola.withScope(componentName);

  useEffectOnce(() => {
    !isProd && logger.log(`mounted`, ...rest);
    return () => !isProd && logger.log(`unmounted`);
  });

  useUpdateEffect(() => {
    !isProd && logger.log(`updated`, ...rest);
  });
};

export default useLogger;

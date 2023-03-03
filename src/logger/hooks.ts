import consola from 'consola';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import useUpdateEffect from 'react-use/lib/useUpdateEffect';

export const useLogger = (componentName: string, ...rest: any[]): void => {
  const isProd = process.env.NODE_ENV === 'production';
  const logger = consola.withScope(componentName);

  useEffectOnce(() => {
    !isProd && logger.info(`mounted`, ...rest);
    return () => {
      !isProd && logger.success(`unmounted`);
    };
  });

  useUpdateEffect(() => {
    !isProd && logger.info(`updated`, ...rest);
  });

};

export default useLogger;

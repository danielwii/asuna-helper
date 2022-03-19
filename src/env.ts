export const isProd = process.env.NODE_ENV === 'production';

export class EndpointsUtil {
  public static api(isProxyMode?: boolean, isServerSide?: boolean) {
    if (isServerSide) {
      if (!process.env.API_ENDPOINT) throw new Error('API_ENDPOINT is required for server side request.');
      return `${process.env.API_ENDPOINT}/api`;
    }

    if (!isProxyMode) {
      if (!process.env.NEXT_PUBLIC_API_ENDPOINT && !process.env.API_ENDPOINT)
        throw new Error('[ENV] NEXT_PUBLIC_API_ENDPOINT/API_ENDPOINT is required for client side request.');
      return new URL('/api', `${process.env.NEXT_PUBLIC_API_ENDPOINT || process.env.API_ENDPOINT}`).href;
    }
    return `/proxy`;
  }

  public static resolvePath(isProxyMode?: boolean, isServerSide?: boolean, path = '/api'): string {
    const endpoint = Endpoints.api;

    if (isServerSide || !isProxyMode) {
      return new URL(path, endpoint).href;
    }

    return '/proxy' + path;
  }
}

export class Endpoints {
  public static get api(): string {
    return EndpointsUtil.api(!!process.env.PROXY_MODE, typeof window === 'undefined');
  }

  public static resolvePath(path = ''): string {
    return EndpointsUtil.resolvePath(!!process.env.PROXY_MODE, typeof window === 'undefined', path);
  }

  public static get graphql(): string {
    return EndpointsUtil.resolvePath(!!process.env.PROXY_MODE, typeof window === 'undefined', '/graphql');
  }

  public static get ws() {
    if (process.env.PROXY_MODE) {
      return typeof window === 'undefined' ? new URL('/socket.io', Endpoints.api).href : '/socket.io';
    }
    return typeof window === 'undefined'
      ? `${process.env.NEXT_PUBLIC_WS_ENDPOINT ?? Endpoints.api}`
      : `${process.env.WS_ENDPOINT ?? Endpoints.api}`;
  }
}

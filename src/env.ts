export const isProd = process.env.NODE_ENV === 'production';

export class Endpoints {
  public static get api(): string {
    if (process.env.PROXY_MODE) {
      return typeof window === 'undefined' ? `${process.env.INTERNAL_DOMAIN ?? process.env.DOMAIN}/proxy` : '/proxy';
    }
    return typeof window === 'undefined'
      ? `${process.env.API_ENDPOINT}/api`
      : `${process.env.NEXT_PUBLIC_API_ENDPOINT}/api`;
  }

  public static resolvePath(path = '/api'): string {
    const endpoint = Endpoints.api;
    if (process.env.PROXY_MODE) {
      return endpoint + path;
    }
    return new URL(path, endpoint).href;
  }

  public static get graphql(): string {
    return process.env.PROXY_MODE
      ? typeof window === 'undefined'
        ? `${process.env.INTERNAL_DOMAIN ?? process.env.DOMAIN}/graphql`
        : '/graphql'
      : `${process.env.NEXT_PUBLIC_API_ENDPOINT}/graphql`;
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

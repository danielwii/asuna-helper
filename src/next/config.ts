import Table from 'cli-table';
import consola from 'consola';
import { compact, flow, isNaN, isNumber, last, omit, split, uniq } from 'lodash';
import fp from 'lodash/fp';
import { URL } from 'url';
import { inspect } from 'util';

import { Endpoints, EndpointsUtil } from '../env';

const logger = consola.withScope('next');

type Redirects = { source: string; destination: string; permanent?: boolean }[];
type Rewrites = { beforeFiles?: { source: string; destination: string }[] };

export interface RequestPipes {
  headers?: any[];
  rewrites?: Rewrites;
  redirects?: Redirects;
}

export interface NextConfigProps {
  i18n?: { locales: string[]; defaultLocale: string; localeDetection: boolean };
}

export const createNextConfig = (
  config: NextConfigProps,
  requestPipes: RequestPipes,
  preprocessors = [],
  { enableAdmin }: { enableAdmin?: boolean } = {},
): void => {
  if (process.env.PROXY_API)
    logger.error(
      'deprecated configs',
      { PROXY_API: process.env.PROXY_API },
      'using API_ENDPOINT/NEXT_PUBLIC_API_ENDPOINT instead.',
    );

  process.env.PORT =
    process.env.PORT ||
    (isNumber(parseInt(last(process.argv as any[]))) && !isNaN(parseInt(last(process.argv as any[])))
      ? last(process.argv)
      : '3000');
  const PORT = process.env.PORT;

  if (!process.env.INTERNAL_DOMAIN) process.env.INTERNAL_DOMAIN = `http://localhost:${PORT}`;
  if (!process.env.DOMAIN) throw new Error('env.DOMAIN is required, for public access');

  if (process.env.BUILDING) process.env.INTERNAL_DOMAIN = process.env.DOMAIN;

  logger.info('init next with', {
    PORT,
    // --------------------------------------------------------------
    // UPLOADS_FOLLOW 用于 follow /uploads 下的 30x 冲定向，并直接返回结果
    // UPLOADS_FOLLOW_INTERNAL 标记转向地址是是否是内网的 asuna-node-server api
    // --------------------------------------------------------------
    UPLOADS_FOLLOW: process.env.UPLOADS_FOLLOW,
    UPLOADS_FOLLOW_INTERNAL: process.env.UPLOADS_FOLLOW_INTERNAL,
    // 某些页面的静态话需要一个启动的当前服务，在构建是无法访问需要跳过
    SKIP_BUILD: process.env.SKIP_BUILD,
    // 标记构建模式，用于处理一些地址转换，构建时应该始终是 1
    BUILDING: process.env.BUILDING,
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    DOMAIN: process.env.DOMAIN,
    // 内网地址，用于 getStaticProps 服务端访问
    INTERNAL_DOMAIN: process.env.INTERNAL_DOMAIN,
    // 1 时通过 /proxy 访问 api；0 时直连 api，此时需要 api 开通 cors, for client request only
    PROXY_MODE: process.env.PROXY_MODE,
    API_ENDPOINT: process.env.API_ENDPOINT,
    WS_ENDPOINT: process.env.WS_ENDPOINT,
    STATIC_ENDPOINT: process.env.STATIC_ENDPOINT,
    NEXT_PUBLIC_API_ENDPOINT: process.env.NEXT_PUBLIC_API_ENDPOINT,
    NEXT_PUBLIC_WS_ENDPOINT: process.env.NEXT_PUBLIC_WS_ENDPOINT,
    NEXT_PUBLIC_STATIC_ENDPOINT: process.env.NEXT_PUBLIC_STATIC_ENDPOINT,
    ENABLE_MOBILE_COMPATIBILITY: process.env.ENABLE_MOBILE_COMPATIBILITY,
    HOST_MAPPINGS: process.env.HOST_MAPPINGS,
    // 可供识别的 assets 地址，用于生成缩略图
    EXTRA_DOMAINS: process.env.EXTRA_DOMAINS,
  });

  printEndpoints();
  const uploadsRequestMode = detectUploadsRequestMode();
  logger.success('uploads request mode', uploadsRequestMode);
  // process.exit(1);

  const configs = flow(
    ...preprocessors,
    fp.merge(config),
  )({
    env: { PROXY_MODE: process.env.PROXY_MODE },
    future: { webpack5: true },
    // @ts-ignore
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
      if (!isServer) {
        config.resolve.fallback = { fs: false, crypto: false, window: false };
      }
      return config;
    },
    reactStrictMode: false,
    poweredByHeader: false,
    productionBrowserSourceMaps: true,
    images: {
      domains: flow(
        uniq,
        compact,
      )(
        [
          process.env.DOMAIN ? new URL(process.env.DOMAIN).hostname : '',
          process.env.STATIC_ENDPOINT ? new URL(process.env.STATIC_ENDPOINT).hostname : '',
          process.env.NEXT_PUBLIC_STATIC_ENDPOINT ? new URL(process.env.NEXT_PUBLIC_STATIC_ENDPOINT).hostname : '',
          'localhost',
        ].concat(
          process.env.EXTRA_DOMAINS
            ? split(process.env.EXTRA_DOMAINS, ',').map((domain: string) => new URL(domain).hostname)
            : [],
        ),
      ),
    },
    publicRuntimeConfig: {
      STATIC_ENDPOINT: process.env.STATIC_ENDPOINT,
      ENABLE_MOBILE_COMPATIBILITY: process.env.ENABLE_MOBILE_COMPATIBILITY,
    },
    async headers() {
      return compact([
        {
          source: '/(.*)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=10, s-maxage=10, stale-while-revalidate=10' }],
        },
        { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
        { source: '/proxy/:path*', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
        {
          // FIXME not working, see https://github.com/vercel/next.js/issues/19914, using proxy solve the cache for next image
          // source: '/_next/image(.*)',
          source: '/:all*(svg|jpg|png|gif)', // for others
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600' },
          ],
        },
        ...requestPipes?.headers ?? [],
      ]);
    },
    async redirects(): Promise<Redirects> {
      const staticEndpoint = process.env.STATIC_ENDPOINT || process.env.NEXT_PUBLIC_STATIC_ENDPOINT;
      return compact([
        uploadsRequestMode.redirect
          ? {
              source: '/uploads/:slug*',
              destination: new URL('/:slug*', uploadsRequestMode.endpoint).href,
              permanent: true,
            }
          : undefined,
      ]);
    },
    async rewrites(): Promise<Rewrites> {
      const apiEndpoint = process.env.API_ENDPOINT || process.env.NEXT_PUBLIC_API_ENDPOINT;
      // const staticEndpoint = process.env.STATIC_ENDPOINT || process.env.NEXT_PUBLIC_STATIC_ENDPOINT;
      return {
        beforeFiles: compact([
          !uploadsRequestMode.redirect
            ? process.env.UPLOADS_FOLLOW_INTERNAL
              ? { source: '/uploads/:slug*', destination: new URL('/uploads/:slug*', uploadsRequestMode.endpoint).href }
              : { source: '/uploads/:slug*', destination: new URL('/:slug*', uploadsRequestMode.endpoint).href }
            : undefined,
          apiEndpoint && enableAdmin
            ? { source: '/proxy/rest/:slug*', destination: new URL('/rest/:slug*', apiEndpoint).href }
            : undefined,
          apiEndpoint && enableAdmin
            ? { source: '/proxy/graphql/:slug*', destination: new URL('/graphql/:slug*', apiEndpoint).href }
            : undefined,
          apiEndpoint && enableAdmin
            ? { source: '/proxy/admin/:slug*', destination: new URL('/admin/:slug*', apiEndpoint).href }
            : undefined,
          apiEndpoint
            ? { source: '/proxy/api/:slug*', destination: new URL('/api/:slug*', apiEndpoint).href }
            : undefined,
          apiEndpoint ? { source: '/proxy/:slug*', destination: new URL('/api/:slug*', apiEndpoint).href } : undefined,
          apiEndpoint
            ? { source: '/socket.io/:slug*', destination: new URL('/socket.io/:slug*', apiEndpoint).href }
            : undefined,
          apiEndpoint
            ? { source: '/graphql/:slug*', destination: new URL('/graphql/:slug*', apiEndpoint).href }
            : undefined,
          ...(requestPipes.rewrites?.beforeFiles ?? []),
        ]),
      };
    },
  });

  logger.success(omit(configs, 'redirects', 'rewrites', 'headers'));
  (async () => {
    if (configs.headers) logger.success('headers', inspect(await configs.headers(), { colors: true, depth: 5 }));
    if (configs.redirects) logger.success('redirects', inspect(await configs.redirects(), { colors: true, depth: 5 }));
    if (configs.rewrites) logger.success('rewrites', inspect(await configs.rewrites(), { colors: true, depth: 5 }));
  })();
  return configs;
};

const detectUploadsRequestMode = () => {
  const follow = process.env.UPLOADS_FOLLOW;
  const internal = process.env.UPLOADS_FOLLOW_INTERNAL;

  const redirect = !follow;

  const table = new Table({ head: ['Mode', 'Request', 'Endpoint'] });
  table.push(['Server - Follow - Internal', 'rewrite', EndpointsUtil.resolvePath(false, true, '/uploads')]);
  table.push([
    'Server - Follow - External',
    'rewrite',
    process.env.STATIC_ENDPOINT || process.env.NEXT_PUBLIC_STATIC_ENDPOINT,
  ]);
  table.push(['Server - Direct - Internal', '301', EndpointsUtil.resolvePath(false, true, '/uploads')]);
  table.push([
    'Server - Direct - External',
    '301',
    process.env.STATIC_ENDPOINT || process.env.NEXT_PUBLIC_STATIC_ENDPOINT,
  ]);
  table.push(['Client - Follow - Internal', 'rewrite', '/uploads']);
  table.push([
    'Client - Follow - External',
    'rewrite',
    process.env.NEXT_PUBLIC_STATIC_ENDPOINT || process.env.STATIC_ENDPOINT,
  ]);
  table.push(['Client - Direct - Internal', '301', '/uploads']);
  table.push([
    'Client - Direct - External',
    '301',
    process.env.NEXT_PUBLIC_STATIC_ENDPOINT || process.env.STATIC_ENDPOINT,
  ]);
  logger.log(table.toString());

  return {
    endpoint:
      typeof window === 'undefined'
        ? internal
          ? EndpointsUtil.resolvePath(false, true, '/uploads')
          : process.env.STATIC_ENDPOINT || process.env.NEXT_PUBLIC_STATIC_ENDPOINT
        : internal
        ? '/uploads'
        : process.env.NEXT_PUBLIC_STATIC_ENDPOINT || process.env.STATIC_ENDPOINT,
    redirect,
  };
};

const printEndpoints = () => {
  const endpointsTable = new Table({ head: ['Name', 'Endpoint'] });
  endpointsTable.push(['api', Endpoints.api], ['graphql', Endpoints.graphql], ['ws', Endpoints.ws]);
  logger.log(endpointsTable.toString());
  const endpointsTable2 = new Table({ head: ['Name', 'From Server', 'From Client Direct', 'From Client Proxy'] });
  endpointsTable2.push([
    'Api',
    EndpointsUtil.api(false, true),
    EndpointsUtil.api(false, false),
    EndpointsUtil.api(true, false),
  ]);
  endpointsTable2.push([
    'GraphQL',
    EndpointsUtil.resolvePath(false, true, '/graphql'),
    EndpointsUtil.resolvePath(false, false, '/graphql'),
    EndpointsUtil.resolvePath(true, false, '/graphql'),
  ]);
  logger.log(endpointsTable2.toString());
};

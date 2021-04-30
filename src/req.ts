import net from 'net';
import _ from 'lodash';

function getClientIpFromXForwardedFor(value: string): string {
  const addresses = _.split(value, ',').map(_.trim);
  return _.head(addresses) ?? '';
}

export function getClientIp(req: any): string | undefined {
  // Server is probably behind a proxy.
  if (req.headers) {
    // Standard headers used by Amazon EC2, Heroku, and others.
    if (net.isIP(req.headers['x-client-ip'])) {
      return req.headers['x-client-ip'];
    }

    // k8s ingress
    const xOriginalForwardedFor = getClientIpFromXForwardedFor(req.headers['x-original-forwarded-for']);
    if (net.isIP(xOriginalForwardedFor)) {
      return xOriginalForwardedFor;
    }

    // Load-balancers (AWS ELB) or proxies.
    const xForwardedFor = getClientIpFromXForwardedFor(req.headers['x-forwarded-for']);
    if (net.isIP(xForwardedFor)) {
      return xForwardedFor;
    }

    // Cloudflare.
    // @see https://support.cloudflare.com/hc/en-us/articles/200170986-How-does-Cloudflare-handle-HTTP-Request-headers-
    // CF-Connecting-IP - applied to every request to the origin.
    if (net.isIP(req.headers['cf-connecting-ip'])) {
      return req.headers['cf-connecting-ip'];
    }

    // Fastly and Firebase hosting header (When forwared to cloud function)
    if (net.isIP(req.headers['fastly-client-ip'])) {
      return req.headers['fastly-client-ip'];
    }

    // Akamai and Cloudflare: True-Client-IP.
    if (net.isIP(req.headers['true-client-ip'])) {
      return req.headers['true-client-ip'];
    }

    // Default nginx proxy/fcgi; alternative to x-forwarded-for, used by some proxies.
    if (net.isIP(req.headers['x-real-ip'])) {
      return req.headers['x-real-ip'];
    }

    // (Rackspace LB and Riverbed's Stingray)
    // http://www.rackspace.com/knowledge_center/article/controlling-access-to-linux-cloud-sites-based-on-the-client-ip-address
    // https://splash.riverbed.com/docs/DOC-1926
    if (net.isIP(req.headers['x-cluster-client-ip'])) {
      return req.headers['x-cluster-client-ip'];
    }

    if (net.isIP(req.headers['x-forwarded'])) {
      return req.headers['x-forwarded'];
    }

    if (net.isIP(req.headers['forwarded-for'])) {
      return req.headers['forwarded-for'];
    }

    if (net.isIP(req.headers.forwarded)) {
      return req.headers.forwarded;
    }
  }

  // Remote address checks.
  if (req.connection) {
    if (net.isIP(req.connection.remoteAddress)) {
      return req.connection.remoteAddress;
    }
    if (req.connection.socket && net.isIP(req.connection.socket.remoteAddress)) {
      return req.connection.socket.remoteAddress;
    }
  }

  if (req.socket && net.isIP(req.socket.remoteAddress)) {
    return req.socket.remoteAddress;
  }

  if (req.info && net.isIP(req.info.remoteAddress)) {
    return req.info.remoteAddress;
  }

  // AWS Api Gateway + Lambda
  if (req.requestContext?.identity && net.isIP(req.requestContext.identity.sourceIp)) {
    return req.requestContext.identity.sourceIp;
  }

  return undefined;
}

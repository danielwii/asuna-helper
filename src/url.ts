export function resolveUrl(from: string, to: string = '', defaultUrl = '/'): string {
  // if (typeof window !== undefined) {
  //   return resolve(from ?? '', to ?? '') ?? defaultUrl;
  // }
  const resolvedUrl = new URL(to || '', new URL(from || '', 'resolve://'));
  if (resolvedUrl.protocol === 'resolve:') {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash || defaultUrl;
  }
  return resolvedUrl.toString();
}

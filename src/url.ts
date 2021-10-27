export function resolveUrl(from: string, to: string = '', defaultUrl = '/'): string {
  // if (typeof window !== undefined) {
  //   return resolve(from ?? '', to ?? '') ?? defaultUrl;
  // }
  // resolve:// as base will throw exception in browser
  const base = new URL(from ?? '', 'ftp://base');
  const resolvedUrl = new URL(to ?? '', base);
  if (resolvedUrl.protocol === 'ftp:') {
    // `from` is a relative URL.
    const { pathname, search, hash } = resolvedUrl;
    return pathname + search + hash ?? defaultUrl;
  }
  return resolvedUrl.toString();
}

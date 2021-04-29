import isMobile from 'ismobilejs';
import UaParser from 'ua-parser-js';

export const detectUA = (ua: string) => {
  const parsed = new UaParser(ua);
  return {
    isMobile: isMobile(ua).any,
    isBrowser: isMobile(ua).any || !!parsed.getBrowser().name,
    parsed: parsed.getResult(),
    isUnknown: !parsed.getOS().name,
  };
};

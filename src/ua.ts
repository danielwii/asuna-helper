import UaParser from 'ua-parser-js';
import detectMobile from 'is-mobile';

export const detectUA = (ua: string) => {
  if (!ua) return { isMobile: false };
  const parsed = new UaParser(ua);
  const isMobile = detectMobile({ ua }); // initiate as false
  return {
    isMobile,
    isBrowser: !!parsed.getBrowser().name,
    parsed: parsed.getResult(),
    isUnknown: !parsed.getOS().name,
  };
};

import * as os from 'os';

import { LoggerFactory } from './logger';
import { r } from './serializer';

const logger = LoggerFactory.getLogger('OS');

export function getLocalIP(): string {
  const osType = os.type();
  logger.log(`osType: ${osType}`);
  const netInfo = os.networkInterfaces();
  let ip = '';
  logger.verbose(`netInfo: ${r(netInfo)}`);
  if (osType === 'Windows_NT') {
    for (const dev in netInfo) {
      if (dev === '本地连接') {
        const netInfoElement = netInfo[dev] as any[];
        for (let j = 0; j < netInfoElement.length; j = j + 1) {
          if (netInfoElement[j].family === 'IPv4') {
            ip = netInfoElement[j].address;
            break;
          }
        }
      }
    }
  } else if (osType === 'Linux') {
    ip = (netInfo.eth0 as any[])[0].address;
  } else if (osType === 'Darwin') {
    if (netInfo.en0) {
      for (const info of netInfo.en0) {
        if (info.family === 'IPv4') {
          ip = info.address;
        }
      }
    }
  }
  return ip;
}
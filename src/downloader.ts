import axios, { AxiosResponse } from 'axios';
// target es5 for ie11 support
import * as Bluebird from 'bluebird';
import * as fs from 'fs-extra';
import path, { join } from 'path';

import { handleAxiosResponseError } from './axios';
import { LoggerFactory } from './logger';
import { r } from './serializer';

const logger = LoggerFactory.getLogger('Downloader');

export async function download(url: string, to: string): Promise<AxiosResponse> {
  fs.ensureDirSync(path.dirname(to));
  const dir = path.resolve(to);

  const writer = fs.createWriteStream(dir);

  const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 60000 });

  (response.data as any).pipe(writer);
  return new Bluebird.Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export function fetchFile(url: string, to: string): Promise<string | AxiosResponse> {
  // const host = AppConfigObject.load().masterAddress;
  const host = process.env.APP_MASTER_ADDRESS;
  let endpoint = url;
  if (!url.startsWith('http')) {
    const fixedPath = join('/', url).replace(/^\/+/, '/');
    // `${host}${fixedPath}?internal=1`
    endpoint = new URL(`${fixedPath}?internal=1`, host).href;
  }
  logger.log(`fetch file: ${r({ endpoint, url, to })}`);
  return download(endpoint, to).catch((error) => handleAxiosResponseError(endpoint, error));
}

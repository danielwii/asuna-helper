import { Logger } from '@nestjs/common';

import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs-extra';
import path, { join } from 'path';

import { handleAxiosResponseError } from './axios';
import { r } from './serializer';

export async function download(url: string, to: string): Promise<AxiosResponse> {
  fs.ensureDirSync(path.dirname(to));
  const dir = path.resolve(to);

  const writer = fs.createWriteStream(dir);

  const response = await axios({ url, method: 'GET', responseType: 'stream', timeout: 60000 });

  (response.data as any).pipe(writer);
  return new Promise((resolve, reject) => {
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
  Logger.log(`#fetchFile fetch file: ${r({ endpoint, url, to })}`);
  return download(endpoint, to).catch((error) => handleAxiosResponseError(endpoint, error));
}

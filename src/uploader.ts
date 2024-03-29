import { Logger } from '@nestjs/common';

import axios, { AxiosResponse } from 'axios';
import fs from 'fs-extra';
import { fileURLToPath, URLSearchParams } from 'node:url';

import { handleAxiosResponseError } from './axios';
import { Hermes, InMemoryAsunaQueue } from './hermes/index';
import { resolveModule } from './logger/factory';
import { r } from './serializer';

export class Uploader {
  private static readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), Uploader.name));
  private asunaQueue: InMemoryAsunaQueue | undefined;
  private queueName = 'IN_MEMORY_CHUNKED_UPLOAD';

  private static instance: Uploader;

  private constructor() {
    Hermes.initialize().then(() => {
      this.asunaQueue = Hermes.regInMemoryQueue(this.queueName);
      Hermes.setupJobProcessor(this.queueName, (payload) => {
        Uploader.logger.log(`queue(${this.queueName}): ${r(payload)}`);
        return payload;
      });
    });
  }

  public static async init(): Promise<void> {
    if (!Uploader.instance) Uploader.instance = new Uploader();
  }

  /*
  // TODO not implemented
  private async fileToChunks(file: File, opts: { chunkSize?: number } = {}): Promise<any> {
    // eslint-disable-next-line no-bitwise
    const chunkSize = _.get(opts, 'chunkSize', (2 * 1024) ^ 2);
    const totalChunks = Math.ceil(file.size / chunkSize);
  }*/

  public static async upload(
    bucket: string,
    prefix: string,
    path: string,
    filename: string,
  ): Promise<AxiosResponse | string> {
    const host = process.env.APP_MASTER_ADDRESS;
    const endpoint = new URL('/api/v1/uploader/stream', host).href;

    const limit = process.env.APP_PAYLOAD_LIMIT ?? '100mb';
    const stat = await fs.stat(path);
    const maxBodyLength = 1000 * 1000 * Number(limit.slice(0, -2));
    Uploader.logger.log(`upload: ${r({ endpoint, path, bucket, prefix, filename, stat, maxBodyLength })}`);

    if (stat.size > maxBodyLength) {
      throw new Error(`file size is ${stat.size} large than maxBodyLength ${maxBodyLength}`);
    }

    const readable = fs.createReadStream(path);

    return axios
      .post(`${endpoint}?${new URLSearchParams({ bucket, prefix, filename }).toString()}`, readable, {
        headers: { 'content-type': 'multipart/form-data' },
        maxBodyLength,
      })
      .catch((error) => handleAxiosResponseError(endpoint, error));
  }

  // TODO async uploadFolder(dir: string) {}
}

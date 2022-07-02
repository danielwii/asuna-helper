import { Logger } from '@nestjs/common';

import _ from 'lodash';

import { r } from './serializer';

export function handleAxiosResponseError(endpoint: string, reason: any): Promise<string> {
  if (reason.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    Logger.error(
      `Error response for request ${endpoint}: ${r({
        // data: reason.response.data,
        status: reason.response.status,
        headers: reason.response.headers,
        // config: reason.config,
        message: reason.message,
      })}`,
    );
  } else if (reason.request) {
    // The request was made but no response was received
    // `reason.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    Logger.error(`No response for request ${endpoint}: ${r(reason.message)}`);
  } else {
    // Something happened in setting up the request that triggered an Error
    Logger.error(`Error for request ${endpoint} ${reason.message}`);
  }
  Logger.error(`request to ${endpoint} error: ${r(_.omit(reason.config, 'data'))}`);
  throw reason.message;
}

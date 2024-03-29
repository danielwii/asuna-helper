import { HttpStatus, Logger } from '@nestjs/common';

import { fileURLToPath } from 'node:url';

import _ from 'lodash';

import { resolveModule } from './logger/factory';
import { NameValue } from './normal';
import { r } from './serializer';

/**
 * 400  invalidParameter          Indicates that a request parameter has an invalid value.
 * 400  badRequest
 * 401  invalidCredentials        Indicates that the auth token is invalid or has expired.
 * 403  insufficientPermissions   Indicates that the user does not have sufficient permissions for the entity specified in the query.
 * 409  conflict                  Indicates that the request message conflicts with the current state of the resource.
 *                                The API request cannot be completed because the requested operation would conflict with an existing item.
 *                                For example, a request that tries to create a duplicate item would create a conflict,
 *                                though duplicate items are typically identified with more specific errors.
 * 409  duplicate                 The requested operation failed because it tried to create a resource that already exists.
 * 422  unprocessable             Indicates an issue with the request message considered in isolation.
 * 429  tooManyRequests
 * 500  unexpected                Better not use it.
 */
export const AsunaErrorCode = {
  InvalidParameter: new NameValue('Invalid Parameter', 400),
  BadRequest: new NameValue('Bad Request', 400),

  InvalidCredentials: new NameValue('Invalid Credentials', 401),

  InsufficientPermissions: new NameValue('Insufficient Permissions', 403),
  InvalidCsrfToken: new NameValue('Invalid CSRF Token', 403),
  InvalidAuthToken: new NameValue('Invalid Auth Token', 401),
  InvalidToken: new NameValue('Invalid Token', 403),

  NotFound: new NameValue('Not Found', 404),

  Conflict: new NameValue('Conflict', 409),
  Duplicate: new NameValue('Duplicate', 409),

  TooManyRequests: new NameValue('Too Many Requests', 429),

  Unprocessable: new NameValue('Unprocessable', 422),
  FeatureDisabled: new NameValue('FeatureDisabled', 422),

  /**
   * use specific errors instead
   */
  Unexpected__do_not_use_it: new NameValue('Unexpected', 500),
  // VALIDATE = 'VALIDATE',
  // UPLOAD = 'UPLOAD',
  // SIGN = 'SIGN',
  // BAD_REQUEST = 'BAD_REQUEST',
  // UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
};

/**
 * 该异常构造前端可以进行交互的格式
 */
export class AsunaBaseException extends Error {
  public constructor(
    public httpStatus: HttpStatus,
    public code: string,
    public override name: string,
    public override message: string,
    public localeMessage?: string,
    public details?: any,
  ) {
    super(message);
  }
}

export class AsunaException extends AsunaBaseException {
  public constructor(nameValue: NameValue, message?: string, details?: any) {
    super(nameValue.value, '', nameValue.name, message ?? '', '', details);
  }

  public static of(
    nameValue: NameValue,
    code?: string,
    message?: string,
    localeMessage?: string,
    details?: any,
  ): AsunaException {
    const exception = new AsunaException(nameValue, message, details);
    exception.code = code ?? '';
    exception.localeMessage = localeMessage ?? '';
    return exception;
  }
}

export class UnprocessableException extends AsunaBaseException {
  public constructor(code: string, message: string, details?: any[]) {
    super(AsunaErrorCode.Unprocessable.value, code, AsunaErrorCode.Unprocessable.name, message, '', details);
  }

  public static of(message: string, details?: any[]) {
    return new UnprocessableException('', message, details);
  }
}

export class ErrorException extends AsunaBaseException {
  public constructor(name: string, message?: string, errors?: any) {
    super(AsunaErrorCode.Unprocessable.value, name, AsunaErrorCode.Unprocessable.name, message ?? '', '', errors);
  }
}

export class ValidationException extends AsunaException {
  public constructor(model: string, errors: any) {
    super(AsunaErrorCode.InvalidParameter, `validate '${model}' error`, errors);
  }
}

export enum AsunaExceptionTypes {
  ElementExists = 'ElementExists',
  WrongPassword = 'WrongPassword',
  AuthExpired = 'AuthExpired',
  TenantNeeded = 'TenantNeeded',
  Unpublished = 'Unpublished',
  ResourceLimit = 'ResourceLimit',
  InvalidAccount = 'InvalidAccount',
  AccountExists = 'AccountExists',
  BadRequest = 'BadRequest',
  Unprocessable = 'Unprocessable',
  InvalidToken = 'InvalidToken',
  FormatError = 'FormatError',
  Upload = 'Upload',
}

interface AsunaExceptionOpts {
  code: string;
  nameValue: NameValue;
  message: (...params: any[]) => string;
  localMessage: (...params: any[]) => string;
}

export class AsunaExceptionHelper {
  private static readonly logger = new Logger(resolveModule(fileURLToPath(import.meta.url), this.constructor.name));
  private static registers = {
    [AsunaExceptionTypes.ElementExists]: {
      code: 'E01001',
      nameValue: AsunaErrorCode.Conflict,
      message: (type: string, element: any) => `'${type}' '${r(element)}' already exists.`,
      localMessage: (type: string, element: any) => `'${type}' '${r(element)}' 已存在`,
    },
    [AsunaExceptionTypes.WrongPassword]: {
      code: 'E01002',
      nameValue: AsunaErrorCode.InvalidCredentials,
      message: () => `wrong password`,
      localMessage: () => `密码错误`,
    },
    [AsunaExceptionTypes.InvalidAccount]: {
      code: 'E01003',
      nameValue: AsunaErrorCode.InvalidCredentials,
      message: () => `account not exists or active.`,
      localMessage: () => `账户不存在或不可用`,
    },
    [AsunaExceptionTypes.AccountExists]: {
      code: 'E01004',
      nameValue: AsunaErrorCode.InvalidCredentials,
      message: (email: string, username: string) =>
        `${email ? `email:${email} ` : ''}${username ? `username:${username}` : ''} already exists`,
      localMessage: (email: string, username: string) =>
        `${email ? `邮件:${email} ` : ''}${username ? `用户名:${username}` : ''} 已存在`,
    },
    [AsunaExceptionTypes.Unpublished]: {
      code: 'E01010',
      nameValue: AsunaErrorCode.Unprocessable,
      message: (source: string) => `unpublished resource: ${source}`,
      localMessage: (source: string) => `资源 ${source} 未发布，暂不可用`,
    },
    [AsunaExceptionTypes.ResourceLimit]: {
      code: 'E01011',
      nameValue: AsunaErrorCode.Unprocessable,
      message: (source: string, limit: number) => `${source} reached to limit: ${limit}`,
      localMessage: (source: string, limit: number) => `资源 ${source} 达到限制：${limit}`,
    },
    [AsunaExceptionTypes.AuthExpired]: {
      code: 'E02001',
      nameValue: AsunaErrorCode.InvalidCredentials,
      message: () => `auth token expired`,
      localMessage: () => `认证已过期`,
    },
    [AsunaExceptionTypes.TenantNeeded]: {
      code: 'E03001',
      nameValue: AsunaErrorCode.Unprocessable,
      message: () => `tenant needed`,
      localMessage: () => '未找到必要的 tenant 信息',
    },
    [AsunaExceptionTypes.Upload]: {
      code: 'E04001',
      nameValue: AsunaErrorCode.Unprocessable,
      message: () => `upload file(s) error`,
      localMessage: () => '上传文件失败',
    },
    [AsunaExceptionTypes.FormatError]: {
      code: 'E04002',
      nameValue: AsunaErrorCode.Unprocessable,
      message: () => `format error`,
      localMessage: () => '格式错误',
    },
    [AsunaExceptionTypes.BadRequest]: {
      code: 'E04003',
      nameValue: AsunaErrorCode.BadRequest,
      message: (message: string) => `bad request: ${message}`,
      localMessage: (message: string) => `参数异常：${message}`,
    },
    [AsunaExceptionTypes.InvalidToken]: {
      code: 'E04004',
      nameValue: AsunaErrorCode.InvalidToken,
      message: (message: string) => `invalid token: ${message}`,
      localMessage: (message: string) => `无效的参数：${message}`,
    },
    [AsunaExceptionTypes.Unprocessable]: {
      code: 'E05001',
      nameValue: AsunaErrorCode.Unprocessable,
      message: () => `unprocessable`,
      localMessage: () => `参数或后台异常，无法处理`,
    },
  };

  public static reg(type: string, opts: AsunaExceptionOpts): void {
    if (_.has(this.registers, type)) {
      throw new Error(`'${type}' already exists in asuna exception registers.`);
    }
    _.set(this.registers, type, opts);
  }

  public static genericException<T extends keyof typeof AsunaExceptionHelper.registers>(
    type: T,
    params?: Parameters<(typeof AsunaExceptionHelper.registers)[T]['message']>,
    errors?: any,
  ): AsunaException {
    if (this.registers[type]) {
      const opts = this.registers[type];
      const transformed = _.map(params, (param) => (_.isObject(param) ? JSON.stringify(param) : param));
      return AsunaException.of(
        opts.nameValue,
        opts.code,
        _.spread(opts.message)(transformed),
        _.spread(opts.localMessage)(transformed),
        errors,
      );
    }

    AsunaExceptionHelper.logger.error(`not found '${type}' in asuna exception registers.`);
    return new AsunaException(AsunaErrorCode.Unexpected__do_not_use_it, errors, errors);
  }
}

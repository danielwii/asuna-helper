import { Logger } from '@nestjs/common';

import { ClassTransformOptions, deserialize, plainToInstance } from 'class-transformer';
import {
  registerDecorator,
  validate,
  validateSync,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import _ from 'lodash';
import moment from 'moment';

import { AsunaErrorCode, AsunaException, ValidationException } from './exceptions';
import { r } from './serializer';

import type { ClassType } from './interface';

@ValidatorConstraint({ name: 'exclusiveConstraint', async: false })
export class ExclusiveConstraintValidator implements ValidatorConstraintInterface {
  public defaultMessage = (validationArguments?: ValidationArguments): string =>
    `Exclusive constraint occurred: ${r(validationArguments, { stringify: true })}.`;

  public validate = (_value: any, validationArguments?: ValidationArguments): Promise<boolean> | boolean =>
    _.keys(_.omitBy(validationArguments?.object, _.isNil)).length <= 1;
}

export async function validateObject(object: any): Promise<void> {
  if (!object) return;
  const errors = await validate(object);
  if (errors.length > 0) {
    Logger.warn(`async validate ${r(object)} error: ${r(errors)}`);
    throw new ValidationException(errors.map((error) => error.property).join(','), errors);
  }
}

export function validateObjectSync(object: any): void {
  if (!object) return;
  const errors = validateSync(object);
  if (errors.length > 0) {
    Logger.warn(`#validateObjectSync sync validate ${r(object)} error: ${r(errors)}`);
    throw new AsunaException(AsunaErrorCode.Unprocessable, `invalid object ${r(object, { stringify: true })}`, errors);
  }
}

export function deserializeSafely<T>(
  cls: ClassType<T>,
  json: string | JSON | T,
  options: ClassTransformOptions = { enableCircularCheck: true },
): T | undefined {
  if (!json) return undefined;
  if (json instanceof cls) {
    validateObjectSync(json);
    return json as T;
  }

  let o;
  if (_.isPlainObject(json)) {
    o = plainToInstance(cls, json as JSON, options);
  } else if (_.isString(json)) {
    o = deserialize(cls, json as string, options);
  }

  validateObjectSync(o);
  return o;
}

export function IsDateTimeString({ format }: { format?: string }, validationOptions?: ValidationOptions) {
  return (object: Object, propertyName: string) => {
    registerDecorator({
      name: 'isDateTimeString',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions || { message: 'error date format' },
      validator: {
        validate: (value: any, args: ValidationArguments) => moment(value, format).isValid(),
      },
    });
  };
}

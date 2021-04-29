import _ from 'lodash';
import * as fp from 'lodash/fp';

export class NameValue {
  constructor(public readonly name: string, public readonly value: any) {}
}

export class NameDescValue<T = any> {
  constructor(public readonly name: string, public readonly description: string, public readonly value: T) {}
}

export class NameValueHelper {
  static names = (nameValues: any) => _.map(nameValues, fp.get('name'));

  static values = (nameValues: any) => _.map(nameValues, fp.get('value'));
}

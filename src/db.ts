import { addYears, subYears } from 'date-fns';
import { Between, FindOperator } from 'typeorm';

export function AfterDate(date: Date): FindOperator<any> {
  return Between(date, addYears(date, 100));
}

export function BeforeDate(date: Date): FindOperator<any> {
  return Between(subYears(date, 100), date);
}

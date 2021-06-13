import { addYears, subYears } from 'date-fns';
import { Between, FindConditions, FindOperator } from 'typeorm';

export function AfterDate(date: Date): any {
  return Between(date, addYears(date, 100));
}

export function BeforeDate(date: Date): any {
  return Between(subYears(date, 100), date);
}

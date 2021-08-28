import { formatDistanceToNow, formatRelative } from 'date-fns';
import locale from 'date-fns/locale/zh-CN';
import _ from 'lodash';

export const formatDistanceFrom = (timestamp: number | string | Date): string =>
  timestamp
    ? formatDistanceToNow(_.isNumber(timestamp) || _.isString(timestamp) ? new Date(timestamp) : timestamp, {
        addSuffix: true,
        locale,
      })
    : '';

export const formatRelativeFrom = (timestamp: number | string | Date): string =>
  timestamp
    ? formatRelative(_.isNumber(timestamp) || _.isString(timestamp) ? new Date(timestamp) : timestamp, new Date(), {
        locale,
      })
    : '';

export const formatDateFrom = (timestamp: number | string | Date): string =>
  timestamp ? `${formatDistanceFrom(timestamp)}, ${formatRelativeFrom(timestamp)}` : '';

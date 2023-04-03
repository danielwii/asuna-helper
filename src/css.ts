import classnames from 'classnames';
import { oneLine } from 'common-tags';

export const cx = (...args: any[]) => oneLine(classnames(...args));

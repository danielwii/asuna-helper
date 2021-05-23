import classnames, { Argument } from 'classnames';
import { oneLine } from 'common-tags';

export const cx = (...args: Argument[]) => oneLine(classnames(...args));

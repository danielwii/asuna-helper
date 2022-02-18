import { nanoid } from 'nanoid';

export function random(length = 9): string {
  return new Array(Math.ceil(length / 9))
    .fill(0)
    .map(() => nanoid())
    .join('')
    .slice(0, length);
}

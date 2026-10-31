import { timingSafeEqual } from 'node:crypto';

/** Compares two secrets without leaking, through timing, how much of one matched the other. */
export function constantTimeEquals(presented: string | null | undefined, expected: string | null | undefined): boolean {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

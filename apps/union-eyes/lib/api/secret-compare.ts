import { createHash, timingSafeEqual } from 'node:crypto'

/** Constant-time secret comparison; hashing first makes unequal lengths safe to compare. */
export function secretsEqual(provided: string, expected: string): boolean {
  if (!expected) return false
  const left = createHash('sha256').update(provided).digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right)
}

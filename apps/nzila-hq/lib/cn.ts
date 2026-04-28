/**
 * Tiny class-name combinator. No clsx/cva dep — keeps the bundle lean.
 * Skips falsy values, joins with single space.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

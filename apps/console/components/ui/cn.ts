/**
 * Tiny class-name combinator.
 *
 * Avoids pulling in clsx/tailwind-merge — Console keeps zero new
 * runtime deps. Falsy values are dropped, arrays are flattened one level.
 */
export function cn(...args: Array<string | false | null | undefined | 0>): string {
  const out: string[] = []
  for (const a of args) {
    if (!a) continue
    out.push(a)
  }
  return out.join(' ')
}

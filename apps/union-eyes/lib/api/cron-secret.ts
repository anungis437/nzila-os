/**
 * The one definition of how a scheduled job presents its secret and how it is checked.
 *
 * Three places used to decide this separately and disagreed: withApi (x-cron-secret or a bearer token, CRON_SECRET_KEY then
 * CRON_SECRET, constant time), the edge check in proxy.ts (x-cron-secret only, CRON_SECRET only, a plain !== comparison) and
 * the rewards route (a bearer token only, CRON_SECRET only). A job that sent the header the scheduler contract defines was
 * rejected by the route behind the edge check, and the edge comparison leaked timing. All three now use this module.
 */

/** The secret a scheduled job presented: the x-cron-secret header, otherwise a bearer token. Empty when none was sent. */
export function presentedCronSecret(headers: Pick<Headers, 'get'>): string {
  const header = headers.get('x-cron-secret')
  if (header) return header
  const authorization = headers.get('authorization')
  return authorization?.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
}

/** The configured secret: CRON_SECRET_KEY, otherwise CRON_SECRET. Empty when neither is set, which never matches anything. */
export function expectedCronSecret(env: Record<string, string | undefined> = process.env): string {
  return env.CRON_SECRET_KEY || env.CRON_SECRET || ''
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

/**
 * Constant-time comparison that runs on any runtime (including the edge, which has no node:crypto): both sides are hashed so
 * the comparison is over equal-length digests, and every byte is compared. An unset secret never matches.
 */
export async function cronSecretMatches(
  headers: Pick<Headers, 'get'>,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const expected = expectedCronSecret(env)
  if (!expected) return false
  const [left, right] = await Promise.all([digest(presentedCronSecret(headers)), digest(expected)])
  let difference = 0
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i]
  return difference === 0
}

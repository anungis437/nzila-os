import { verifyTurnstileToken } from '@/lib/icra/turnstile'

export type BotChallengeVerdict =
  | { ok: true }
  | { ok: false; status: 403 | 503; code: 'BOT_CHALLENGE_FAILED' | 'BOT_CHALLENGE_UNAVAILABLE' | 'BOT_CHALLENGE_NOT_CONFIGURED'; message: string }

/**
 * The bot challenge of a public write. A rate limit keyed on an address bounds an honest client and little else, so a route that
 * creates records or payment sessions for an anonymous caller also asks for a Cloudflare Turnstile token.
 *
 * Production fails closed: with no secret configured the route refuses (503) rather than quietly running unchallenged, and a
 * challenge that cannot be reached is a refusal. Outside production an unconfigured challenge is open, as the other Turnstile
 * surfaces already treat it, so development and tests need no key.
 */
export async function requireBotChallenge(
  token: string | null | undefined,
  remoteIp: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<BotChallengeVerdict> {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.NODE_ENV === 'production') {
      return { ok: false, status: 503, code: 'BOT_CHALLENGE_NOT_CONFIGURED', message: 'This form is temporarily unavailable.' }
    }
    return { ok: true }
  }
  const result = await verifyTurnstileToken(token, remoteIp)
  if (result.success) return { ok: true }
  const unreachable = (result.errorCodes ?? []).some((code) => code === 'network-error' || code.startsWith('http-'))
  return unreachable
    ? { ok: false, status: 503, code: 'BOT_CHALLENGE_UNAVAILABLE', message: 'The verification service is unavailable. Please try again.' }
    : { ok: false, status: 403, code: 'BOT_CHALLENGE_FAILED', message: 'Verification failed. Please try again.' }
}

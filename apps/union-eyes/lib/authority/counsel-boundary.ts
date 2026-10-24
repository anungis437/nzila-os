/**
 * Authority Kernel — counsel-side trust boundary: assertion envelope validation.
 *
 * Counsel works in a SEPARATE system (external counsel / WorkAid / Clio coexistence). The union can never create
 * counsel's acts; it can only RECEIVE them, each carried by an assertion that the counsel-side system signed and that
 * a deployment-supplied verifier authenticated. Signature and key management belong to that verifier and are NOT
 * implemented here. This module fixes everything else the kernel will accept about such an assertion, so every
 * verifier implementation is held to the same envelope:
 *
 *   - issued by an explicitly allowed counsel-side issuer, for exactly this audience;
 *   - bound to exactly one organization and one matter;
 *   - short-lived (<= 5 minutes), not issued in the future, and single-use (nonce);
 *   - naming a counsel subject that is a valid principal id.
 *
 * Anything missing, malformed or ambiguous is a refusal.
 */
import { isPrincipalId } from './store/executor'

export const COUNSEL_AUDIENCE = 'union-eyes/counsel-intake'
export const COUNSEL_ASSERTION_MAX_LIFETIME_MS = 5 * 60_000
export const COUNSEL_CLOCK_SKEW_MS = 60_000

export interface CounselAssertion {
  issuer: string
  audience: string
  /** The counsel-side principal. Never a union user id. */
  subject: string
  organizationId: string
  matterId: string
  nonce: string
  issuedAt: Date
  expiresAt: Date
}

export type CounselAssertionResult = { ok: true; subject: string } | { ok: false; reason: string }

export function validateCounselAssertion(
  assertion: CounselAssertion,
  expected: { allowedIssuers: readonly string[]; organizationId: string; matterId: string; now: Date },
  usedNonces: ReadonlySet<string>,
): CounselAssertionResult {
  const no = (reason: string): CounselAssertionResult => ({ ok: false, reason })
  if (!assertion || typeof assertion !== 'object') return no('no assertion')
  if (expected.allowedIssuers.length === 0 || !expected.allowedIssuers.includes(assertion.issuer)) return no('issuer is not an allowed counsel-side issuer')
  if (assertion.audience !== COUNSEL_AUDIENCE) return no('wrong audience')
  if (assertion.organizationId !== expected.organizationId) return no('bound to a different organization')
  if (assertion.matterId !== expected.matterId) return no('bound to a different matter')
  if (!isPrincipalId(assertion.subject)) return no('subject is not a valid principal id')
  if (typeof assertion.nonce !== 'string' || assertion.nonce.length < 16) return no('nonce is missing or too short')
  if (usedNonces.has(assertion.nonce)) return no('nonce already used')
  const issued = assertion.issuedAt?.getTime()
  const expires = assertion.expiresAt?.getTime()
  if (!Number.isFinite(issued) || !Number.isFinite(expires)) return no('invalid validity window')
  const now = expected.now.getTime()
  if (issued > now + COUNSEL_CLOCK_SKEW_MS) return no('issued in the future')
  if (expires <= now) return no('expired')
  if (expires <= issued || expires - issued > COUNSEL_ASSERTION_MAX_LIFETIME_MS) return no('lifetime exceeds the maximum')
  return { ok: true, subject: assertion.subject }
}

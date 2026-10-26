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

// ── Counsel authentication: envelope + signature + single use ───────────────

/** Signature and key management belong to the counsel-side trust provider. This port only vouches for the signed bytes. */
export interface CounselAssertionVerifier {
  /** True only if the assertion is genuinely signed by its declared issuer's current key. */
  verifySignature(assertion: CounselAssertion): Promise<boolean>
}

/** Durable, atomic, single-use nonce register. Production implementations MUST be shared across instances. */
export interface CounselNonceStore {
  /** Returns true exactly once per nonce, atomically. A second call for the same nonce returns false. */
  consume(nonce: string, expiresAt: Date): Promise<boolean>
}

/**
 * Authenticates a counsel assertion: the envelope is valid, the issuer's signature verifies and the nonce is consumed
 * exactly once. The nonce is consumed LAST so a rejected assertion cannot burn a legitimate one, and any thrown
 * error is a refusal.
 */
export async function authenticateCounselAssertion(
  assertion: CounselAssertion,
  expected: { allowedIssuers: readonly string[]; organizationId: string; matterId: string; now: Date },
  ports: { verifier?: CounselAssertionVerifier; nonces?: CounselNonceStore },
): Promise<CounselAssertionResult> {
  const no = (reason: string): CounselAssertionResult => ({ ok: false, reason })
  if (!ports.verifier) return no('no counsel assertion verifier is configured')
  if (!ports.nonces) return no('no durable nonce store is configured')
  const envelope = validateCounselAssertion(assertion, expected, new Set())
  if (!envelope.ok) return envelope
  try {
    if ((await ports.verifier.verifySignature(assertion)) !== true) return no('signature did not verify')
    if ((await ports.nonces.consume(assertion.nonce, assertion.expiresAt)) !== true) return no('nonce already used')
  } catch {
    return no('counsel authentication failed closed')
  }
  return { ok: true, subject: assertion.subject }
}

// ── Counsel capacity: separate capacity, conflicts, information barrier ─────

/**
 * Counsel may be an external lawyer or a union member acting in a SEPARATE counsel capacity. Being a union member is
 * neither disqualifying nor sufficient: what matters is whether the person's union roles conflict with the matter and
 * whether an institution-recorded engagement establishes the separate capacity and an information barrier.
 */
export type CounselCapacityKind = 'external_counsel' | 'member_counsel'

export interface CounselEngagement {
  engagementId: string
  organizationId: string
  matterId: string
  counselUserId: string
  capacity: CounselCapacityKind
  /** Institution-recorded ethical wall between the person's counsel work and their union roles. */
  informationBarrier: boolean
  effectiveAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

export interface CounselConflictFacts {
  userId: string
  memberUserId: string
  referrerUserId: string
  adverseUserIds: readonly string[]
  /** Capacities across every membership row the person holds in this organization, whatever its status. Empty if none. */
  unionCapacities: readonly string[]
  holdsLiveMandate: boolean
  hasCaseRelationship: boolean
}

export type CounselCapacityResult = { ok: true; capacity: CounselCapacityKind } | { ok: false; code: string; reason: string }

export function evaluateCounselCapacity(facts: CounselConflictFacts, engagement: CounselEngagement | null, org: string, matterId: string, now: Date): CounselCapacityResult {
  const no = (code: string, reason: string): CounselCapacityResult => ({ ok: false, code, reason })
  if (facts.userId === facts.memberUserId || facts.userId === facts.referrerUserId) return no('COUNSEL_IS_PARTY', 'counsel cannot be the member or the union referrer of this matter')
  if (facts.adverseUserIds.includes(facts.userId)) return no('COUNSEL_ADVERSE', 'counsel is a party adverse to the underlying case')

  const live = (e: CounselEngagement): boolean =>
    e.organizationId === org && e.matterId === matterId && e.counselUserId === facts.userId &&
    e.revokedAt === null && e.effectiveAt.getTime() <= now.getTime() && (e.expiresAt === null || e.expiresAt.getTime() > now.getTime())

  if (facts.unionCapacities.length === 0) {
    if (engagement && !live(engagement)) return no('COUNSEL_ENGAGEMENT_INVALID', 'the engagement is not live for this matter')
    return { ok: true, capacity: 'external_counsel' }
  }

  if (facts.unionCapacities.some((c) => c !== 'member')) return no('COUNSEL_CONFLICTING_CAPACITY', 'the person holds a union role that conflicts with acting as counsel')
  if (facts.holdsLiveMandate) return no('COUNSEL_HOLDS_UNION_MANDATE', 'the person holds a live union mandate')
  if (facts.hasCaseRelationship) return no('COUNSEL_CASE_RELATIONSHIP', 'the person has a live relationship to the underlying case')
  if (!engagement || engagement.capacity !== 'member_counsel' || !live(engagement)) {
    return no('COUNSEL_NEEDS_SEPARATE_CAPACITY', 'a union member may act as counsel only under a live, matter-bound member-counsel engagement')
  }
  if (engagement.informationBarrier !== true) return no('COUNSEL_NO_INFORMATION_BARRIER', 'the engagement records no information barrier')
  return { ok: true, capacity: 'member_counsel' }
}

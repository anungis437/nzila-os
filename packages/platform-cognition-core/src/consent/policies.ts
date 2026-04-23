/**
 * @nzila/platform-cognition-core/consent — Policy primitives
 *
 * @module @nzila/platform-cognition-core/consent/policies
 */
import { consentPolicySchema } from '../schemas'
import type {
  ConsentPolicy,
  ConsentZone,
  CognitionSubject,
  Jurisdiction,
  MemoryKind,
} from '../types'
import { nowISO } from '../utils'

/**
 * Conservative defaults: operational zone only, episodic memory only,
 * 90-day retention. Designed so a missing/expired policy still permits the
 * service-delivery minimum while denying analytics/training automatically.
 */
export const RESTRICTIVE_DEFAULT_POLICY = (
  subject: CognitionSubject,
  jurisdiction: Jurisdiction = 'OTHER',
): ConsentPolicy => ({
  subject,
  allowedZones: ['operational'],
  allowedKinds: ['episodic'],
  retentionDays: 90,
  excludedTags: [],
  jurisdiction,
  recordedAt: nowISO(),
})

export function buildConsentPolicy(input: {
  subject: CognitionSubject
  allowedZones?: readonly ConsentZone[]
  allowedKinds?: readonly MemoryKind[]
  retentionDays?: number
  excludedTags?: readonly string[]
  jurisdiction?: Jurisdiction
  recordedAt?: string
  lastConfirmedAt?: string
}): ConsentPolicy {
  const policy: ConsentPolicy = {
    subject: input.subject,
    allowedZones: input.allowedZones ?? ['operational'],
    allowedKinds: input.allowedKinds ?? ['episodic'],
    retentionDays: input.retentionDays ?? 90,
    excludedTags: input.excludedTags ?? [],
    jurisdiction: input.jurisdiction ?? 'OTHER',
    recordedAt: input.recordedAt ?? nowISO(),
    lastConfirmedAt: input.lastConfirmedAt,
  }
  return consentPolicySchema.parse(policy) as ConsentPolicy
}

/**
 * Returns true when `inner` is fully covered by `outer` — used to compare a
 * proposed inference's required zones/kinds against the subject's policy.
 */
export function policyCovers(
  outer: ConsentPolicy,
  required: { zones: readonly ConsentZone[]; kinds: readonly MemoryKind[] },
): { covered: boolean; missingZones: ConsentZone[]; missingKinds: MemoryKind[] } {
  const allowedZ = new Set(outer.allowedZones)
  const allowedK = new Set(outer.allowedKinds)
  const missingZones = required.zones.filter((z) => !allowedZ.has(z))
  const missingKinds = required.kinds.filter((k) => !allowedK.has(k))
  return {
    covered: missingZones.length === 0 && missingKinds.length === 0,
    missingZones,
    missingKinds,
  }
}

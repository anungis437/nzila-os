/**
 * @nzila/platform-cognition-core/consent — Jurisdiction profiles
 *
 * Each profile encodes the *minimum* additional restrictions to apply on top
 * of a subject's stated policy. The gate intersects the policy with the
 * jurisdiction profile, so the more conservative side always wins.
 *
 * These are operational defaults — they are not legal advice. They are
 * deliberately conservative: when in doubt the gate denies.
 *
 * @module @nzila/platform-cognition-core/consent/jurisdiction
 */
import type { ConsentZone, Jurisdiction, MemoryKind } from '../types'

export interface JurisdictionProfile {
  readonly maxRetentionDays: number
  readonly defaultDeniedZones: readonly ConsentZone[]
  readonly defaultDeniedKinds: readonly MemoryKind[]
  /** Tag patterns that must always be excluded (lowercased substring match). */
  readonly mandatoryExcludedTagFragments: readonly string[]
}

const DEFAULT: JurisdictionProfile = {
  maxRetentionDays: 365 * 2,
  defaultDeniedZones: [],
  defaultDeniedKinds: [],
  mandatoryExcludedTagFragments: ['ssn', 'passport', 'medical-record-number'],
}

const PROFILES: Record<Jurisdiction, JurisdictionProfile> = {
  // Quebec Law 25 + PIPEDA: training/cross-product require explicit + renewable consent.
  CA: {
    maxRetentionDays: 365 * 2,
    defaultDeniedZones: ['training'],
    defaultDeniedKinds: [],
    mandatoryExcludedTagFragments: ['sin', 'health-card', 'ramq', 'medical-record-number'],
  },
  // GDPR: stricter on profiling and cross-context. Training requires lawful basis.
  EU: {
    maxRetentionDays: 365,
    defaultDeniedZones: ['training', 'cross_product'],
    defaultDeniedKinds: [],
    mandatoryExcludedTagFragments: ['national-id', 'health-record', 'biometric'],
  },
  US: {
    maxRetentionDays: 365 * 3,
    defaultDeniedZones: [],
    defaultDeniedKinds: [],
    mandatoryExcludedTagFragments: ['ssn', 'medical-record-number'],
  },
  AF: {
    // Treat conservatively pending per-country profiles.
    maxRetentionDays: 365,
    defaultDeniedZones: ['training', 'cross_product'],
    defaultDeniedKinds: [],
    mandatoryExcludedTagFragments: ['national-id', 'health-record'],
  },
  OTHER: DEFAULT,
}

export function jurisdictionProfile(j: Jurisdiction): JurisdictionProfile {
  return PROFILES[j]
}

export function effectiveExcludedTags(
  policyExcluded: readonly string[],
  profile: JurisdictionProfile,
): string[] {
  const set = new Set(policyExcluded.map((t) => t.toLowerCase()))
  for (const fragment of profile.mandatoryExcludedTagFragments) {
    set.add(fragment)
  }
  return [...set]
}

/**
 * Cross-App Operational Cadence
 *
 * Doctrine: docs/nzila-operational-convergence/cross-app-operational-cadence.md
 */

export const CANONICAL_CADENCE_DOMAINS = [
  'governance-posture-refresh',
  'stabilization-signal-refresh',
  'continuity-posture-refresh',
  'executive-briefing',
  'attestation-lineage',
  'review-session',
  'rollout-window',
  'onboarding-cohort',
  'modernization-pacing',
] as const
export type CanonicalCadenceDomain = (typeof CANONICAL_CADENCE_DOMAINS)[number]

export interface CadenceContract {
  readonly domain: CanonicalCadenceDomain
  /** Minimum interval between automated refreshes, in milliseconds. */
  readonly minIntervalMs: number
  /** Whether this surface auto-refreshes at all. */
  readonly autoRefresh: boolean
  /** One-sentence calm description for surface help. */
  readonly description: string
}

const ONE_MIN = 60_000
const FIVE_MIN = 5 * ONE_MIN

const CADENCE: Readonly<Record<CanonicalCadenceDomain, CadenceContract>> = {
  'governance-posture-refresh': {
    domain: 'governance-posture-refresh',
    minIntervalMs: ONE_MIN,
    autoRefresh: true,
    description: 'Governance posture refreshes no faster than once per minute.',
  },
  'stabilization-signal-refresh': {
    domain: 'stabilization-signal-refresh',
    minIntervalMs: FIVE_MIN,
    autoRefresh: true,
    description: 'Stabilization signals refresh no faster than once every five minutes.',
  },
  'continuity-posture-refresh': {
    domain: 'continuity-posture-refresh',
    minIntervalMs: FIVE_MIN,
    autoRefresh: true,
    description: 'Continuity posture refreshes no faster than once every five minutes.',
  },
  'executive-briefing': {
    domain: 'executive-briefing',
    minIntervalMs: 0,
    autoRefresh: false,
    description: 'Executive briefings load on request; never auto-pushed.',
  },
  'attestation-lineage': {
    domain: 'attestation-lineage',
    minIntervalMs: 0,
    autoRefresh: false,
    description: 'Attestation lineage loads on request; never auto-streamed.',
  },
  'review-session': {
    domain: 'review-session',
    minIntervalMs: 0,
    autoRefresh: false,
    description: 'Review sessions request a single deliberate decision per session.',
  },
  'rollout-window': {
    domain: 'rollout-window',
    minIntervalMs: 0,
    autoRefresh: false,
    description: 'Rollout windows are continuity-safe; never accelerated on warming bandings.',
  },
  'onboarding-cohort': {
    domain: 'onboarding-cohort',
    minIntervalMs: 0,
    autoRefresh: false,
    description: 'Onboarding cohorts are continuity-bounded.',
  },
  'modernization-pacing': {
    domain: 'modernization-pacing',
    minIntervalMs: FIVE_MIN,
    autoRefresh: true,
    description: 'Modernization pacing refreshes on the stabilization cadence; pauses on concerning bandings.',
  },
}

/**
 * Resolve the canonical cadence contract for a domain. Throws if the
 * domain is not canonical — silent acceptance is refused.
 */
export function cadenceFor(domain: CanonicalCadenceDomain): CadenceContract {
  const contract = CADENCE[domain]
  if (!contract) {
    throw new Error(`non_canonical_cadence_domain: "${domain}"`)
  }
  return contract
}

export const CANONICAL_CADENCE = CADENCE

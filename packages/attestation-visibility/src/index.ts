/**
 * @nzila/attestation-visibility
 *
 * Viewer-facing projections of runtime attestation envelopes. Each
 * helper is pure and side-effect-free; rendering is a host concern.
 */
import { z } from 'zod'

export const ATTESTATION_VERDICTS = ['verified', 'partial', 'rejected', 'unknown'] as const
export type AttestationVerdict = (typeof ATTESTATION_VERDICTS)[number]

export const ATTESTATION_CLASSES = [
  'release',
  'deployment-legitimacy',
  'environment',
  'pilot-legitimacy',
  'doctrine-compliance',
  'ai-governance',
] as const
export type AttestationClass = (typeof ATTESTATION_CLASSES)[number]

export const attestationEnvelopeProjectionSchema = z
  .object({
    contentHash: z.string().min(1),
    class: z.enum(ATTESTATION_CLASSES),
    verdict: z.enum(ATTESTATION_VERDICTS),
    issuedAt: z.string().datetime(),
    issuer: z.string().min(1),
    releaseId: z.string().optional(),
    environmentId: z.string().optional(),
    citedEvidence: z
      .array(z.object({ kind: z.string().min(1), contentHash: z.string().min(1) }))
      .default([]),
    supersedes: z.string().optional(),
    interpretation: z.string().min(1).max(280),
    accessClass: z.enum([
      'platform-only',
      'governance-forum',
      'product-team',
      'external-attestation',
    ]),
  })
  .strict()

export type AttestationEnvelopeProjection = z.infer<
  typeof attestationEnvelopeProjectionSchema
>

/**
 * Project a viewer-safe attestation by stripping any unknown internals
 * and validating the resulting shape. Refuses to lift an unknown
 * verdict into a higher one.
 */
export function projectAttestationForView(
  envelope: Readonly<Record<string, unknown>>,
): AttestationEnvelopeProjection {
  return attestationEnvelopeProjectionSchema.parse(envelope)
}

/**
 * Build a chronological release lineage from a set of attestations
 * sharing a release id. Append-only; mutation is impossible.
 */
export function buildReleaseLineage(
  attestations: readonly AttestationEnvelopeProjection[],
): readonly AttestationEnvelopeProjection[] {
  return [...attestations].sort((a, b) => (a.issuedAt < b.issuedAt ? -1 : 1))
}

export interface LegitimacySummary {
  readonly releaseId: string
  readonly environmentId: string
  readonly verdict: AttestationVerdict
  readonly interpretation: string
  readonly attestationContentHash: string
}

/**
 * Build a one-line legitimacy summary. REFUSES to silently downgrade
 * a `rejected` verdict into anything weaker.
 */
export function buildLegitimacySummary(
  attestation: AttestationEnvelopeProjection,
): LegitimacySummary {
  if (!attestation.releaseId || !attestation.environmentId) {
    throw new Error('legitimacy_summary_requires_release_and_environment')
  }
  return {
    releaseId: attestation.releaseId,
    environmentId: attestation.environmentId,
    verdict: attestation.verdict,
    interpretation: attestation.interpretation,
    attestationContentHash: attestation.contentHash,
  }
}

export interface TopologyComparisonResult {
  readonly verdict: AttestationVerdict
  readonly missing: readonly string[]
  readonly unexpected: readonly string[]
  readonly interpretation: string
}

/**
 * Compare an observed topology against an expected manifest topology.
 * Returns a banded verdict; never returns a numeric score.
 */
export function compareTopology(
  observed: readonly string[],
  expected: readonly string[],
): TopologyComparisonResult {
  const observedSet = new Set(observed)
  const expectedSet = new Set(expected)
  const missing = [...expectedSet].filter((x) => !observedSet.has(x))
  const unexpected = [...observedSet].filter((x) => !expectedSet.has(x))
  let verdict: AttestationVerdict
  let interpretation: string
  if (missing.length === 0 && unexpected.length === 0) {
    verdict = 'verified'
    interpretation = 'Observed topology matches the manifest.'
  } else if (missing.length === 0) {
    verdict = 'partial'
    interpretation = 'Observed topology contains components beyond the manifest.'
  } else {
    verdict = 'rejected'
    interpretation = 'Observed topology is missing manifest-required components.'
  }
  return { verdict, missing, unexpected, interpretation }
}

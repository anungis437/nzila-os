/**
 * @nzila/governance-operations — Interpretation helpers
 *
 * Calm, single-sentence interpretations of bandings, verdicts, and
 * envelopes. Language NEVER escalates on repeat. Words like "critical"
 * and "urgent" are reserved for actual `critical` events with a verified
 * blocking decision.
 *
 * @module @nzila/governance-operations/interpret
 */
import type { PostureBand, Verdict } from './posture'

export function interpretBanding(banding: PostureBand): string {
  switch (banding) {
    case 'stable':
      return 'Posture is stable.'
    case 'warming':
      return 'Posture is warming; monitor on the next cadence.'
    case 'concerning':
      return 'Posture is concerning; consider extending cadence and reducing rollout density.'
    case 'destabilizing':
      return 'Posture is destabilizing; review with the governance forum before further changes.'
  }
}

export function interpretVerdict(verdict: Verdict): string {
  switch (verdict) {
    case 'verified':
      return 'Verified against the manifest and isolation invariants.'
    case 'partial':
      return 'Partially verified; some inputs were not available or were inconclusive.'
    case 'rejected':
      return 'Rejected; the release does not satisfy at least one legitimacy precondition.'
    case 'unknown':
      return 'Unknown; legitimacy could not be determined.'
  }
}

export interface EnvelopeLike {
  readonly type: string
  readonly severity: 'info' | 'warning' | 'critical'
  readonly decision?: string
  readonly doctrineCitations?: readonly { readonly document: string }[]
}

export function interpretEnvelope(envelope: EnvelopeLike): string {
  const cite =
    envelope.doctrineCitations?.[0]?.document
      ? ` (doctrine: ${envelope.doctrineCitations[0].document})`
      : ''
  const decision = envelope.decision ? ` Decision: ${envelope.decision}.` : ''
  switch (envelope.severity) {
    case 'critical':
      return `A blocking ${envelope.type} occurred.${decision}${cite}`
    case 'warning':
      return `An advisory ${envelope.type} was recorded.${decision}${cite}`
    case 'info':
    default:
      return `A routine ${envelope.type} was recorded.${decision}${cite}`
  }
}

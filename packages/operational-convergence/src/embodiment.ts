/**
 * Governance Embodiment Consistency
 *
 * Doctrine: docs/nzila-operational-convergence/governance-embodiment-consistency.md
 */

export interface EmbodimentRequirement {
  readonly id: string
  readonly description: string
}

const EMBODIMENT_REQUIREMENTS: readonly EmbodimentRequirement[] = [
  { id: 'posture-card-uniform', description: 'Posture cards reuse the canonical primitive (banded reading + cited interpretation).' },
  { id: 'banding-text-first', description: 'Bandings render as text first, colour second.' },
  { id: 'verdict-text-first', description: 'Verdicts render as text first; rejected is rendered honestly; silent downgrade is refused.' },
  { id: 'doctrine-citation-visible', description: 'Doctrine citations are visible on every governance card.' },
  { id: 'content-hash-visible', description: 'Attestation content hashes are mono-font and always visible.' },
  { id: 'append-only-ledger', description: 'Decision ledger is append-only; supersession is the only correction mechanism.' },
  { id: 'cadence-bound-refresh', description: 'Refresh intervals respect the canonical cadence registry.' },
  { id: 'no-routine-motion', description: 'No animation in routine surfaces; opacity transitions only for cadence refresh.' },
  { id: 'no-composite-scoring', description: 'No composite governance scores anywhere in the UI.' },
  { id: 'no-realtime-feed', description: 'No real-time governance event feeds.' },
]

export function getGovernanceEmbodimentChecklist(): readonly EmbodimentRequirement[] {
  return EMBODIMENT_REQUIREMENTS
}

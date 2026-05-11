/**
 * Shared Operational Language System
 *
 * A term may never change meaning between apps.
 * Doctrine: docs/nzila-operational-convergence/shared-operational-language-system.md
 */

export interface CanonicalTerm {
  readonly term: string
  readonly meaning: string
}

export const CANONICAL_GLOSSARY: readonly CanonicalTerm[] = [
  { term: 'governance', meaning: 'The cited authority under doctrine to make institutional decisions.' },
  { term: 'review', meaning: 'An append-only, doctrine-cited recording of an institutional decision.' },
  { term: 'stabilization', meaning: 'A slowing or pausing of change to preserve continuity.' },
  { term: 'continuity', meaning: 'System-scoped operational integrity over time.' },
  { term: 'rollout', meaning: 'A pacing-bounded change to a deployed environment.' },
  { term: 'intelligence', meaning: 'Read-only interpretive material; never operational instruction.' },
  { term: 'legitimacy', meaning: 'A release × environment × verdict statement bound to cited evidence.' },
  { term: 'evidence', meaning: 'Content-hash-anchored material cited by a decision or attestation.' },
  { term: 'posture', meaning: 'A banded reading of operational state at a moment in time.' },
  { term: 'attestation', meaning: 'A signed envelope binding a class, verdict, and cited evidence.' },
  { term: 'modernization', meaning: 'Change executed under continuity discipline.' },
  { term: 'operational readiness', meaning: 'The banded readiness of a system to absorb a planned change.' },
]

export const REFUSED_VOCABULARY: readonly string[] = [
  'score',
  'rating',
  'ranking',
  'real-time',
  'live alert',
  'urgent',
  'emergency',
  'productivity',
  'performance',
]

/**
 * Resolve the canonical meaning of a term. Throws if the term is not
 * canonical — silent acceptance is the failure mode this refuses.
 */
export function defineTerm(term: string): CanonicalTerm {
  const found = CANONICAL_GLOSSARY.find((t) => t.term === term.toLowerCase())
  if (!found) {
    throw new Error(`non_canonical_term: "${term}" is not in the canonical glossary`)
  }
  return found
}

/** Returns true when the supplied phrase contains refused vocabulary. */
export function containsRefusedVocabulary(phrase: string): boolean {
  const lower = phrase.toLowerCase()
  return REFUSED_VOCABULARY.some((w) => lower.includes(w))
}

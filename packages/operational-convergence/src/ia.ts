/**
 * Canonical Information Architecture
 *
 * The same concept lives at the same address across every Nzila app.
 * Doctrine: docs/nzila-operational-convergence/canonical-information-architecture.md
 */

export const CANONICAL_GROUPS = [
  'work',
  'priority',
  'outcomes',
  'intelligence',
  'governance',
  'rollout',
  'evidence',
  'attestations',
] as const
export type CanonicalGroup = (typeof CANONICAL_GROUPS)[number]

export const CANONICAL_ROUTE_SEGMENTS: Readonly<Record<CanonicalGroup, readonly string[]>> = {
  work: ['/work'],
  priority: ['/priority'],
  outcomes: ['/outcomes'],
  intelligence: ['/intelligence'],
  governance: [
    '/governance',
    '/governance/review',
    '/governance/continuity',
    '/governance/legitimacy',
    '/governance/stabilization',
  ],
  rollout: ['/rollout'],
  evidence: ['/evidence'],
  attestations: ['/attestations'],
}

export interface IATreeNode {
  readonly group: CanonicalGroup
  readonly label: string
  readonly description: string
  readonly routes: readonly string[]
}

const IA_TREE: readonly IATreeNode[] = [
  {
    group: 'work',
    label: 'Work',
    description: "The operator's outstanding institutional acts.",
    routes: CANONICAL_ROUTE_SEGMENTS.work,
  },
  {
    group: 'priority',
    label: 'Priority',
    description: 'Bounded, ordered focus for the cycle.',
    routes: CANONICAL_ROUTE_SEGMENTS.priority,
  },
  {
    group: 'outcomes',
    label: 'Outcomes',
    description: 'What the operator is accountable for.',
    routes: CANONICAL_ROUTE_SEGMENTS.outcomes,
  },
  {
    group: 'intelligence',
    label: 'Intelligence',
    description: 'Read-only interpretive surfaces.',
    routes: CANONICAL_ROUTE_SEGMENTS.intelligence,
  },
  {
    group: 'governance',
    label: 'Governance',
    description: 'Posture, doctrine, cited decisions.',
    routes: CANONICAL_ROUTE_SEGMENTS.governance,
  },
  {
    group: 'rollout',
    label: 'Rollout',
    description: 'Pacing-bounded change.',
    routes: CANONICAL_ROUTE_SEGMENTS.rollout,
  },
  {
    group: 'evidence',
    label: 'Evidence',
    description: 'Read-only, content-hash citable.',
    routes: CANONICAL_ROUTE_SEGMENTS.evidence,
  },
  {
    group: 'attestations',
    label: 'Attestations',
    description: 'Content-hash anchored proof.',
    routes: CANONICAL_ROUTE_SEGMENTS.attestations,
  },
]

export function getCanonicalIATree(): readonly IATreeNode[] {
  return IA_TREE
}

export interface OperatorPathwayStep {
  readonly group: CanonicalGroup
  readonly act: string
}

const CANONICAL_OPERATOR_PATHWAY: readonly OperatorPathwayStep[] = [
  { group: 'governance', act: 'read posture' },
  { group: 'governance', act: 'interpret continuity' },
  { group: 'governance', act: 'review legitimacy' },
  { group: 'governance', act: 'record decision' },
]

export function getCanonicalOperatorPathway(): readonly OperatorPathwayStep[] {
  return CANONICAL_OPERATOR_PATHWAY
}

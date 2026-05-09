/**
 * Executive Cognitive Consistency
 *
 * Doctrine: docs/nzila-operational-convergence/executive-cognitive-consistency.md
 */

export interface ExecutiveSurfaceContract {
  readonly surfaceId: string
  readonly maxCards: number
  readonly maxPrimaryActions: number
  readonly maxDecisionsPerSession: number
  readonly readingTimeBudgetSeconds: number
  readonly autoRefresh: false
  readonly description: string
}

const CONTRACTS: Readonly<Record<string, ExecutiveSurfaceContract>> = {
  'executive-briefing': {
    surfaceId: 'executive-briefing',
    maxCards: 6,
    maxPrimaryActions: 1,
    maxDecisionsPerSession: 1,
    readingTimeBudgetSeconds: 120,
    autoRefresh: false,
    description: 'Executive briefing — bounded reading, one decision per session.',
  },
  'governance-overview': {
    surfaceId: 'governance-overview',
    maxCards: 6,
    maxPrimaryActions: 1,
    maxDecisionsPerSession: 1,
    readingTimeBudgetSeconds: 120,
    autoRefresh: false,
    description: 'Governance overview — posture cards + latest legitimacy + sparse timeline.',
  },
  'continuity-briefing': {
    surfaceId: 'continuity-briefing',
    maxCards: 4,
    maxPrimaryActions: 1,
    maxDecisionsPerSession: 1,
    readingTimeBudgetSeconds: 120,
    autoRefresh: false,
    description: 'Continuity briefing — banded reading, advisory, decision.',
  },
}

const DEFAULT_CONTRACT: ExecutiveSurfaceContract = {
  surfaceId: 'default-executive',
  maxCards: 6,
  maxPrimaryActions: 1,
  maxDecisionsPerSession: 1,
  readingTimeBudgetSeconds: 120,
  autoRefresh: false,
  description: 'Default executive bounds.',
}

/**
 * Resolve the bounded-reading contract for an executive surface.
 * Returns the default executive contract for unknown surfaces — never
 * looser bounds.
 */
export function executiveSurfaceContract(surfaceId: string): ExecutiveSurfaceContract {
  return CONTRACTS[surfaceId] ?? DEFAULT_CONTRACT
}

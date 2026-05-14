/**
 * Single canonical lifecycle vocabulary for IGG entities, edges, and decisions.
 *
 * Source data uses heterogeneous status strings across schemas
 * (`organization_status`, motion outcome, congress membership status, etc.).
 * `normalizeLifecycleStatus` collapses them into one vocabulary while
 * preserving the original value for traceability.
 *
 * Unknown values MUST NOT throw — they are mapped to `unknown` and a
 * warning is returned via metadata.
 */

export const LifecycleStatuses = {
  ACTIVE: 'active',
  PENDING: 'pending',
  PROVISIONAL: 'provisional',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
  DORMANT: 'dormant',
  CONVERTED: 'converted',
  SUNSET_TRIGGERED: 'sunset_triggered',
  CARRIED: 'carried',
  DEFEATED: 'defeated',
  TABLED: 'tabled',
  WITHDRAWN: 'withdrawn',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  VETOED: 'vetoed',
  UNKNOWN: 'unknown',
} as const

export type LifecycleStatus =
  (typeof LifecycleStatuses)[keyof typeof LifecycleStatuses]

const KNOWN: ReadonlySet<string> = new Set(Object.values(LifecycleStatuses))

const ALIASES: Record<string, LifecycleStatus> = {
  // organization_status
  inactive: LifecycleStatuses.DORMANT,
  archived: LifecycleStatuses.EXPIRED,
  // motion outcomes
  passed: LifecycleStatuses.CARRIED,
  failed: LifecycleStatuses.DEFEATED,
  // negotiation statuses
  ratified: LifecycleStatuses.APPROVED,
  rejected_by_membership: LifecycleStatuses.REJECTED,
  // membership transitions
  in_transition: LifecycleStatuses.PROVISIONAL,
  pending_review: LifecycleStatuses.PENDING,
}

export interface NormalizedLifecycle {
  readonly status: LifecycleStatus
  readonly originalStatus: string
  readonly warning?: string
}

/**
 * Normalize an arbitrary status string. Never throws.
 *
 * @param raw - the source status, possibly null/undefined or unknown shape
 */
export function normalizeLifecycleStatus(raw: unknown): NormalizedLifecycle {
  if (raw == null || typeof raw !== 'string' || raw.trim() === '') {
    return {
      status: LifecycleStatuses.UNKNOWN,
      originalStatus: raw == null ? '' : String(raw),
      warning: 'lifecycle status missing or non-string',
    }
  }

  const lower = raw.toLowerCase().trim()

  if (KNOWN.has(lower)) {
    return { status: lower as LifecycleStatus, originalStatus: raw }
  }

  if (lower in ALIASES) {
    return { status: ALIASES[lower]!, originalStatus: raw }
  }

  return {
    status: LifecycleStatuses.UNKNOWN,
    originalStatus: raw,
    warning: `unrecognized lifecycle status: "${raw}"`,
  }
}

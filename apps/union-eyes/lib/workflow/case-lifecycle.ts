/**
 * Unified Case Lifecycle FSM
 *
 * Consolidates four parallel FSMs into a single source of truth:
 *  - case-workflow-fsm.ts    (10 states)
 *  - claim-workflow-fsm.ts   (8 states)
 *  - grievance-state-machine (10 states, 2 paths)
 *  - case-fsm-enforcement    (14 states, CUPE vocabulary)
 *
 * Enhanced 10-state model preserving legally significant distinctions:
 *
 *   draft → submitted → triage → investigation → negotiation
 *                                      ↓ (docs needed)
 *                                pending_docs
 *                                      ↓
 *                   negotiation → mediation → arbitration → resolved → closed
 *
 * Additional fields on the case record handle sub-classifications:
 *  - `resolution_type`: 'settled' | 'denied' | 'withdrawn' | null
 *  - `assigned_to`:     steward/officer assignment (replaces 'assigned' state)
 *  - `intake_outcome`:  'converted' | 'closed_no_case' | null (replaces intake-only states)
 *
 * @see state-bridge.ts for legacy state mapping
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type LifecycleState =
  | 'draft'           // Member preparing grievance (not yet submitted)
  | 'submitted'       // Filed with union — replaces: submitted, filed, new
  | 'triage'          // Under review / acknowledged — replaces: acknowledged, under_review, triage
  | 'investigation'   // Fact-finding in progress — replaces: investigating, investigation
  | 'pending_docs'    // Blocked on documentation — replaces: pending_documentation, pending_response
  | 'negotiation'     // Active discussions with employer — replaces: negotiating, response_due
  | 'mediation'       // Alternative dispute resolution — legally distinct from arbitration
  | 'arbitration'     // Formal arbitration — replaces: escalated, arbitration
  | 'resolved'        // Outcome reached — replaces: resolved, settled
  | 'closed';         // Archived — terminal state

export type ResolutionType = 'settled' | 'denied' | 'withdrawn';

export type CasePriority = 'low' | 'medium' | 'high' | 'critical';

export type ActorRole =
  | 'member'
  | 'steward'
  | 'chief_steward'
  | 'officer'
  | 'admin'
  | 'system_admin';

export const ROLE_LEVEL: Record<ActorRole, number> = {
  member: 0,
  steward: 1,
  chief_steward: 2,
  officer: 3,
  admin: 4,
  system_admin: 5,
};

export interface TransitionContext {
  actorRole: ActorRole;
  caseId: string;
  currentState: LifecycleState;
  targetState: LifecycleState;
  priority?: CasePriority;
  assignedTo?: string | null;
  statusChangedAt?: Date;
  hasRequiredDocumentation?: boolean;
  hasUnresolvedCriticalSignals?: boolean;
  resolutionType?: ResolutionType;
  notes?: string;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
  requiredActions?: string[];
  warnings?: string[];
  metadata?: {
    slaCompliant: boolean;
    daysInState: number;
    nextDeadline?: Date;
  };
}

// ─── Transition Rules ────────────────────────────────────────────────────────

interface TransitionRule {
  /** States reachable from this state. */
  to: LifecycleState[];
  /** Minimum role level required for transition (per target). */
  minRole: Partial<Record<LifecycleState, ActorRole>>;
  /** Default minimum role if not specified per target. */
  defaultMinRole: ActorRole;
  /** Minimum milliseconds in state before transition is allowed (0 = immediate). */
  minTimeMs: number;
  /** Optional guard — return error string or null if OK. */
  guard?: (ctx: TransitionContext) => string | null;
}

const TRANSITIONS: Record<LifecycleState, TransitionRule> = {
  draft: {
    to: ['submitted'],
    minRole: {},
    defaultMinRole: 'member',
    minTimeMs: 0,
  },

  submitted: {
    to: ['triage', 'closed'],
    minRole: {
      triage: 'steward',
      closed: 'admin', // Reject at intake requires admin
    },
    defaultMinRole: 'steward',
    minTimeMs: 0,
  },

  triage: {
    to: ['investigation', 'closed'],
    minRole: {
      investigation: 'steward',
      closed: 'admin',
    },
    defaultMinRole: 'steward',
    minTimeMs: 0,
    guard: (ctx) => {
      if (ctx.targetState === 'investigation' && !ctx.assignedTo) {
        return 'A steward must be assigned before moving to investigation';
      }
      return null;
    },
  },

  investigation: {
    to: ['pending_docs', 'negotiation', 'mediation', 'arbitration', 'resolved', 'closed'],
    minRole: {
      pending_docs: 'steward',
      negotiation: 'steward',
      mediation: 'officer',
      arbitration: 'officer',
      resolved: 'steward',
      closed: 'admin',
    },
    defaultMinRole: 'steward',
    minTimeMs: 3 * 24 * 60 * 60 * 1000, // 3 days minimum investigation
    guard: (ctx) => {
      if (['resolved', 'closed'].includes(ctx.targetState) && !ctx.hasRequiredDocumentation) {
        return 'Required documentation must be present before resolution or closure';
      }
      return null;
    },
  },

  pending_docs: {
    to: ['investigation', 'triage', 'resolved', 'closed'],
    minRole: {
      investigation: 'steward',
      triage: 'steward',
      resolved: 'admin',
      closed: 'admin',
    },
    defaultMinRole: 'steward',
    minTimeMs: 0,
  },

  negotiation: {
    to: ['investigation', 'mediation', 'arbitration', 'resolved', 'closed'],
    minRole: {
      investigation: 'steward',
      mediation: 'officer',
      arbitration: 'officer',
      resolved: 'steward',
      closed: 'admin',
    },
    defaultMinRole: 'steward',
    minTimeMs: 0,
  },

  mediation: {
    to: ['negotiation', 'arbitration', 'resolved', 'closed'],
    minRole: {
      negotiation: 'officer',
      arbitration: 'officer',
      resolved: 'officer',
      closed: 'admin',
    },
    defaultMinRole: 'officer',
    minTimeMs: 0,
  },

  arbitration: {
    to: ['resolved', 'closed'],
    minRole: {
      resolved: 'officer',
      closed: 'admin',
    },
    defaultMinRole: 'officer',
    minTimeMs: 0,
  },

  resolved: {
    to: ['closed'],
    minRole: {
      closed: 'admin',
    },
    defaultMinRole: 'admin',
    minTimeMs: 7 * 24 * 60 * 60 * 1000, // 7-day cooling-off / appeal period
    guard: (ctx) => {
      if (ctx.hasUnresolvedCriticalSignals) {
        return 'Cannot close case with unresolved critical signals';
      }
      if (!ctx.hasRequiredDocumentation) {
        return 'Resolution documentation must be present before closure';
      }
      return null;
    },
  },

  closed: {
    // Reopening is restricted — only system_admin can send back to triage for audit
    to: ['triage'],
    minRole: {
      triage: 'system_admin',
    },
    defaultMinRole: 'system_admin',
    minTimeMs: 0,
  },
};

// ─── SLA Standards ───────────────────────────────────────────────────────────

export interface SLAStandard {
  baseHours: number;
  byPriority: Record<CasePriority, number>;
}

export const SLA_STANDARDS: Record<LifecycleState, SLAStandard> = {
  draft: { baseHours: Infinity, byPriority: { low: Infinity, medium: Infinity, high: Infinity, critical: Infinity } },
  submitted: { baseHours: 48, byPriority: { low: 72, medium: 48, high: 36, critical: 24 } },
  triage: { baseHours: 120, byPriority: { low: 180, medium: 120, high: 90, critical: 60 } },
  investigation: { baseHours: 240, byPriority: { low: 360, medium: 240, high: 180, critical: 120 } },
  pending_docs: { baseHours: 168, byPriority: { low: 252, medium: 168, high: 126, critical: 84 } },
  negotiation: { baseHours: 240, byPriority: { low: 360, medium: 240, high: 180, critical: 120 } },
  mediation: { baseHours: 480, byPriority: { low: 720, medium: 480, high: 360, critical: 240 } },
  arbitration: { baseHours: 720, byPriority: { low: 1080, medium: 720, high: 540, critical: 360 } },
  resolved: { baseHours: 720, byPriority: { low: 1080, medium: 720, high: 540, critical: 360 } },
  closed: { baseHours: Infinity, byPriority: { low: Infinity, medium: Infinity, high: Infinity, critical: Infinity } },
};

// ─── Lifecycle Order (for progress calculation) ──────────────────────────────

export const LIFECYCLE_ORDER: LifecycleState[] = [
  'draft', 'submitted', 'triage', 'investigation', 'pending_docs',
  'negotiation', 'mediation', 'arbitration', 'resolved', 'closed',
];

const PROGRESS_MAP: Record<LifecycleState, number> = {
  draft: 5,
  submitted: 10,
  triage: 20,
  investigation: 40,
  pending_docs: 35,
  negotiation: 55,
  mediation: 65,
  arbitration: 75,
  resolved: 90,
  closed: 100,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate whether a state transition is allowed.
 */
export function validateTransition(ctx: TransitionContext): TransitionResult {
  const rule = TRANSITIONS[ctx.currentState];
  if (!rule) {
    return { allowed: false, reason: `Unknown state: ${ctx.currentState}` };
  }

  // 1. Check target is in allowed set
  if (!rule.to.includes(ctx.targetState)) {
    return {
      allowed: false,
      reason: `Cannot transition from '${ctx.currentState}' to '${ctx.targetState}'. Allowed: ${rule.to.join(', ')}`,
    };
  }

  // 2. Check actor role
  const requiredRole = rule.minRole[ctx.targetState] ?? rule.defaultMinRole;
  const actorLevel = ROLE_LEVEL[ctx.actorRole] ?? 0;
  const requiredLevel = ROLE_LEVEL[requiredRole] ?? 0;
  if (actorLevel < requiredLevel) {
    return {
      allowed: false,
      reason: `Role '${ctx.actorRole}' insufficient — '${requiredRole}' or higher required for this transition`,
    };
  }

  // 3. Check minimum time in state
  const daysInState = ctx.statusChangedAt
    ? (Date.now() - ctx.statusChangedAt.getTime()) / (24 * 60 * 60 * 1000)
    : Infinity;
  if (rule.minTimeMs > 0 && ctx.statusChangedAt) {
    const elapsed = Date.now() - ctx.statusChangedAt.getTime();
    if (elapsed < rule.minTimeMs) {
      const hoursRemaining = Math.ceil((rule.minTimeMs - elapsed) / (60 * 60 * 1000));
      return {
        allowed: false,
        reason: `Minimum time in '${ctx.currentState}' not met — ${hoursRemaining}h remaining`,
        requiredActions: [`Wait ${hoursRemaining} more hours`],
      };
    }
  }

  // 4. Check guard conditions
  if (rule.guard) {
    const guardError = rule.guard(ctx);
    if (guardError) {
      return { allowed: false, reason: guardError };
    }
  }

  // 5. Build SLA metadata
  const priority = ctx.priority ?? 'medium';
  const slaStd = SLA_STANDARDS[ctx.currentState];
  const slaHours = slaStd.byPriority[priority];
  const slaCompliant = daysInState * 24 <= slaHours;
  const warnings: string[] = [];

  if (!slaCompliant) {
    warnings.push(`SLA breached: ${Math.floor(daysInState)} days in '${ctx.currentState}' exceeds ${slaHours}h limit`);
  }

  const nextSla = SLA_STANDARDS[ctx.targetState];
  const nextDeadline = nextSla.baseHours < Infinity
    ? new Date(Date.now() + nextSla.byPriority[priority] * 60 * 60 * 1000)
    : undefined;

  return {
    allowed: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    metadata: {
      slaCompliant,
      daysInState: Math.floor(daysInState),
      nextDeadline,
    },
  };
}

/**
 * Get all allowed transitions from the current state for a given actor.
 */
export function getAllowedTransitions(
  currentState: LifecycleState,
  actorRole: ActorRole,
): LifecycleState[] {
  const rule = TRANSITIONS[currentState];
  if (!rule) return [];

  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;

  return rule.to.filter((target) => {
    const requiredRole = rule.minRole[target] ?? rule.defaultMinRole;
    return actorLevel >= ROLE_LEVEL[requiredRole];
  });
}

/** Check if a state is terminal (no outgoing transitions for anyone). */
export function isTerminal(state: LifecycleState): boolean {
  // 'closed' technically allows reopening for system_admin, but for
  // practical purposes it's terminal for all standard roles.
  return state === 'closed';
}

/** Check if a state is active (not terminal, not draft). */
export function isActive(state: LifecycleState): boolean {
  return state !== 'closed' && state !== 'draft';
}

/** Get progress percentage (0-100) for a state. */
export function getProgress(state: LifecycleState): number {
  return PROGRESS_MAP[state] ?? 0;
}

/** All valid lifecycle states. */
export const ALL_STATES: readonly LifecycleState[] = Object.freeze(LIFECYCLE_ORDER);

/** Get SLA deadline in hours for a state and priority. */
export function getSLADeadlineHours(state: LifecycleState, priority: CasePriority): number {
  return SLA_STANDARDS[state].byPriority[priority];
}

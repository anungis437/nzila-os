/**
 * Action Enforcer — RBAC gate for Union-Eyes case operations
 *
 * PR-033: Privileged Action Matrix + Denial Tests
 *
 * See docs/pilot/cupe/CUPE_RBAC_MATRIX.md for the full matrix.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const CUPE_ACTIONS = [
  'case_create',
  'case_read_own',
  'case_read_any',
  'case_assign',
  'case_transition',
  'case_close',
  'case_reopen',
  'case_export',
  'note_add',
  'note_add_internal',
  'attachment_upload',
  'attachment_delete',
  'user_manage',
  'admin_config',
] as const;

export type CUPEAction = (typeof CUPE_ACTIONS)[number];

export type CUPERole =
  | 'member'
  | 'steward'
  | 'chief_steward'
  | 'business_agent'
  | 'officer'
  | 'admin'
  | 'platform_admin';

export interface ActionContext {
  /** Current case status — needed for conditional checks */
  caseStatus?: string;
}

export interface ActionResult {
  allowed: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Role hierarchy (ascending privilege)
// ---------------------------------------------------------------------------

const ROLE_LEVEL: Record<CUPERole, number> = {
  member: 0,
  steward: 1,
  chief_steward: 2,
  business_agent: 2,
  officer: 3,
  admin: 4,
  platform_admin: 5,
};

// ---------------------------------------------------------------------------
// Policy rules
// ---------------------------------------------------------------------------

/** Minimum role level required for each action (no condition). */
const MIN_LEVEL: Record<CUPEAction, number> = {
  case_create: 0,
  case_read_own: 0,
  case_read_any: 2,
  case_assign: 2,
  case_transition: 1,
  case_close: 2, // conditional — see below
  case_reopen: 3,
  case_export: 3,
  note_add: 0,
  note_add_internal: 1,
  attachment_upload: 0,
  attachment_delete: 4,
  user_manage: 4,
  admin_config: 5,
};

/**
 * Additional conditions beyond minimum level.
 * Return null when no extra condition applies, or an ActionResult for denial.
 */
function checkCondition(
  action: CUPEAction,
  role: CUPERole,
  ctx?: ActionContext,
): ActionResult | null {
  // case_read_any for stewards requires local-level scoping (enforced at query layer)
  // — the enforcer allows the action; downstream query filters by local.

  // case_close at level 2 only when case is resolved/rejected
  if (action === 'case_close' && ROLE_LEVEL[role] === 2) {
    const closableStatuses = ['resolved', 'rejected'];
    if (!ctx?.caseStatus || !closableStatuses.includes(ctx.caseStatus)) {
      return {
        allowed: false,
        reason: `Role ${role} can only close cases with status resolved or rejected (current: ${ctx?.caseStatus ?? 'unknown'})`,
      };
    }
  }

  return null; // no extra condition
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a role may perform an action, optionally with context.
 */
export function canPerformAction(
  action: CUPEAction,
  role: CUPERole,
  ctx?: ActionContext,
): ActionResult {
  const level = ROLE_LEVEL[role];
  if (level === undefined) {
    return { allowed: false, reason: `Unknown role: ${role}` };
  }

  const required = MIN_LEVEL[action];
  if (required === undefined) {
    return { allowed: false, reason: `Unknown action: ${action}` };
  }

  if (level < required) {
    return {
      allowed: false,
      reason: `Role ${role} (level ${level}) lacks privilege for ${action} (requires level ${required})`,
    };
  }

  // Check any conditional rules
  const condResult = checkCondition(action, role, ctx);
  if (condResult) return condResult;

  return { allowed: true, reason: 'ok' };
}

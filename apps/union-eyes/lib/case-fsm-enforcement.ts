/**
 * Case FSM Enforcement
 *
 * Pure server-side state machine for CUPE grievance lifecycle status transitions.
 * Bridges @nzila/cupe-vocabulary statuses with the enforcement rules defined in
 * the union-eyes FSM layer.
 *
 * PR-022: FSM Enforcement + Transition Tests
 *
 * @deprecated Use `lib/workflow/case-lifecycle.ts` (unified CaseLifecycle FSM) for new code.
 * For CUPE vocabulary bridging, use `lib/workflow/state-bridge.ts` with fsm='cupe'.
 */

import {
  getStatusById,
  getAllStatusIds,
  type Status,
} from '@nzila/cupe-vocabulary';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FSMTransitionContext {
  caseId: string;
  currentStatus: string;
  targetStatus: string;
  actorRole: string;
  reason?: string;
}

export interface FSMTransitionResult {
  allowed: boolean;
  reason?: string;
  nextAllowedStatuses?: string[];
}

// ─── Role hierarchy ───────────────────────────────────────────────────────────

const ROLE_LEVEL: Record<string, number> = {
  member: 0,
  steward: 1,
  chief_steward: 2,
  business_agent: 2,
  officer: 3,
  admin: 4,
  platform_admin: 5,
};

function hasMinRole(actorRole: string, requiredRoles: string[]): boolean {
  const actorLevel = ROLE_LEVEL[actorRole] ?? -1;
  return requiredRoles.some((r) => actorLevel >= (ROLE_LEVEL[r] ?? Infinity));
}

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * Validate a status transition using CUPE vocabulary rules.
 *
 * Rules come from the vocabulary status definitions:
 * each status specifies `allowTransitionsTo[]` and `allowedRoles[]`.
 */
export function validateCUPETransition(
  ctx: FSMTransitionContext,
): FSMTransitionResult {
  const { currentStatus, targetStatus, actorRole } = ctx;

  // 1. Get current status definition
  const currentDef = getStatusById(currentStatus);
  if (!currentDef) {
    return {
      allowed: false,
      reason: `Unknown current status '${currentStatus}'. Valid statuses: ${getAllStatusIds().join(', ')}`,
    };
  }

  // 2. Get target status definition
  const targetDef = getStatusById(targetStatus);
  if (!targetDef) {
    return {
      allowed: false,
      reason: `Unknown target status '${targetStatus}'. Valid statuses: ${getAllStatusIds().join(', ')}`,
    };
  }

  // 3. Check if transition is allowed by the vocabulary rules
  if (!currentDef.allowTransitionsTo.includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Invalid transition: '${currentDef.label}' → '${targetDef.label}'. Allowed next: [${currentDef.allowTransitionsTo.join(', ')}].`,
      nextAllowedStatuses: currentDef.allowTransitionsTo,
    };
  }

  // 4. Check role-based access — target status must allow the actor's role
  if (!hasMinRole(actorRole, targetDef.allowedRoles)) {
    return {
      allowed: false,
      reason: `Role '${actorRole}' cannot transition to '${targetDef.label}'. Required: ${targetDef.allowedRoles.join(' / ')}.`,
      nextAllowedStatuses: currentDef.allowTransitionsTo,
    };
  }

  return { allowed: true, nextAllowedStatuses: currentDef.allowTransitionsTo };
}

/**
 * Get allowed next actions for a given status + actor role.
 * Used by the UI to show/hide action buttons.
 */
export function getAllowedTransitions(
  currentStatus: string,
  actorRole: string,
): { statusId: string; label: string }[] {
  const currentDef = getStatusById(currentStatus);
  if (!currentDef) return [];

  return currentDef.allowTransitionsTo
    .map((id) => getStatusById(id))
    .filter((s): s is Status => s !== undefined)
    .filter((s) => hasMinRole(actorRole, s.allowedRoles))
    .map((s) => ({ statusId: s.id, label: s.label }));
}

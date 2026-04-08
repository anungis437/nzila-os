/**
 * Grievance Lifecycle FSM
 *
 * Encodes the full grievance lifecycle as a strict finite-state machine.
 * Every status transition must pass through this validator — the API
 * layer MUST call `validateTransition` before writing a status change.
 *
 * Intake path:  DRAFT → CONVERTED → NEW (official case)
 *              DRAFT → CLOSED_NO_CASE (terminal — no case created)
 *
 * Case path:   NEW → TRIAGE → INVESTIGATION → NEGOTIATION → ARBITRATION → RESOLVED → CLOSED
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type GrievanceLifecycleStatus =
  | "draft"
  | "converted"
  | "closed_no_case"
  | "new"
  | "triage"
  | "investigation"
  | "negotiation"
  | "arbitration"
  | "resolved"
  | "closed";

export type ActorRole =
  | "platform_admin"
  | "union_admin"
  | "union_staff"
  | "member";

export interface TransitionContext {
  actorRole: ActorRole;
  assignedStaffId?: string | null;
  hasDocuments?: boolean;
}

export interface TransitionResult {
  valid: boolean;
  error?: string;
}

// ─── Transition Rules ────────────────────────────────────────────────────────

interface TransitionRule {
  to: GrievanceLifecycleStatus[];
  /** Minimum actor role that can trigger this transition. */
  minRole: ActorRole;
  /** Optional guard condition. */
  guard?: (ctx: TransitionContext) => string | null;
}

const ROLE_LEVEL: Record<ActorRole, number> = {
  platform_admin: 100,
  union_admin: 80,
  union_staff: 60,
  member: 10,
};

/**
 * Full transition matrix.
 * Key = current status, value = allowed transitions with guards.
 */
const TRANSITIONS: Record<GrievanceLifecycleStatus, TransitionRule> = {
  // ── Intake statuses ──────────────────────────────────────────
  draft: {
    to: ["converted", "closed_no_case"],
    minRole: "union_staff",
  },
  converted: {
    // Terminal intake state — the conversion endpoint creates the official
    // case as a NEW grievance. No further transitions from 'converted'.
    to: [],
    minRole: "platform_admin",
  },
  closed_no_case: {
    // Terminal intake state — intake was reviewed and no case warranted.
    to: [],
    minRole: "platform_admin",
  },
  // ── Official case statuses ──────────────────────────────────
  new: {
    to: ["triage", "closed"],
    minRole: "union_staff",
  },
  triage: {
    to: ["investigation", "closed"],
    minRole: "union_staff",
    guard: (ctx) =>
      ctx.assignedStaffId
        ? null
        : "Grievance must be assigned to a steward before investigation.",
  },
  investigation: {
    to: ["negotiation", "arbitration", "closed"],
    minRole: "union_staff",
  },
  negotiation: {
    to: ["investigation", "arbitration", "resolved", "closed"],
    minRole: "union_staff",
  },
  arbitration: {
    to: ["resolved", "closed"],
    minRole: "union_admin",
  },
  resolved: {
    to: ["closed"],
    minRole: "union_admin",
  },
  closed: {
    // Terminal state — no outgoing transitions under normal flow.
    // Allow platform_admin to reopen (back to triage) for audit corrections.
    to: ["triage"],
    minRole: "platform_admin",
  },
};

// ─── Validator ───────────────────────────────────────────────────────────────

/**
 * Validate whether a status transition is allowed.
 *
 * @param from  Current grievance status.
 * @param to    Desired next status.
 * @param ctx   Actor and case context.
 * @returns     `{ valid: true }` or `{ valid: false, error: string }`.
 */
export function validateTransition(
  from: GrievanceLifecycleStatus,
  to: GrievanceLifecycleStatus,
  ctx: TransitionContext,
): TransitionResult {
  const rule = TRANSITIONS[from];

  if (!rule.to.includes(to)) {
    return {
      valid: false,
      error: `Invalid transition: ${from} → ${to}. Allowed: [${rule.to.join(", ")}].`,
    };
  }

  if (ROLE_LEVEL[ctx.actorRole] < ROLE_LEVEL[rule.minRole]) {
    return {
      valid: false,
      error: `Role "${ctx.actorRole}" lacks permission. Minimum: "${rule.minRole}".`,
    };
  }

  if (rule.guard) {
    const guardError = rule.guard(ctx);
    if (guardError) {
      return { valid: false, error: guardError };
    }
  }

  return { valid: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return the set of statuses reachable from the current status.
 */
export function allowedNextStatuses(
  from: GrievanceLifecycleStatus,
): GrievanceLifecycleStatus[] {
  return TRANSITIONS[from].to;
}

/**
 * Check if a status is terminal (no outgoing transitions for non-admins).
 */
export function isTerminal(status: GrievanceLifecycleStatus): boolean {
  return status === "closed" || status === "converted" || status === "closed_no_case";
}

/**
 * Ordered lifecycle stages for timeline rendering.
 */
export const GRIEVANCE_LIFECYCLE_ORDER: GrievanceLifecycleStatus[] = [
  "new",
  "triage",
  "investigation",
  "negotiation",
  "arbitration",
  "resolved",
  "closed",
];

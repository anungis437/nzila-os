/**
 * Policy Lifecycle FSM — Explicit, validated lifecycle state transitions.
 *
 * Policies move through a 10-state lifecycle. No shortcut paths.
 * No direct mutation. Every transition is validated before application.
 *
 * State diagram:
 *
 *   draft
 *     → review_pending
 *
 *   review_pending
 *     → approval_required
 *
 *   approval_required
 *     → approved
 *     → draft  (rejected — re-submission)
 *
 *   approved
 *     → published
 *
 *   published
 *     → active
 *
 *   active
 *     → superseded  (replaced by a newer version)
 *     → deprecated  (scheduled for retirement)
 *
 *   superseded
 *     → archived
 *
 *   deprecated
 *     → archived
 *
 *   ANY state
 *     → revoked  (emergency revocation)
 *
 *   revoked
 *     → archived
 *
 *   archived
 *     (terminal — no further transitions)
 */

export const POLICY_LIFECYCLE_STATES = [
  'draft',
  'review_pending',
  'approval_required',
  'approved',
  'published',
  'active',
  'superseded',
  'deprecated',
  'revoked',
  'archived',
] as const

export type PolicyLifecycleState = (typeof POLICY_LIFECYCLE_STATES)[number]

// ── Transition map ────────────────────────────────────────────────────────────
//
// Key = from state. Value = set of valid destination states.
// This is the ONLY source of truth for permitted transitions.

const LIFECYCLE_TRANSITIONS: ReadonlyMap<
  PolicyLifecycleState,
  ReadonlySet<PolicyLifecycleState>
> = new Map([
  ['draft',             new Set<PolicyLifecycleState>(['review_pending', 'revoked'])],
  ['review_pending',    new Set<PolicyLifecycleState>(['approval_required', 'revoked'])],
  ['approval_required', new Set<PolicyLifecycleState>(['approved', 'draft', 'revoked'])],
  ['approved',          new Set<PolicyLifecycleState>(['published', 'revoked'])],
  ['published',         new Set<PolicyLifecycleState>(['active', 'revoked'])],
  ['active',            new Set<PolicyLifecycleState>(['superseded', 'deprecated', 'revoked'])],
  ['superseded',        new Set<PolicyLifecycleState>(['archived'])],
  ['deprecated',        new Set<PolicyLifecycleState>(['archived'])],
  ['revoked',           new Set<PolicyLifecycleState>(['archived'])],
  ['archived',          new Set<PolicyLifecycleState>()], // terminal
])

// ── Terminal and public state sets ───────────────────────────────────────────

const TERMINAL_STATES = new Set<PolicyLifecycleState>(['archived'])

const PUBLIC_STATES = new Set<PolicyLifecycleState>([
  'published',
  'active',
  'superseded',
  'deprecated',
])

// ── API ───────────────────────────────────────────────────────────────────────

/**
 * Returns all valid target states from the given current state.
 * Returns an empty readonly set for terminal states.
 */
export function getPermittedTransitions(
  from: PolicyLifecycleState,
): ReadonlySet<PolicyLifecycleState> {
  return LIFECYCLE_TRANSITIONS.get(from) ?? new Set()
}

/**
 * Returns true if a transition from `from` to `to` is valid per the FSM.
 */
export function canTransitionTo(
  from: PolicyLifecycleState,
  to: PolicyLifecycleState,
): boolean {
  return LIFECYCLE_TRANSITIONS.get(from)?.has(to) ?? false
}

/**
 * Validates a lifecycle transition.
 * Throws a descriptive error if the transition is invalid.
 * Call this before applying any state change.
 */
export function validateTransition(
  from: PolicyLifecycleState,
  to: PolicyLifecycleState,
): void {
  if (!canTransitionTo(from, to)) {
    const permitted = [...getPermittedTransitions(from)]
    const detail = permitted.length > 0
      ? `Permitted from ${from}: [${permitted.join(', ')}].`
      : `${from} is a terminal state — no further transitions are allowed.`
    throw new Error(
      `INVALID_LIFECYCLE_TRANSITION: Invalid transition: ${from} → ${to}. ` +
        detail,
    )
  }
}

/**
 * Returns true if `state` is a terminal state (no further transitions).
 * Currently only `archived` is terminal.
 */
export function isTerminalState(state: PolicyLifecycleState): boolean {
  return TERMINAL_STATES.has(state)
}

/**
 * Returns true if `state` is publicly visible (published or later).
 * Used to guard operations that should only apply to publicly-released policies.
 */
export function isPublicState(state: PolicyLifecycleState): boolean {
  return PUBLIC_STATES.has(state)
}

/**
 * Returns true if `state` is an operational state where the policy governs
 * live workflow decisions.
 */
export function isOperationalState(state: PolicyLifecycleState): boolean {
  return state === 'active'
}

/**
 * Returns true if `state` represents a policy that has been retired
 * (superseded, deprecated, revoked, or archived).
 */
export function isRetiredState(state: PolicyLifecycleState): boolean {
  return (
    state === 'superseded' ||
    state === 'deprecated' ||
    state === 'revoked' ||
    state === 'archived'
  )
}

/**
 * Returns true if `state` represents a policy awaiting human action
 * (review or approval).
 */
export function isPendingHumanAction(state: PolicyLifecycleState): boolean {
  return state === 'review_pending' || state === 'approval_required'
}

/**
 * Returns a human-readable label for display in the governance UI.
 */
export function lifecycleStateLabel(state: PolicyLifecycleState): string {
  const labels: Record<PolicyLifecycleState, string> = {
    draft:              'Draft',
    review_pending:     'Review Pending',
    approval_required:  'Approval Required',
    approved:           'Approved',
    published:          'Published',
    active:             'Active',
    superseded:         'Superseded',
    deprecated:         'Deprecated',
    revoked:            'Revoked',
    archived:           'Archived',
  }
  return labels[state]
}

/**
 * Case Workflow Finite State Machine (FSM)
 * PR-5: Opinionated Workflow Rules
 * 
 * Purpose: Encode union grievance best practices as enforced rules, not suggestions.
 * This FSM ensures cases follow proper workflow progression and prevents invalid state transitions.
 * 
 * States represent the lifecycle of a grievance/case from initial filing to final resolution.
 *
 * @deprecated Use `lib/workflow/case-lifecycle.ts` (unified CaseLifecycle FSM) for new code.
 * Legacy state mapping available via `lib/workflow/state-bridge.ts`.
 */

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

/**
 * Valid case workflow states
 * Based on typical union grievance procedures
 */
export type CaseState =
  | 'draft'           // Member is preparing the grievance (not yet submitted)
  | 'submitted'       // Grievance has been submitted to union
  | 'acknowledged'    // Union officer has acknowledged receipt
  | 'investigating'   // Officer/steward is gathering facts and evidence
  | 'pending_response' // Waiting for employer response
  | 'negotiating'     // Active negotiations with employer
  | 'escalated'       // Escalated to arbitration or higher level
  | 'resolved'        // Case has been resolved (successfully or not)
  | 'withdrawn'       // Member has withdrawn the grievance
  | 'closed';         // Case is closed and archived

/**
 * Reasons a transition might be invalid
 */
export type TransitionError =
  | 'INVALID_STATE_TRANSITION'
  | 'MISSING_REQUIRED_FIELD'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'SLA_EXPIRED'
  | 'MISSING_ACKNOWLEDGMENT';

/**
 * Context required to validate a state transition
 */
export interface TransitionContext {
  actorRole: 'member' | 'steward' | 'officer' | 'admin';
  hasAcknowledged?: boolean;
  hasSufficientEvidence?: boolean;
  daysInCurrentState?: number;
  hasEmployerResponse?: boolean;
}

/**
 * Result of a transition validation
 */
export interface TransitionValidationResult {
  valid: boolean;
  error?: TransitionError;
  message?: string;
}

// ============================================================================
// STATE TRANSITION MATRIX
// ============================================================================

/**
 * State transition rules matrix
 * Key: from state → allowed next states with validation rules
 * 
 * Design principle: Make the right thing easy, wrong thing impossible
 */
const TRANSITION_RULES: Record<
  CaseState,
  {
    allowedNextStates: CaseState[];
    requiresRole?: TransitionContext['actorRole'][];
    requiresCondition?: (context: TransitionContext) => boolean;
  }
> = {
  draft: {
    allowedNextStates: ['submitted', 'withdrawn'],
    requiresRole: ['member', 'officer', 'admin'],
  },
  submitted: {
    allowedNextStates: ['acknowledged', 'withdrawn'],
    requiresRole: ['officer', 'steward', 'admin'],
  },
  acknowledged: {
    allowedNextStates: ['investigating', 'withdrawn', 'closed'],
    requiresRole: ['officer', 'steward', 'admin'],
  },
  investigating: {
    allowedNextStates: ['pending_response', 'resolved', 'withdrawn', 'closed'],
    requiresRole: ['officer', 'steward', 'admin'],
    requiresCondition: (ctx) => ctx.hasSufficientEvidence === true,
  },
  pending_response: {
    allowedNextStates: ['negotiating', 'escalated', 'withdrawn', 'closed'],
    requiresRole: ['officer', 'admin'], // Only officer/admin can negotiate
  },
  negotiating: {
    allowedNextStates: ['resolved', 'escalated', 'withdrawn'],
    requiresRole: ['officer', 'admin'],
  },
  escalated: {
    allowedNextStates: ['resolved', 'withdrawn'],
    requiresRole: ['officer', 'admin'],
  },
  resolved: {
    allowedNextStates: ['closed'],
    requiresRole: ['officer', 'admin'],
  },
  withdrawn: {
    allowedNextStates: ['closed'],
    requiresRole: ['officer', 'admin'],
  },
  closed: {
    allowedNextStates: [], // Terminal state
  },
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validate whether a state transition is allowed
 * 
 * @param fromState - Current state of the case
 * @param toState - Desired next state
 * @param context - Context information (actor role, conditions, etc.)
 * @returns Validation result with error details if invalid
 * 
 * @example
 * ```typescript
 * const result = validateTransition('submitted', 'acknowledged', {
 *   actorRole: 'officer',
 *   hasAcknowledged: true
 * });
 * if (!result.valid) {
 *   throw new Error(result.message);
 * }
 * ```
 */
export function validateTransition(
  fromState: CaseState,
  toState: CaseState,
  context: TransitionContext
): TransitionValidationResult {
  // Get transition rules for current state
  const rules = TRANSITION_RULES[fromState];

  // Check if target state is in allowed next states
  if (!rules.allowedNextStates.includes(toState)) {
    return {
      valid: false,
      error: 'INVALID_STATE_TRANSITION',
      message: `Cannot transition from '${fromState}' to '${toState}'. Allowed transitions: ${rules.allowedNextStates.join(', ')}`,
    };
  }

  // Check role requirements
  if (rules.requiresRole && !rules.requiresRole.includes(context.actorRole)) {
    return {
      valid: false,
      error: 'INSUFFICIENT_PERMISSIONS',
      message: `Role '${context.actorRole}' cannot perform transition from '${fromState}' to '${toState}'. Required roles: ${rules.requiresRole.join(', ')}`,
    };
  }

  // Check conditional requirements
  // Admin can bypass conditions when closing cases (administrative override)
  const isAdminClosing = context.actorRole === 'admin' && toState === 'closed';
  if (rules.requiresCondition && !isAdminClosing && !rules.requiresCondition(context)) {
    return {
      valid: false,
      error: 'MISSING_REQUIRED_FIELD',
      message: `Transition from '${fromState}' to '${toState}' requires additional conditions to be met`,
    };
  }

  // Special validation: acknowledging must happen within SLA
  if (fromState === 'submitted' && toState === 'acknowledged') {
    if (context.daysInCurrentState && context.daysInCurrentState > 2) {
      return {
        valid: false,
        error: 'SLA_EXPIRED',
        message: `Acknowledgment must occur within 2 business days of submission (${context.daysInCurrentState} days elapsed)`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get all allowed next states from current state
 * 
 * @param currentState - Current state of the case
 * @returns Array of allowed next states
 * 
 * @example
 * ```typescript
 * const nextStates = getAllowedTransitions('submitted');
 * // Returns: ['acknowledged', 'withdrawn']
 * ```
 */
export function getAllowedTransitions(currentState: CaseState): CaseState[] {
  return TRANSITION_RULES[currentState]?.allowedNextStates || [];
}

/**
 * Check if a state is a terminal state (no further transitions allowed)
 * 
 * @param state - State to check
 * @returns True if state is terminal
 */
export function isTerminalState(state: CaseState): boolean {
  return getAllowedTransitions(state).length === 0;
}

/**
 * Get the initial state for a new case
 */
export function getInitialState(): CaseState {
  return 'draft';
}

/**
 * Get required role(s) for transitioning from a given state
 * 
 * @param fromState - State to transition from
 * @returns Array of required roles, or undefined if no restriction
 */
export function getRequiredRoles(fromState: CaseState): TransitionContext['actorRole'][] | undefined {
  return TRANSITION_RULES[fromState]?.requiresRole;
}

/**
 * Validate an entire workflow path
 * Useful for testing complete workflows
 * 
 * @param path - Array of states representing the workflow path
 * @param contexts - Array of contexts (one per transition)
 * @returns Validation result
 */
export function validateWorkflowPath(
  path: CaseState[],
  contexts: TransitionContext[]
): TransitionValidationResult {
  if (path.length < 2) {
    return {
      valid: false,
      error: 'INVALID_STATE_TRANSITION',
      message: 'Workflow path must contain at least 2 states',
    };
  }

  if (contexts.length !== path.length - 1) {
    return {
      valid: false,
      error: 'MISSING_REQUIRED_FIELD',
      message: 'Must provide context for each transition',
    };
  }

  for (let i = 0; i < path.length - 1; i++) {
    const result = validateTransition(path[i], path[i + 1], contexts[i]);
    if (!result.valid) {
      return {
        ...result,
        message: `Transition ${i + 1} (${path[i]} → ${path[i + 1]}): ${result.message}`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// WORKFLOW HELPERS
// ============================================================================

/**
 * Determine if a case is in an active state (not resolved/withdrawn/closed)
 */
export function isActiveState(state: CaseState): boolean {
  return !['resolved', 'withdrawn', 'closed'].includes(state);
}

/**
 * Determine if a case requires urgent attention based on state
 */
export function requiresUrgentAttention(state: CaseState): boolean {
  return ['submitted', 'pending_response', 'escalated'].includes(state);
}

/**
 * Get human-readable description of a state
 */
export function getStateDescription(state: CaseState): string {
  const descriptions: Record<CaseState, string> = {
    draft: 'Member is preparing the grievance',
    submitted: 'Grievance submitted and awaiting acknowledgment',
    acknowledged: 'Union has acknowledged receipt',
    investigating: 'Officer is gathering facts and evidence',
    pending_response: 'Awaiting employer response',
    negotiating: 'Active negotiations with employer',
    escalated: 'Escalated to arbitration or higher level',
    resolved: 'Case has been resolved',
    withdrawn: 'Member has withdrawn the grievance',
    closed: 'Case is closed and archived',
  };
  return descriptions[state];
}


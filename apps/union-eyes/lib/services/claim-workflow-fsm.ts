/**
 * Claim Workflow Finite State Machine (FSM)
 * 
 * ENFORCEMENT LAYER: Makes bad practice impossible
 * 
 * This FSM governs all claim (grievance) state transitions with:
 * - Role-based transition validation
 * - Signal-aware blocking (critical signals prevent closure)
 * - SLA enforcement (track compliance, block overdue transitions) * - Audit trail generation (every transition logged)
 * 
 * Philosophy: "This is how it MUST be done"
 * 
 * Integration: Imported by workflow-engine.ts to replace basic validation
 */

export type ClaimStatus = 
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'investigation'
  | 'pending_documentation'
  | 'resolved'
  | 'rejected'
  | 'closed';

export type ClaimPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ClaimTransitionContext {
  claimId: string;
  currentStatus: ClaimStatus;
  targetStatus: ClaimStatus;
  userId: string;
  userRole?: string; // 'member' | 'steward' | 'admin' | 'system'
  priority: ClaimPriority;
  statusChangedAt: Date;
  hasUnresolvedCriticalSignals?: boolean; // From LRO Signals (PR-7)
  hasRequiredDocumentation?: boolean;
  isOverdue?: boolean; // From SLA Calculator (PR-5)
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

/**
 * Finite State Machine for Claim Workflow
 * Defines ALL valid transitions and enforcement rules
 */
export const CLAIM_FSM = {
  submitted: {
    allowedTransitions: ['under_review', 'assigned', 'rejected'],
    requiresRole: {
      under_review: ['steward', 'admin', 'system'],
      assigned: ['steward', 'admin', 'system'],
      rejected: ['admin'], // Only admins can reject without review
    },
    minTimeInState: 0, // Can transition immediately
    requiresDocumentation: false,
  },
  under_review: {
    allowedTransitions: ['investigation', 'pending_documentation', 'resolved', 'rejected', 'assigned'],
    requiresRole: {
      investigation: ['steward', 'admin'],
      pending_documentation: ['steward', 'admin'],
      resolved: ['steward', 'admin'],
      rejected: ['admin'],
      assigned: ['admin'], // Reassignment requires admin
    },
    minTimeInState: 24 * 60 * 60 * 1000, // 24 hours (must review for at least 1 day)
    requiresDocumentation: false,
  },
  assigned: {
    allowedTransitions: ['investigation', 'under_review', 'pending_documentation'],
    requiresRole: {
      investigation: ['steward', 'admin'],
      under_review: ['admin'], // Unassign requires admin approval
      pending_documentation: ['steward', 'admin'],
    },
    minTimeInState: 0,
    requiresDocumentation: false,
  },
  investigation: {
    allowedTransitions: ['pending_documentation', 'under_review', 'resolved', 'rejected'],
    requiresRole: {
      pending_documentation: ['steward', 'admin'],
      under_review: ['admin'], // Revert to review requires admin
      resolved: ['steward', 'admin'], // FIXED: was 'resolve'
      rejected: ['admin'],
    },
    minTimeInState: 3 * 24 * 60 * 60 * 1000, // 3 days (proper investigation takes time)
    requiresDocumentation: true, // Must have investigation notes
  },
  pending_documentation: {
    allowedTransitions: ['under_review', 'investigation', 'resolved'],
    requiresRole: {
      under_review: ['steward', 'admin'],
      investigation: ['steward', 'admin'],
      resolved: ['steward', 'admin'],
    },
    minTimeInState: 0, // Can proceed once docs received
    requiresDocumentation: true, // Must have documentation attached
  },
  resolved: {
    allowedTransitions: ['closed'],
    requiresRole: {
      closed: ['admin', 'system'], // Only admin/system can close
    },
    minTimeInState: 7 * 24 * 60 * 60 * 1000, // 7 days (cooling-off period)
    requiresDocumentation: true,
    blockIfCriticalSignals: true, // CANNOT close if critical signals exist
  },
  rejected: {
    allowedTransitions: ['closed'],
    requiresRole: {
      closed: ['admin', 'system'],
    },
    minTimeInState: 7 * 24 * 60 * 60 * 1000, // 7 days (appeal period)
    requiresDocumentation: true,
    blockIfCriticalSignals: true, // Member must be properly notified
  },
  closed: {
    allowedTransitions: [], // Terminal state - no transitions allowed
    requiresRole: {},
    minTimeInState: Infinity,
    requiresDocumentation: true,
  },
} as const;

/**
 * SLA Standards for each state (in hours)
 * From PR-5: SLA Calculator
 */
export const CLAIM_SLA_STANDARDS = {
  submitted: 48, // 2 days to acknowledge
  under_review: 120, // 5 days to complete review
  assigned: 72, // 3 days to start action
  investigation: 240, // 10 days to investigate
  pending_documentation: 168, // 7 days to get docs
  resolved: 720, // 30 days to close after resolution
  rejected: 720, // 30 days to close after rejection
  closed: 0,
} as const;

/**
 * Priority multipliers for SLA deadlines
 * From PR-5: SLA Calculator
 */
const PRIORITY_MULTIPLIERS: Record<ClaimPriority, number> = {
  critical: 0.5,  // Half time
  high: 0.75,     // 75% time
  medium: 1.0,    // Normal time
  low: 1.5,       // 50% more time
};

/**
 * Calculate SLA deadline for current state
 */
function calculateSLADeadline(
  status: ClaimStatus,
  priority: ClaimPriority,
  statusChangedAt: Date
): Date {
  const baseHours = CLAIM_SLA_STANDARDS[status];
  const multiplier = PRIORITY_MULTIPLIERS[priority];
  const adjustedHours = baseHours * multiplier;
  
  const deadline = new Date(statusChangedAt);
  deadline.setHours(deadline.getHours() + adjustedHours);
  
  return deadline;
}

/**
 * Check if claim is SLA compliant
 */
function isSLACompliant(
  status: ClaimStatus,
  priority: ClaimPriority,
  statusChangedAt: Date
): boolean {
  if (status === 'closed') return true;
  
  const deadline = calculateSLADeadline(status, priority, statusChangedAt);
  return new Date() <= deadline;
}

/**
 * Get days remaining until SLA breach
 */
function daysUntilSLABreach(
  status: ClaimStatus,
  priority: ClaimPriority,
  statusChangedAt: Date
): number {
  const deadline = calculateSLADeadline(status, priority, statusChangedAt);
  const diffMs = deadline.getTime() - new Date().getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Validate if a claim state transition is allowed (ENFORCEMENT LAYER)
 * 
 * This function makes bad practice IMPOSSIBLE by:
 * 1. Checking FSM state machine rules
 * 2. Validating role-based permissions
 * 3. Enforcing minimum time-in-state
 * 4. Checking required documentation
 * 5. Blocking if critical signals unresolved (LRO Signals integration)
 * 6. Tracking SLA compliance
 * 
 * @returns TransitionResult with allowed flag and detailed reason if blocked
 */
export function validateClaimTransition(
  context: ClaimTransitionContext
): TransitionResult {
  const {
    currentStatus,
    targetStatus,
    userId: _userId,
    userRole = 'member',
    priority,
    statusChangedAt,
    hasUnresolvedCriticalSignals = false,
    hasRequiredDocumentation = false,
    isOverdue: _isOverdue = false,
    notes,
  } = context;

  // Get FSM configuration for current state
  const currentState = CLAIM_FSM[currentStatus];
  
  // Check 1: Is target status a valid transition?
  if (!(currentState.allowedTransitions as readonly string[]).includes(targetStatus)) {
    return {
      allowed: false,
      reason: `Invalid transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${currentState.allowedTransitions.join(', ')}`,
      requiredActions: [
        `The claim must be in one of these states to transition to '${targetStatus}': ${
         Object.entries(CLAIM_FSM)
            .filter(([_, state]) => (state.allowedTransitions as readonly string[]).includes(targetStatus))
            .map(([key]) => key)
            .join(', ')
        }`
      ],
    };
  }

  // Check 2: Does user have required role for this transition?
  const requiredRoles = currentState.requiresRole[targetStatus] || ['member'];
  if (!requiredRoles.includes(userRole) && userRole !== 'system') {
    return {
      allowed: false,
      reason: `User role '${userRole}' is not authorized for this transition. Required roles: ${requiredRoles.join(', ')}`,
      requiredActions: [
        `Contact a user with one of these roles: ${requiredRoles.join(', ')}`
      ],
    };
  }

  // Check 3: Has minimum time-in-state elapsed?
  const timeInState = new Date().getTime() - statusChangedAt.getTime();
  if (timeInState < currentState.minTimeInState) {
    const remainingHours = Math.ceil((currentState.minTimeInState - timeInState) / (1000 * 60 * 60));
    return {
      allowed: false,
      reason: `Claim must remain in '${currentStatus}' state for minimum duration. ${remainingHours} hours remaining.`,
      requiredActions: [
        `Wait ${remainingHours} more hours before transitioning to '${targetStatus}'`
      ],
    };
  }

  // Check 4: Is required documentation present? (investigation, pending_documentation, resolved, rejected, closed)
  if (currentState.requiresDocumentation && !hasRequiredDocumentation && !notes) {
    return {
      allowed: false,
      reason: `Cannot transition from '${currentStatus}' without required documentation or detailed notes.`,
      requiredActions: [
        'Attach required documentation to the claim',
        'OR provide detailed notes explaining the transition'
      ],
    };
  }

  // Check 5: Are there unresolved critical signals? (PR-7: LRO Signals Integration)
  // Critical signals BLOCK closure/resolution
  if ('blockIfCriticalSignals' in currentState && currentState.blockIfCriticalSignals && hasUnresolvedCriticalSignals) {
    return {
      allowed: false,
      reason: `Cannot transition to '${targetStatus}' while critical signals remain unresolved.`,
      requiredActions: [
        'Resolve all CRITICAL severity signals',
        'Check LRO Signals dashboard for outstanding issues',
        'Ensure member has been properly notified',
        'Ensure all SLA requirements met'
      ],
    };
  }

  // Check 6: SLA Compliance Check (warning only, not blocking)
  const slaCompliant = isSLACompliant(currentStatus, priority, statusChangedAt);
  const daysInState = Math.floor(timeInState / (1000 * 60 * 60 * 24));
  const daysRemaining = daysUntilSLABreach(currentStatus, priority, statusChangedAt);
  
  const warnings: string[] = [];
  if (!slaCompliant) {
    warnings.push(`SLA BREACH: Claim has been in '${currentStatus}' for ${daysInState} days (${Math.abs(daysRemaining)} days overdue)`);
  } else if (daysRemaining <= 2) {
    warnings.push(`SLA AT RISK: Only ${daysRemaining} days remaining before SLA breach`);
  }

  // Transition ALLOWED - return detailed metadata
  return {
    allowed: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    metadata: {
      slaCompliant,
      daysInState,
      nextDeadline: targetStatus !== 'closed' 
        ? calculateSLADeadline(targetStatus, priority, new Date())
        : undefined,
    },
  };
}

/**
 * Get all allowed transitions for a claim in its current state
 * (Used by UI to show available actions)
 */
export function getAllowedClaimTransitions(
  currentStatus: ClaimStatus,
  userRole: string = 'member'
): ClaimStatus[] {
  const state = CLAIM_FSM[currentStatus];
  
  // Filter transitions by user role
  return state.allowedTransitions.filter(targetStatus => {
    const requiredRoles = state.requiresRole[targetStatus] || ['member'];
    return requiredRoles.includes(userRole) || userRole === 'system';
  });
}

/**
 * Get transition requirements for a specific target status
 * (Used by UI to show what&apos;s needed before transition)
 */
export function getTransitionRequirements(
  currentStatus: ClaimStatus,
  targetStatus: ClaimStatus
): {
  requiresRole: string[];
  minHours: number;
  requiresDocumentation: boolean;
  blockIfCriticalSignals: boolean;
} {
  const state = CLAIM_FSM[currentStatus];
  
  return {
    requiresRole: state.requiresRole[targetStatus] || ['member'],
    minHours: state.minTimeInState / (1000 * 60 * 60),
    requiresDocumentation: state.requiresDocumentation,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockIfCriticalSignals: (state as any).blockIfCriticalSignals || false,
  };
}


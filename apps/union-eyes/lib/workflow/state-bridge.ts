/**
 * State Bridge — Maps legacy FSM states to/from the unified CaseLifecycle.
 *
 * This module enables gradual migration from the four legacy FSMs to the
 * unified case-lifecycle.ts without requiring all consumers to update
 * simultaneously.
 *
 * Usage:
 *   import { toLegacyCaseState, toLifecycleState } from '@/lib/workflow/state-bridge';
 *   const legacy = toLegacyCaseState(lifecycleState);      // For old consumers
 *   const unified = toLifecycleState('case', legacyState); // For new consumers
 *
 * @see case-lifecycle.ts for the unified state definitions
 */

import type { LifecycleState, ResolutionType } from './case-lifecycle';
import type { CaseState } from '@/lib/services/case-workflow-fsm';
import type { ClaimStatus } from '@/lib/services/claim-workflow-fsm';
import type { GrievanceLifecycleStatus } from '@/lib/workflows/grievance-state-machine';

// ─── Legacy → Unified Mappings ──────────────────────────────────────────────

const CASE_WORKFLOW_MAP: Record<CaseState, LifecycleState> = {
  draft: 'draft',
  submitted: 'submitted',
  acknowledged: 'triage',
  investigating: 'investigation',
  pending_response: 'pending_docs',
  negotiating: 'negotiation',
  escalated: 'arbitration',
  resolved: 'resolved',
  withdrawn: 'closed', // resolution_type = 'withdrawn'
  closed: 'closed',
};

const CLAIM_WORKFLOW_MAP: Record<ClaimStatus, LifecycleState> = {
  submitted: 'submitted',
  under_review: 'triage',
  assigned: 'triage', // Assignment is now a field, not a state
  investigation: 'investigation',
  pending_documentation: 'pending_docs',
  resolved: 'resolved',
  rejected: 'closed', // resolution_type = 'denied'
  closed: 'closed',
};

const GRIEVANCE_MAP: Record<GrievanceLifecycleStatus, LifecycleState> = {
  draft: 'draft',
  converted: 'submitted', // Intake conversion → submitted
  closed_no_case: 'closed', // resolution_type = 'denied'
  new: 'submitted',
  triage: 'triage',
  investigation: 'investigation',
  negotiation: 'negotiation',
  arbitration: 'arbitration',
  resolved: 'resolved',
  closed: 'closed',
};

// CUPE vocabulary states (from @nzila/cupe-vocabulary)
const CUPE_VOCABULARY_MAP: Record<string, LifecycleState> = {
  draft: 'draft',
  filed: 'submitted',
  acknowledged: 'triage',
  investigating: 'investigation',
  response_due: 'negotiation',
  escalated: 'arbitration',
  mediation: 'mediation',
  arbitration: 'arbitration',
  settled: 'resolved',
  denied: 'closed', // resolution_type = 'denied'
  withdrawn: 'closed', // resolution_type = 'withdrawn'
  closed: 'closed',
};

// ─── Resolution type inference from legacy states ───────────────────────────

const RESOLUTION_INFERENCE: Record<string, ResolutionType> = {
  withdrawn: 'withdrawn',
  rejected: 'denied',
  denied: 'denied',
  closed_no_case: 'denied',
  settled: 'settled',
  resolved: 'settled',
};

// ─── Unified → Legacy Reverse Mappings ──────────────────────────────────────

const LIFECYCLE_TO_CASE_WORKFLOW: Record<LifecycleState, CaseState> = {
  draft: 'draft',
  submitted: 'submitted',
  triage: 'acknowledged',
  investigation: 'investigating',
  pending_docs: 'pending_response',
  negotiation: 'negotiating',
  mediation: 'escalated', // No mediation in case-workflow, closest is escalated
  arbitration: 'escalated',
  resolved: 'resolved',
  closed: 'closed',
};

const LIFECYCLE_TO_CLAIM: Record<LifecycleState, ClaimStatus> = {
  draft: 'submitted', // No draft in claims, starts at submitted
  submitted: 'submitted',
  triage: 'under_review',
  investigation: 'investigation',
  pending_docs: 'pending_documentation',
  negotiation: 'investigation', // No negotiation in claims, closest is investigation
  mediation: 'investigation',
  arbitration: 'investigation',
  resolved: 'resolved',
  closed: 'closed',
};

const LIFECYCLE_TO_GRIEVANCE: Record<LifecycleState, GrievanceLifecycleStatus> = {
  draft: 'draft',
  submitted: 'new',
  triage: 'triage',
  investigation: 'investigation',
  pending_docs: 'investigation', // No pending_docs in grievance FSM
  negotiation: 'negotiation',
  mediation: 'negotiation', // No mediation in grievance FSM, closest is negotiation
  arbitration: 'arbitration',
  resolved: 'resolved',
  closed: 'closed',
};

// ─── Public API ──────────────────────────────────────────────────────────────

type LegacyFSM = 'case' | 'claim' | 'grievance' | 'cupe';

/**
 * Convert a legacy state to the unified LifecycleState.
 * Returns null if the state is not recognized.
 */
export function toLifecycleState(fsm: LegacyFSM, legacyState: string): LifecycleState | null {
  switch (fsm) {
    case 'case':
      return CASE_WORKFLOW_MAP[legacyState as CaseState] ?? null;
    case 'claim':
      return CLAIM_WORKFLOW_MAP[legacyState as ClaimStatus] ?? null;
    case 'grievance':
      return GRIEVANCE_MAP[legacyState as GrievanceLifecycleStatus] ?? null;
    case 'cupe':
      return CUPE_VOCABULARY_MAP[legacyState] ?? null;
    default:
      return null;
  }
}

/**
 * Infer the resolution type from a legacy state.
 * Returns null if the state doesn't imply a specific resolution.
 */
export function inferResolutionType(legacyState: string): ResolutionType | null {
  return RESOLUTION_INFERENCE[legacyState] ?? null;
}

/**
 * Convert a unified LifecycleState to a legacy FSM state.
 */
export function toLegacyCaseState(state: LifecycleState): CaseState {
  return LIFECYCLE_TO_CASE_WORKFLOW[state];
}

export function toLegacyClaimStatus(state: LifecycleState): ClaimStatus {
  return LIFECYCLE_TO_CLAIM[state];
}

export function toLegacyGrievanceStatus(state: LifecycleState): GrievanceLifecycleStatus {
  return LIFECYCLE_TO_GRIEVANCE[state];
}

/**
 * Bulk-convert legacy states. Useful for database migration scripts.
 */
export function migrateStates(
  fsm: LegacyFSM,
  states: string[],
): Array<{ legacy: string; unified: LifecycleState | null; resolutionType: ResolutionType | null }> {
  return states.map((legacy) => ({
    legacy,
    unified: toLifecycleState(fsm, legacy),
    resolutionType: inferResolutionType(legacy),
  }));
}

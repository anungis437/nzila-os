/**
 * Governance policy evaluation engine.
 *
 * `evaluatePolicy()` takes a contract and a context, applies the contract's
 * governance rules, and returns a `PolicyEvaluationResult`.
 *
 * When the contract is in `'shadow'` mode, failures are NEVER blocking —
 * the result records what WOULD have happened. When in `'enforce'` mode,
 * the caller should act on `allowed: false` by rejecting the operation.
 *
 * The in-process decision ledger accumulates all evaluations for the lifetime
 * of the process. `flushDecisionLedger()` returns and clears the ledger —
 * used by the ledger generator script to persist `reports/governance-decision-ledger.json`.
 *
 * @module lib/governance-policy/evaluation
 */

import type { GovernancePolicyContract } from './contracts';
import type { GovernanceSensitivity, GovernanceRequirement, EvaluationMode } from './types';

// ── Evaluation context ────────────────────────────────────────────────────────

/**
 * Runtime context passed to `evaluatePolicy()`.
 * Only the fields relevant to the contract's requirements need to be populated.
 */
export interface PolicyEvaluationContext {
  /** Stable operation identifier (route path, surface id, export type, etc.). */
  operationId: string;

  /** Actor performing the operation. */
  actor?: {
    userId: string;
    role: string;
    orgId: string;
  };

  /** True if the operation targets a publicly visible surface or output. */
  isPublic?: boolean;

  /** True if the operation crosses org boundaries. */
  isCrossOrg?: boolean;

  /** True if the operation involves federation-level data or publication. */
  isFederation?: boolean;

  /** True if executive approval has been pre-confirmed for this operation. */
  executiveApproved?: boolean;

  /** True if legal review has been pre-confirmed. */
  legalReviewComplete?: boolean;

  /** True if the federation parent has approved the operation. */
  federationApproved?: boolean;
}

// ── Evaluation result ─────────────────────────────────────────────────────────

/**
 * The outcome of evaluating a policy contract against a context.
 */
export interface PolicyEvaluationResult {
  contractId: string;
  operationId: string;
  mode: EvaluationMode;

  /**
   * Whether the operation is allowed under this contract.
   * In `shadow` mode this is always `true` — it represents what WOULD be
   * allowed if the contract were in `enforce` mode.
   */
  allowed: boolean;

  /**
   * Unmet requirements. Non-empty when `allowed` would be `false` in enforce mode.
   * In shadow mode, these are surfaced as warnings only.
   */
  unmetRequirements: GovernanceRequirement[];

  /** Sensitivity tier from the contract. */
  sensitivity: GovernanceSensitivity;

  /** Whether an audit log entry should be emitted. */
  shouldAudit: boolean;

  /** ISO 8601 timestamp of this evaluation. */
  evaluatedAt: string;

  /** Informational notes about this evaluation for ledger/evidence purposes. */
  notes: string[];
}

// ── Decision ledger ───────────────────────────────────────────────────────────

const _ledger: PolicyEvaluationResult[] = [];

/**
 * Append an evaluation result to the in-process decision ledger.
 * Called automatically by `evaluatePolicy()`.
 */
function _recordDecision(result: PolicyEvaluationResult): void {
  _ledger.push(result);
}

/**
 * Return all accumulated evaluation results and clear the ledger.
 * Used by `scripts/generate-governance-ledger.ts`.
 */
export function flushDecisionLedger(): PolicyEvaluationResult[] {
  const snapshot = [..._ledger];
  _ledger.length = 0;
  return snapshot;
}

/**
 * Return a read-only view of the current ledger without clearing it.
 */
export function peekDecisionLedger(): readonly PolicyEvaluationResult[] {
  return _ledger;
}

// ── Core evaluation ───────────────────────────────────────────────────────────

/**
 * Evaluate a governance policy contract against the provided runtime context.
 *
 * Shadow mode: never blocks — records what WOULD have been blocked.
 * Enforce mode: `allowed: false` means the caller MUST reject the operation.
 *
 * The result is always appended to the in-process decision ledger.
 */
export function evaluatePolicy(
  contract: GovernancePolicyContract,
  context: PolicyEvaluationContext,
): PolicyEvaluationResult {
  const notes: string[] = [];
  const unmet: GovernanceRequirement[] = [];

  // ── Requirement checks ────────────────────────────────────────────────────

  if (contract.requirements.includes('executive-approval')) {
    if (!context.executiveApproved) {
      unmet.push('executive-approval');
      notes.push('executive-approval: not confirmed in context');
    }
  }

  if (contract.requirements.includes('legal-review')) {
    if (!context.legalReviewComplete) {
      unmet.push('legal-review');
      notes.push('legal-review: not confirmed in context');
    }
  }

  if (contract.requirements.includes('federation-review')) {
    if (!context.federationApproved) {
      unmet.push('federation-review');
      notes.push('federation-review: parent federation approval not confirmed');
    }
  }

  if (contract.orgScoping === 'strict' && context.isCrossOrg) {
    unmet.push('audit'); // treat strict org-scoping violation as audit-worthy
    notes.push('org-scoping: cross-org access attempted on strict-scoped contract');
  }

  if (contract.publicVisibility && context.isPublic && !context.executiveApproved) {
    if (!unmet.includes('executive-approval')) {
      unmet.push('executive-approval');
      notes.push('public-visibility: executive approval required for public surface');
    }
  }

  // ── Mode resolution ───────────────────────────────────────────────────────

  const hasUnmet = unmet.length > 0;
  const mode = contract.mode;

  // In shadow mode: allowed is always true (observation only)
  // In enforce mode: allowed = no unmet requirements
  const allowed = mode === 'shadow' ? true : !hasUnmet;

  if (mode === 'shadow' && hasUnmet) {
    notes.push(`[shadow] Would have blocked: ${unmet.join(', ')}`);
  }

  const result: PolicyEvaluationResult = {
    contractId: contract.id,
    operationId: context.operationId,
    mode,
    allowed,
    unmetRequirements: unmet,
    sensitivity: contract.sensitivity,
    shouldAudit: contract.auditRequired,
    evaluatedAt: new Date().toISOString(),
    notes,
  };

  _recordDecision(result);
  return result;
}

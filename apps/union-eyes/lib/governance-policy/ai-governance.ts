/**
 * AI governance classification layer.
 *
 * Provides risk classification, human-review gating, and audit requirements
 * for AI/ML operations in Union Eyes. This module is the runtime enforcement
 * point for labour-safe AI governance.
 *
 * The three principles:
 *
 * 1. Every AI action has a risk tier.
 * 2. High-risk tiers require human review before the result is acted upon.
 * 3. All AI actions that touch member data or produce externally visible output
 *    must emit an audit trail.
 *
 * @module lib/governance-policy/ai-governance
 */

import type { AIActionRisk } from './types';

// ── AI action descriptor ───────────────────────────────────────────────────────

/**
 * Descriptor for an AI operation submitted for governance evaluation.
 */
export interface AIActionDescriptor {
  /** Stable identifier for this operation type (e.g. `"grievance.summarise"`). */
  operationId: string;

  /** Human-readable label for audit logs and procurement reports. */
  label: string;

  /** Risk tier of this operation. */
  risk: AIActionRisk;

  /**
   * Whether this operation accesses or produces member-identifying data.
   * Automatically elevates audit severity if true.
   */
  touchesMemberData: boolean;

  /**
   * Whether the AI output may be published or surfaced publicly.
   * If true, requires `executive-approval` governance contract requirement.
   */
  outputPubliclyVisible: boolean;

  /**
   * Whether this operation modifies persistent state
   * (e.g. auto-creates a case draft, updates a member record).
   */
  mutatesState: boolean;
}

// ── Evaluation result ─────────────────────────────────────────────────────────

/**
 * Governance ruling for a submitted AI action.
 */
export interface AIGovernanceResult {
  operationId: string;
  risk: AIActionRisk;

  /** Whether a human must review the AI output before it is acted upon. */
  humanReviewRequired: boolean;

  /** Whether an audit log entry must be emitted for this action. */
  auditRequired: boolean;

  /**
   * Whether this action is currently permitted under active governance rules.
   * When `false`, the action must not proceed regardless of mode.
   */
  permitted: boolean;

  /**
   * Descriptive reason when `permitted` is false or `humanReviewRequired` is true.
   */
  rationale?: string;

  // ── Wave 8 governance telemetry trace fields ───────────────────────────────

  /**
   * Whether the evaluation result should be propagated to the governance
   * observability telemetry pipeline. Always `true` for sensitive/restricted.
   */
  aiGovernanceTrace: boolean;

  /**
   * Whether a human review was actually triggered (as opposed to merely required).
   * Set by the caller after the review workflow is initiated; defaults to same
   * as `humanReviewRequired` at evaluation time.
   */
  humanReviewTriggered: boolean;

  /**
   * Whether this action caused a sensitive-operation escalation event to be
   * recorded (e.g. federation restriction, public-output denial, restricted tier).
   */
  sensitiveOperationEscalated: boolean;
}

// ── Risk classification rules ─────────────────────────────────────────────────

const RISK_RANK: Record<AIActionRisk, number> = {
  assistive: 0,
  advisory: 1,
  sensitive: 2,
  restricted: 3,
};

/**
 * Return true if the given risk tier meets or exceeds the threshold tier.
 */
export function riskAtLeast(risk: AIActionRisk, threshold: AIActionRisk): boolean {
  return RISK_RANK[risk] >= RISK_RANK[threshold];
}

// ── Evaluation ────────────────────────────────────────────────────────────────

/**
 * Evaluate the governance requirements for a submitted AI action.
 *
 * Governance rules:
 * - `restricted` → always requires human review; blocked if publicly visible.
 * - `sensitive`  → requires human review; audit mandatory.
 * - `advisory`   → audit mandatory; no automatic review gate.
 * - `assistive`  → audit mandatory only if touches member data.
 * - Any action touching member data elevates to at minimum `advisory` audit.
 * - Public-output actions require `restricted` treatment unless already higher.
 */
export function evaluateAIAction(
  descriptor: AIActionDescriptor,
): AIGovernanceResult {
  const { operationId, risk, touchesMemberData, outputPubliclyVisible, mutatesState } =
    descriptor;

  if (risk === 'restricted') {
    return {
      operationId,
      risk,
      humanReviewRequired: true,
      auditRequired: true,
      permitted: true,
      rationale: 'Restricted AI actions always require human review before use.',
      aiGovernanceTrace: true,
      humanReviewTriggered: true,
      sensitiveOperationEscalated: true,
    };
  }

  if (risk === 'sensitive') {
    return {
      operationId,
      risk,
      humanReviewRequired: true,
      auditRequired: true,
      permitted: true,
      rationale: 'Sensitive AI actions require human review due to member data or labour record involvement.',
      aiGovernanceTrace: true,
      humanReviewTriggered: true,
      sensitiveOperationEscalated: false,
    };
  }

  if (outputPubliclyVisible && riskAtLeast(risk, 'advisory')) {
    return {
      operationId,
      risk,
      humanReviewRequired: true,
      auditRequired: true,
      permitted: true,
      rationale: 'AI output with public visibility requires human review before publication.',
      aiGovernanceTrace: true,
      humanReviewTriggered: true,
      sensitiveOperationEscalated: true,
    };
  }

  if (risk === 'advisory' || mutatesState) {
    return {
      operationId,
      risk,
      humanReviewRequired: false,
      auditRequired: true,
      permitted: true,
      aiGovernanceTrace: true,
      humanReviewTriggered: false,
      sensitiveOperationEscalated: false,
    };
  }

  if (touchesMemberData) {
    return {
      operationId,
      risk,
      humanReviewRequired: false,
      auditRequired: true,
      permitted: true,
      aiGovernanceTrace: true,
      humanReviewTriggered: false,
      sensitiveOperationEscalated: false,
    };
  }

  return {
    operationId,
    risk,
    humanReviewRequired: false,
    auditRequired: false,
    permitted: true,
    aiGovernanceTrace: false,
    humanReviewTriggered: false,
    sensitiveOperationEscalated: false,
  };
}

// ── Built-in UE AI operation descriptors ──────────────────────────────────────

/**
 * Registry of known Union Eyes AI operations.
 * Kept here for discoverability and CI validation.
 */
export const UE_AI_OPERATIONS: AIActionDescriptor[] = [
  {
    operationId: 'grievance.summarise',
    label: 'Grievance summarisation',
    risk: 'sensitive',
    touchesMemberData: true,
    outputPubliclyVisible: false,
    mutatesState: false,
  },
  {
    operationId: 'case.recommendation',
    label: 'Case outcome recommendation',
    risk: 'advisory',
    touchesMemberData: true,
    outputPubliclyVisible: false,
    mutatesState: false,
  },
  {
    operationId: 'contract.extract',
    label: 'CBA clause extraction (LCI)',
    risk: 'advisory',
    touchesMemberData: false,
    outputPubliclyVisible: false,
    mutatesState: false,
  },
  {
    operationId: 'document.draft',
    label: 'Document draft generation',
    risk: 'sensitive',
    touchesMemberData: true,
    outputPubliclyVisible: false,
    mutatesState: true,
  },
  {
    operationId: 'communication.draft',
    label: 'Communication draft for member distribution',
    risk: 'restricted',
    touchesMemberData: true,
    outputPubliclyVisible: true,
    mutatesState: true,
  },
  {
    operationId: 'search.autocomplete',
    label: 'Search autocomplete hint',
    risk: 'assistive',
    touchesMemberData: false,
    outputPubliclyVisible: false,
    mutatesState: false,
  },
];

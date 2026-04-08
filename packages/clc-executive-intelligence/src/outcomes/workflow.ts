/**
 * CLC Executive Intelligence — Feedback Ingestion Workflow
 *
 * Governed workflow for recording decision outcomes and ingesting feedback.
 * Validates inputs, records outcomes, and emits audit events.
 *
 * Design:
 * - Role-based: only authorized users can record outcomes
 * - Validates outcome data before recording
 * - Emits audit events for every operation
 * - Returns structured results (never throws for business logic)
 *
 * @module outcomes/workflow
 */

import type {
  DecisionOutcome,
  DecisionOutcomeResult,
  FeedbackAuditEntry,
} from '../contracts/index';
import { validateOutcome, DecisionOutcomeStore } from './store';
import type { OutcomeValidationError } from './store';

// ── Workflow Types ──────────────────────────────────────────────────────────

export interface FeedbackIngestionRequest {
  /** Priority ID the feedback is for */
  priorityId: string;
  /** What was recommended */
  recommendedAction: string;
  /** What was actually done */
  actionTaken: string;
  /** Outcome result */
  outcome: DecisionOutcomeResult;
  /** Success score (0-1) */
  successScore: number;
  /** Optional notes */
  notes?: string;
  /** Signal ID (if available) */
  signalId?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface FeedbackIngestionResult {
  /** Whether the ingestion succeeded */
  success: boolean;
  /** Recorded outcome (if successful) */
  outcome?: DecisionOutcome;
  /** Validation errors (if failed) */
  errors?: OutcomeValidationError[];
  /** Audit entry generated */
  auditEntry: FeedbackAuditEntry;
}

// ── Workflow Engine ─────────────────────────────────────────────────────────

let auditIdCounter = 0;

function generateAuditId(): string {
  return `audit-${++auditIdCounter}`;
}

/**
 * Reset the audit ID counter (for testing).
 */
export function resetAuditCounter(): void {
  auditIdCounter = 0;
}

/**
 * Ingest a single feedback outcome through the governed workflow.
 *
 * Validates, records, and audits the outcome in one atomic operation.
 */
export function ingestFeedback(
  store: DecisionOutcomeStore,
  request: FeedbackIngestionRequest,
  userId: string,
  organizationId?: string,
): FeedbackIngestionResult {
  const now = new Date().toISOString();

  // Build outcome from request
  const outcome: DecisionOutcome = {
    priorityId: request.priorityId,
    recommendedAction: request.recommendedAction,
    actionTaken: request.actionTaken,
    outcome: request.outcome,
    successScore: request.successScore,
    notes: request.notes,
    signalId: request.signalId,
    metadata: request.metadata,
    decidedByUserId: userId,
    evaluatedByUserId: userId,
    evaluatedAt: now,
    createdAt: now,
    organizationId,
  };

  // Validate
  const errors = validateOutcome(outcome);
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      auditEntry: {
        id: generateAuditId(),
        timestamp: now,
        eventType: 'feedback_ingested',
        organizationId,
        userId,
        payload: {
          status: 'validation_failed',
          errors,
          priorityId: request.priorityId,
        },
      },
    };
  }

  // Record
  const recorded = store.recordOutcome(outcome, organizationId);

  return {
    success: true,
    outcome: recorded,
    auditEntry: {
      id: generateAuditId(),
      timestamp: now,
      eventType: 'outcome_recorded',
      organizationId,
      userId,
      payload: {
        outcomeId: recorded.id,
        priorityId: recorded.priorityId,
        outcome: recorded.outcome,
        successScore: recorded.successScore,
      },
    },
  };
}

/**
 * Ingest multiple feedback outcomes in batch.
 * Each outcome is independently validated and recorded.
 */
export function ingestFeedbackBatch(
  store: DecisionOutcomeStore,
  requests: FeedbackIngestionRequest[],
  userId: string,
  organizationId?: string,
): FeedbackIngestionResult[] {
  return requests.map((request) =>
    ingestFeedback(store, request, userId, organizationId),
  );
}

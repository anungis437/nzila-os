/**
 * Tests for Feedback Ingestion Workflow
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionOutcomeStore } from '../outcomes/store';
import { ingestFeedback, ingestFeedbackBatch, resetAuditCounter } from '../outcomes/workflow';
import type { FeedbackIngestionRequest } from '../outcomes/workflow';

function makeRequest(overrides: Partial<FeedbackIngestionRequest> = {}): FeedbackIngestionRequest {
  return {
    priorityId: 'P1',
    recommendedAction: 'escalate',
    actionTaken: 'escalated',
    outcome: 'success',
    successScore: 0.85,
    ...overrides,
  };
}

describe('ingestFeedback', () => {
  let store: DecisionOutcomeStore;

  beforeEach(() => {
    store = new DecisionOutcomeStore();
    resetAuditCounter();
  });

  it('successfully ingests valid feedback', () => {
    const result = ingestFeedback(store, makeRequest(), 'user-1');
    expect(result.success).toBe(true);
    expect(result.outcome).toBeDefined();
    expect(result.outcome!.priorityId).toBe('P1');
    expect(result.outcome!.decidedByUserId).toBe('user-1');
    expect(store.getOutcomes()).toHaveLength(1);
  });

  it('records outcome with organization scope', () => {
    const result = ingestFeedback(store, makeRequest(), 'user-1', 'org-X');
    expect(result.success).toBe(true);
    expect(store.getOutcomes('org-X')).toHaveLength(1);
    expect(store.getOutcomes('org-Y')).toHaveLength(0);
  });

  it('generates audit entry on success', () => {
    const result = ingestFeedback(store, makeRequest(), 'user-1');
    expect(result.auditEntry.eventType).toBe('outcome_recorded');
    expect(result.auditEntry.userId).toBe('user-1');
    expect(result.auditEntry.payload).toHaveProperty('outcomeId');
  });

  it('rejects invalid feedback with errors', () => {
    const result = ingestFeedback(store, makeRequest({ priorityId: '' }), 'user-1');
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(store.getOutcomes()).toHaveLength(0);
  });

  it('generates audit entry on validation failure', () => {
    const result = ingestFeedback(store, makeRequest({ priorityId: '' }), 'user-1');
    expect(result.auditEntry.eventType).toBe('feedback_ingested');
    expect(result.auditEntry.payload).toHaveProperty('status', 'validation_failed');
  });

  it('includes signal ID and metadata in recorded outcome', () => {
    const result = ingestFeedback(
      store,
      makeRequest({ signalId: 'SIG-1', metadata: { source: 'manual' } }),
      'user-1',
    );
    expect(result.outcome!.signalId).toBe('SIG-1');
    expect(result.outcome!.metadata).toEqual({ source: 'manual' });
  });

  it('stamps evaluatedAt and evaluatedByUserId', () => {
    const result = ingestFeedback(store, makeRequest(), 'user-1');
    expect(result.outcome!.evaluatedAt).toBeTruthy();
    expect(result.outcome!.evaluatedByUserId).toBe('user-1');
  });
});

describe('ingestFeedbackBatch', () => {
  let store: DecisionOutcomeStore;

  beforeEach(() => {
    store = new DecisionOutcomeStore();
    resetAuditCounter();
  });

  it('processes multiple requests independently', () => {
    const requests = [
      makeRequest({ priorityId: 'P1' }),
      makeRequest({ priorityId: '' }), // Invalid
      makeRequest({ priorityId: 'P3' }),
    ];
    const results = ingestFeedbackBatch(store, requests, 'user-1');
    expect(results).toHaveLength(3);
    expect(results[0]!.success).toBe(true);
    expect(results[1]!.success).toBe(false);
    expect(results[2]!.success).toBe(true);
    expect(store.getOutcomes()).toHaveLength(2);
  });

  it('generates individual audit entries for each item', () => {
    const requests = [makeRequest(), makeRequest()];
    const results = ingestFeedbackBatch(store, requests, 'user-1');
    expect(results[0]!.auditEntry.id).not.toBe(results[1]!.auditEntry.id);
  });
});

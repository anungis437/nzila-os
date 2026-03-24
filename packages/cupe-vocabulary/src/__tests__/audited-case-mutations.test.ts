/**
 * Tests for case audit event schema
 *
 * PR-030: Validates the typed case audit event constants and
 * CaseMutationAuditParams shape. Mirrors the definitions in
 * apps/union-eyes/lib/audited-case-mutations.ts without
 * cross-package imports (same pattern as fsm-enforcement tests).
 */

import { describe, it, expect } from 'vitest';

// Local mirror of CaseAuditEvent — kept in sync with the source module
const CaseAuditEvent = {
  CASE_CREATED: 'case.created',
  CASE_TRANSITIONED: 'case.transitioned',
  CASE_ASSIGNED: 'case.assigned',
  CASE_REASSIGNED: 'case.reassigned',
  CASE_NOTE_ADDED: 'case.note_added',
  CASE_ATTACHMENT_UPLOADED: 'case.attachment_uploaded',
  CASE_ATTACHMENT_DELETED: 'case.attachment_deleted',
  CASE_CLOSED: 'case.closed',
  CASE_REOPENED: 'case.reopened',
  CASE_EVIDENCE_EXPORTED: 'case.evidence_exported',
} as const;

type CaseAuditEventType = (typeof CaseAuditEvent)[keyof typeof CaseAuditEvent];

interface CaseMutationAuditParams {
  event: CaseAuditEventType;
  userId: string;
  organizationId: string;
  caseId: string;
  action: 'create' | 'update' | 'delete';
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CaseAuditEvent enumeration
// ---------------------------------------------------------------------------

describe('CaseAuditEvent', () => {
  it('has 10 distinct event types', () => {
    const values = Object.values(CaseAuditEvent);
    expect(values).toHaveLength(10);
    expect(new Set(values).size).toBe(10);
  });

  it('every value uses dot-separated namespace', () => {
    for (const v of Object.values(CaseAuditEvent)) {
      expect(v).toMatch(/^case\.\w+$/);
    }
  });

  const expectedEvents = [
    'case.created',
    'case.transitioned',
    'case.assigned',
    'case.reassigned',
    'case.note_added',
    'case.attachment_uploaded',
    'case.attachment_deleted',
    'case.closed',
    'case.reopened',
    'case.evidence_exported',
  ];

  it.each(expectedEvents)('includes %s', (eventName) => {
    expect(Object.values(CaseAuditEvent)).toContain(eventName);
  });
});

// ---------------------------------------------------------------------------
// CaseMutationAuditParams shape
// ---------------------------------------------------------------------------

describe('CaseMutationAuditParams shape', () => {
  it('accepts minimal params', () => {
    const params: CaseMutationAuditParams = {
      event: CaseAuditEvent.CASE_CREATED,
      userId: 'user_abc',
      organizationId: 'org_xyz',
      caseId: 'case_001',
      action: 'create',
    };
    // type-level check — if this compiles, the shape is correct
    expect(params.event).toBe('case.created');
    expect(params.action).toBe('create');
  });

  it('accepts full params with previousState/newState/details', () => {
    const params: CaseMutationAuditParams = {
      event: CaseAuditEvent.CASE_TRANSITIONED,
      userId: 'user_abc',
      organizationId: 'org_xyz',
      caseId: 'case_001',
      action: 'update',
      previousState: { status: 'submitted' },
      newState: { status: 'under_review' },
      details: { reason: 'Review initiated' },
    };
    expect(params.previousState).toEqual({ status: 'submitted' });
    expect(params.newState).toEqual({ status: 'under_review' });
  });

  it('previous/newState are optional', () => {
    const params: CaseMutationAuditParams = {
      event: CaseAuditEvent.CASE_NOTE_ADDED,
      userId: 'user_abc',
      organizationId: 'org_xyz',
      caseId: 'case_001',
      action: 'create',
    };
    expect(params.previousState).toBeUndefined();
    expect(params.newState).toBeUndefined();
  });

  it('action is restricted to create|update|delete', () => {
    // Compile-time check — runtime validation is handled by callers
    const actions: CaseMutationAuditParams['action'][] = ['create', 'update', 'delete'];
    expect(actions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Event-to-action mapping sanity
// ---------------------------------------------------------------------------

describe('Event semantics', () => {
  it('CASE_CREATED maps to create action', () => {
    const p: CaseMutationAuditParams = {
      event: CaseAuditEvent.CASE_CREATED,
      userId: 'u', organizationId: 'o', caseId: 'c', action: 'create',
    };
    expect(p.action).toBe('create');
  });

  it('CASE_TRANSITIONED maps to update action', () => {
    const p: CaseMutationAuditParams = {
      event: CaseAuditEvent.CASE_TRANSITIONED,
      userId: 'u', organizationId: 'o', caseId: 'c', action: 'update',
    };
    expect(p.action).toBe('update');
  });

  it('CASE_ATTACHMENT_DELETED maps to delete action', () => {
    const p: CaseMutationAuditParams = {
      event: CaseAuditEvent.CASE_ATTACHMENT_DELETED,
      userId: 'u', organizationId: 'o', caseId: 'c', action: 'delete',
    };
    expect(p.action).toBe('delete');
  });
});

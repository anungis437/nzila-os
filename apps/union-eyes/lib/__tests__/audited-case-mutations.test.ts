import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  auditDataMutation: vi.fn().mockResolvedValue(undefined),
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/audit-logger', () => ({
  auditDataMutation: mocks.auditDataMutation,
  auditLog: mocks.auditLog,
  AuditSeverity: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' },
}));

import {
  auditCaseMutation,
  auditCaseExport,
  CaseAuditEvent,
} from '../audited-case-mutations';

describe('audited-case-mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CaseAuditEvent has expected event types', () => {
    expect(CaseAuditEvent.CASE_CREATED).toBe('case.created');
    expect(CaseAuditEvent.CASE_TRANSITIONED).toBe('case.transitioned');
    expect(CaseAuditEvent.CASE_CLOSED).toBe('case.closed');
    expect(CaseAuditEvent.CASE_EVIDENCE_EXPORTED).toBe('case.evidence_exported');
  });

  it('auditCaseMutation delegates to auditDataMutation with correct params', async () => {
    await auditCaseMutation({
      event: CaseAuditEvent.CASE_CREATED,
      userId: 'user-1',
      organizationId: 'org-1',
      caseId: 'case-1',
      action: 'create',
      newState: { status: 'submitted' },
      details: { source: 'api' },
    });

    expect(mocks.auditDataMutation).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
      resource: 'claims',
      resourceId: 'case-1',
      action: 'create',
      previousState: undefined,
      newState: { status: 'submitted' },
      details: {
        event: 'case.created',
        caseId: 'case-1',
        source: 'api',
      },
    });
  });

  it('auditCaseMutation includes previousState for transitions', async () => {
    await auditCaseMutation({
      event: CaseAuditEvent.CASE_TRANSITIONED,
      userId: 'user-2',
      organizationId: 'org-1',
      caseId: 'case-2',
      action: 'update',
      previousState: { status: 'submitted' },
      newState: { status: 'under_review' },
    });

    expect(mocks.auditDataMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        previousState: { status: 'submitted' },
        newState: { status: 'under_review' },
      }),
    );
  });

  it('auditCaseExport logs export event via auditLog', async () => {
    await auditCaseExport({
      userId: 'user-1',
      organizationId: 'org-1',
      caseId: 'case-3',
      format: 'zip',
    });

    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'case.evidence_exported',
        severity: 'HIGH',
        resource: 'claims',
        resourceId: 'case-3',
        action: 'export',
        details: expect.objectContaining({ format: 'zip' }),
        outcome: 'success',
      }),
    );
  });
});

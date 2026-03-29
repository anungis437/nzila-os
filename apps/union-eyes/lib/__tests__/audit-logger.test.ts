import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockValues.mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  auditLogs: {},
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../db/with-rls-context', () => ({
  withRLSContext: vi.fn((fn: () => unknown) => fn()),
}));

import {
  auditLog,
  auditDataAccess,
  AuditEventType,
  AuditSeverity,
} from '../audit-logger';

describe('audit-logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auditLog logs to structured logger', async () => {
    const { logger } = await import('../logger');

    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      userId: 'u1',
      organizationId: 'org-1',
      resource: 'claims',
      action: 'read',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Audit Event',
      expect.objectContaining({
        eventType: AuditEventType.DATA_ACCESS,
        userId: 'u1',
      })
    );
  });

  it('auditLog writes to DB when organizationId present', async () => {
    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      organizationId: 'org-1',
      userId: 'u1',
      resource: 'claims',
    });

    // The withRLSContext mock passes through, so insert should be called
    expect(mocks.mockInsert).toHaveBeenCalled();
  });

  it('auditLog does not throw on DB error', async () => {
    mocks.mockInsert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB down')),
    });

    await expect(
      auditLog({
        eventType: AuditEventType.SYSTEM_ERROR,
        organizationId: 'org-1',
      })
    ).resolves.not.toThrow();
  });

  it('auditDataAccess calls auditLog with DATA_ACCESS type', async () => {
    const { logger } = await import('../logger');

    await auditDataAccess({
      userId: 'u1',
      organizationId: 'org-1',
      resource: 'claims',
      action: 'read',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Audit Event',
      expect.objectContaining({
        eventType: AuditEventType.DATA_ACCESS,
        severity: AuditSeverity.LOW,
        outcome: 'success',
      })
    );
  });

  it('AuditEventType enum has expected values', () => {
    expect(AuditEventType.AUTH_LOGIN).toBe('auth.login');
    expect(AuditEventType.DATA_CREATE).toBe('data.create');
    expect(AuditEventType.PII_ACCESS).toBe('pii.access');
  });
});

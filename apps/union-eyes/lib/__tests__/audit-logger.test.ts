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
  auditDataMutation,
  auditPIIAccess,
  auditSecurityEvent,
  auditAdminAction,
  auditBulkOperation,
  getClientIp,
  getUserAgent,
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

  describe('auditDataMutation', () => {
    it('logs create mutation with MEDIUM severity', async () => {
      const { logger } = await import('../logger');

      await auditDataMutation({
        userId: 'u1',
        organizationId: 'org-1',
        resource: 'claims',
        resourceId: 'c1',
        action: 'create',
        newState: { title: 'New Claim' },
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          eventType: AuditEventType.DATA_CREATE,
          severity: AuditSeverity.MEDIUM,
        })
      );
    });

    it('logs delete mutation with HIGH severity', async () => {
      const { logger } = await import('../logger');

      await auditDataMutation({
        userId: 'u1',
        organizationId: 'org-1',
        resource: 'claims',
        resourceId: 'c1',
        action: 'delete',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          eventType: AuditEventType.DATA_DELETE,
          severity: AuditSeverity.HIGH,
        })
      );
    });

    it('logs update mutation', async () => {
      await auditDataMutation({
        userId: 'u2',
        organizationId: 'org-2',
        resource: 'agreements',
        resourceId: 'a1',
        action: 'update',
        previousState: { status: 'draft' },
        newState: { status: 'active' },
      });

      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  describe('auditPIIAccess', () => {
    it('logs PII access with HIGH severity', async () => {
      const { logger } = await import('../logger');

      await auditPIIAccess({
        userId: 'u1',
        organizationId: 'org-1',
        resource: 'members',
        resourceId: 'm1',
        fields: ['email', 'phone'],
        reason: 'support request',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          eventType: AuditEventType.PII_ACCESS,
          severity: AuditSeverity.HIGH,
          action: 'access_pii',
        })
      );
    });
  });

  describe('auditSecurityEvent', () => {
    it('logs security event with defaults', async () => {
      const { logger } = await import('../logger');

      await auditSecurityEvent({
        eventType: AuditEventType.AUTH_LOGIN,
        userId: 'u1',
        details: { method: 'oauth' },
        outcome: 'success',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          eventType: AuditEventType.AUTH_LOGIN,
          severity: AuditSeverity.HIGH,
        })
      );
    });

    it('logs failed security event', async () => {
      await auditSecurityEvent({
        eventType: AuditEventType.AUTH_LOGIN,
        details: { reason: 'invalid password' },
        outcome: 'failure',
        ipAddress: '10.0.0.1',
      });

      expect(mocks.mockInsert).not.toHaveBeenCalled(); // no orgId
    });
  });

  describe('auditAdminAction', () => {
    it('logs admin action', async () => {
      const { logger } = await import('../logger');

      await auditAdminAction({
        eventType: AuditEventType.ADMIN_USER_CREATED,
        userId: 'admin1',
        organizationId: 'org-1',
        action: 'deactivate_user',
        targetUserId: 'u2',
        details: { reason: 'policy violation' },
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          resource: 'admin',
          outcome: 'success',
        })
      );
    });
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      });
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    it('extracts IP from x-real-ip', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-real-ip': '10.0.0.1' },
      });
      expect(getClientIp(req)).toBe('10.0.0.1');
    });

    it('returns undefined when no IP headers', () => {
      const req = new Request('http://localhost');
      expect(getClientIp(req)).toBeUndefined();
    });
  });

  describe('getUserAgent', () => {
    it('returns user agent string', () => {
      const req = new Request('http://localhost', {
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      expect(getUserAgent(req)).toBe('Mozilla/5.0');
    });

    it('returns undefined when no user-agent header', () => {
      const req = new Request('http://localhost');
      expect(getUserAgent(req)).toBeUndefined();
    });
  });

  describe('auditBulkOperation', () => {
    it('logs bulk_update with HIGH severity', async () => {
      const { logger } = await import('../logger');

      await auditBulkOperation({
        userId: 'u1',
        organizationId: 'org-1',
        resource: 'claims',
        action: 'bulk_update',
        affectedCount: 25,
        resourceIds: ['c1', 'c2'],
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          eventType: AuditEventType.DATA_BULK_UPDATE,
          severity: AuditSeverity.HIGH,
        })
      );
    });

    it('logs bulk_delete with CRITICAL severity', async () => {
      const { logger } = await import('../logger');

      await auditBulkOperation({
        userId: 'u1',
        organizationId: 'org-1',
        resource: 'old_records',
        action: 'bulk_delete',
        affectedCount: 100,
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Audit Event',
        expect.objectContaining({
          eventType: AuditEventType.DATA_BULK_DELETE,
          severity: AuditSeverity.CRITICAL,
        })
      );
    });

    it('logs bulk_export', async () => {
      await auditBulkOperation({
        userId: 'u1',
        organizationId: 'org-1',
        resource: 'members',
        action: 'bulk_export',
        affectedCount: 500,
        details: { format: 'csv' },
      });

      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });
});

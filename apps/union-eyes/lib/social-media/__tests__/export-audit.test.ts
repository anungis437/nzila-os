import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  appendMandatoryAudit: vi.fn(),
  insertValues: vi.fn(),
  withRLSContext: vi.fn(),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));
vi.mock('@/lib/audit/mandatory-audit', () => ({
  appendMandatoryAudit: m.appendMandatoryAudit,
}));
vi.mock('@/db/schema/domains/infrastructure/audit', () => ({
  auditLogs: { auditId: 'audit-id' },
}));

import { auditSocialAnalyticsExport } from '../export-audit';

const input = {
  organizationId: '00000000-0000-0000-0000-000000000001',
  userId: 'actor-1',
  dataType: 'accounts',
  format: 'csv',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  rowCount: 2,
};

describe('mandatory social-media export audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContext.mockImplementation(async (ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ insert: () => ({ values: m.insertValues }) }));
    m.insertValues.mockResolvedValue(undefined);
    m.appendMandatoryAudit.mockResolvedValue(true);
  });

  it('rejects missing organization or actor without opening a transaction', async () => {
    await expect(auditSocialAnalyticsExport({ ...input, organizationId: '' })).rejects.toThrow();
    await expect(auditSocialAnalyticsExport({ ...input, userId: '' })).rejects.toThrow();
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('writes a canonical audit in the authenticated organization transaction', async () => {
    await auditSocialAnalyticsExport(input);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: input.organizationId }, expect.any(Function));
    expect(m.appendMandatoryAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      organizationId: input.organizationId, userId: input.userId,
      action: 'social_media_analytics_export', resourceType: 'social_analytics',
      details: { dataType: 'accounts', format: 'csv', startDate: '2026-10-01', endDate: '2026-10-31', rowCount: 2 },
    }));
    expect(m.insertValues).not.toHaveBeenCalled();
  });

  it('writes a legacy audit when canonical mode is unavailable', async () => {
    m.appendMandatoryAudit.mockResolvedValue(false);
    await auditSocialAnalyticsExport(input);
    expect(m.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: input.organizationId, userId: input.userId,
      action: 'social_media_analytics_export', severity: 'info', outcome: 'success',
    }));
  });

  it('propagates canonical and legacy audit failures without reporting success', async () => {
    m.appendMandatoryAudit.mockRejectedValueOnce(new Error('canonical audit unavailable'));
    await expect(auditSocialAnalyticsExport(input)).rejects.toThrow('canonical audit unavailable');
    m.appendMandatoryAudit.mockResolvedValue(false);
    m.insertValues.mockRejectedValueOnce(new Error('legacy audit unavailable'));
    await expect(auditSocialAnalyticsExport(input)).rejects.toThrow('legacy audit unavailable');
  });
});

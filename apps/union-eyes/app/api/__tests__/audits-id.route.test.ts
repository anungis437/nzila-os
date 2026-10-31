import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const AUDIT_ID = '11111111-2222-4333-8444-555555555555';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  rows: [] as Record<string, unknown>[],
  persistAtomicAudit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ select: () => ({ from: () => ({ where: () => ({ limit: async () => m.rows }) }) }) }),
}));
vi.mock('@/db/schema/audit-security-schema', () => ({ auditLogs: { auditId: 'auditId', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

async function loadRoute() {
  return import('../audits/[id]/route');
}

const ctx = (over: Record<string, unknown> = {}) => ({
  params: { id: AUDIT_ID }, organizationId: 'org_1', userId: 'user_1', ...over,
});

describe('audits/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.rows = [{
      auditId: AUDIT_ID, action: 'viewed', resourceType: 'claim', resourceId: 'c1', severity: 'info', outcome: 'success',
      createdAt: '2026-01-01T00:00:00Z', ipAddress: '10.0.0.1', oldValues: { secret: 1 }, newValues: { secret: 2 }, metadata: { m: 1 }, sessionId: 's1',
    }];
  });

  it('returns only the redacted fields and records the access in the same transaction', async () => {
    const { GET } = await loadRoute();
    const result = await GET(ctx()) as Record<string, unknown>;

    expect(result).toEqual({
      auditId: AUDIT_ID, action: 'viewed', resourceType: 'claim', resourceId: 'c1', severity: 'info', outcome: 'success',
      source: 'legacy', createdAt: '2026-01-01T00:00:00Z',
    });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      organizationId: 'org_1', userId: 'user_1', action: 'audit.entry.read', resourceId: AUDIT_ID,
    }));
  });

  it('refuses a caller with no organization or user, and a malformed identifier', async () => {
    const { GET } = await loadRoute();
    await expect(GET(ctx({ organizationId: null }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(GET(ctx({ userId: undefined }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(GET(ctx({ params: { id: 'a1' } }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('answers not found, without an access audit, for an entry outside the organization', async () => {
    const { GET } = await loadRoute();
    m.rows = [];
    await expect(GET(ctx())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

const AUDIT_ID = '11111111-2222-4333-8444-555555555555';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  rows: [] as Record<string, unknown>[],
  persistAtomicAudit: vi.fn(),
  direct: new Map<string, string>(),
  resolveOrganizationAccess: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ select: () => ({ from: () => ({ where: () => ({ limit: async () => m.rows }) }) }) }),
}));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveOrganizationAccess,
  directRoleIn: (access: { direct: Map<string, string> }, organizationId: string) => access.direct.get(organizationId),
  isAdministrativeRole: (role: string | undefined) => role === 'admin',
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
    m.direct = new Map([['org_1', 'admin']]);
    m.resolveOrganizationAccess.mockImplementation(async () => ({ platform: false, direct: m.direct, descendants: new Set() }));
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

  // #1116: the audit history is tenant content; only a live, direct administrator of the organization in context reads it.
  it('refuses, before any read or access audit, a platform administrator, an ancestor administrator or an officer of the organization', async () => {
    const { GET } = await loadRoute();
    for (const access of [
      { platform: true, direct: new Map<string, string>(), descendants: new Set<string>() },
      { platform: false, direct: new Map([['parent_org', 'admin']]), descendants: new Set(['org_1']) },
      { platform: false, direct: new Map([['org_1', 'officer']]), descendants: new Set<string>() },
    ]) {
      m.resolveOrganizationAccess.mockResolvedValueOnce(access);
      await expect(GET(ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(m.resolveOrganizationAccess).toHaveBeenCalledWith('user_1');
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});

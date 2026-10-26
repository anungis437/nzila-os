import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/api-auth-guard', () => ({ GOVERNANCE_SYSTEM_ROLES: ['admin'] }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

const ctx = {
  body: { votesFor: 5, votesAgainst: 1 },
  params: { id: '00000000-0000-0000-0000-000000000001' },
  userId: 'u1',
  organizationId: 'org_1',
};

describe('governance/reserved-matters/[id] PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.audit.mockResolvedValue(undefined);
  });

  it('records votes and audits them', async () => {
    m.db.execute.mockResolvedValue([{ id: ctx.params.id }]);
    const { PATCH } = await import('../governance/reserved-matters/[id]/route');
    await expect((PATCH as any)(ctx)).resolves.toEqual({ updated: true });
    expect(m.audit).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({ action: 'governance.reserved_matter.record_votes', resourceId: ctx.params.id }),
    );
  });

  it('is a 404 with no audit when no matter matches', async () => {
    m.db.execute.mockResolvedValue([]);
    const { PATCH } = await import('../governance/reserved-matters/[id]/route');
    await expect((PATCH as any)(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.audit).not.toHaveBeenCalled();
  });
});

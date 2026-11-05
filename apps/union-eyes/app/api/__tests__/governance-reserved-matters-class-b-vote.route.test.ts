import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
  auditDataMutation: vi.fn(async () => undefined),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.auditDataMutation }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn((...args: unknown[]) => args), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/reserved-matters/[id]/class-b-vote/route');
}

const ctx = (body: Record<string, unknown>, userId: string | null = 'platform-user') => ({
  body, params: { id: 'uuid-1' }, userId, organizationId: 'org-1',
});

describe('governance/reserved-matters/[id]/class-b-vote route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockResolvedValueOnce([{ status: 'pending', class_b_vote: null }]).mockResolvedValue(undefined);
  });

  it('records an approve vote and audits the session actor', async () => {
    const { POST } = await loadRoute();
    expect(await (POST as any)(ctx({ vote: 'approve' }))).toEqual({ updated: true, status: 'approved' });
    expect(m.auditDataMutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'platform-user', resourceId: 'uuid-1' }));
  });

  it('records a veto vote', async () => {
    const { POST } = await loadRoute();
    expect(await (POST as any)(ctx({ vote: 'veto' }))).toEqual({ updated: true, status: 'vetoed' });
  });

  it('ignores client-supplied council membership and records the session user as voter', async () => {
    const { POST } = await loadRoute();
    await (POST as any)(ctx({ vote: 'approve', councilMembersVoting: [{ name: 'Forged Member' }] }));
    const updateCall = JSON.stringify(m.db.execute.mock.calls[1]);
    expect(updateCall).toContain('platform-user');
    expect(updateCall).not.toContain('Forged Member');
  });

  it('refuses a second vote on an already-decided matter', async () => {
    m.db.execute.mockReset();
    m.db.execute.mockResolvedValueOnce([{ status: 'vetoed', class_b_vote: 'veto' }]);
    const { POST } = await loadRoute();
    await expect((POST as any)(ctx({ vote: 'approve' }))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.db.execute).toHaveBeenCalledTimes(1);
  });

  it('returns not found for an unknown matter', async () => {
    m.db.execute.mockReset();
    m.db.execute.mockResolvedValueOnce([]);
    const { POST } = await loadRoute();
    await expect((POST as any)(ctx({ vote: 'approve' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('requires an authenticated user', async () => {
    const { POST } = await loadRoute();
    await expect((POST as any)(ctx({ vote: 'approve' }, null))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('fails closed when the decision cannot be audited (error propagates out of the transaction)', async () => {
    m.auditDataMutation.mockRejectedValueOnce(new Error('audit store down'));
    const { POST } = await loadRoute();
    await expect((POST as any)(ctx({ vote: 'approve' }))).rejects.toThrow('audit store down');
  });

  it('refuses to record a decision without an audit scope', async () => {
    const { POST } = await loadRoute();
    await expect((POST as any)({ ...ctx({ vote: 'approve' }), organizationId: null })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.db.execute).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-a';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  selectQueue: [] as unknown[][],
  updateValues: [] as Record<string, unknown>[],
  auditDataMutation: vi.fn(async () => undefined),
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    for: vi.fn(() => chain),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      m.updateValues.push(values);
      return { where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'p1', lifecycleStatus: values.lifecycleStatus }]) })) };
    }),
  })),
};

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.auditDataMutation }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), asc: vi.fn(() => 'asc') };
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/[id]/route');
}

const policyRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1', orgId: ORG, authorId: 'author', lifecycleStatus: 'approval_required', riskClassification: 'medium', ...over,
});
const chain = { id: 'ch1', governedPolicyId: 'p1', chainType: 'multi', requiredApprovals: 1, requiresNamedApprovers: false, approverRoles: ['president'], namedApproverIds: [], delegatable: false };
const user = { id: 'u1', role: 'admin' };
const patch = (targetState: unknown, ctxOver: Record<string, unknown> = {}) => ({
  request: { json: async () => ({ targetState, actorRole: 'system_admin' }) },
  params: { id: 'p1' }, user, organizationId: ORG, ...ctxOver,
});

describe('governance/lifecycle/policies/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateValues = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  it('returns an in-scope governed policy', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([policyRow()]);
    const result = await (GET as any)({ params: { id: 'p1' }, user, organizationId: ORG });
    expect(result).toEqual({ policy: policyRow() });
  });

  it('does not return a policy owned by another organization', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([policyRow({ orgId: 'org-b' })]);
    expect(await (GET as any)({ params: { id: 'p1' }, user, organizationId: ORG })).toBeNull();
  });

  it('allows a non-gated transition', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow()]);
    const result = await (PATCH as any)(patch('review_pending'));
    expect(result).toEqual({ policy: { id: 'p1', lifecycleStatus: 'review_pending' } });
    expect(m.auditDataMutation).toHaveBeenCalled();
  });

  it.each(['approved', 'published', 'active'])('refuses %s without a satisfied approval chain (client actorRole is ignored)', async (target) => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow()], [], );
    await expect((PATCH as any)(patch(target))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.updateValues).toHaveLength(0);
  });

  it('refuses publication when the chain exists but is not yet satisfied', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow()], [chain], []);
    await expect((PATCH as any)(patch('published'))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.updateValues).toHaveLength(0);
  });

  it('publishes once the chain is satisfied', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow()], [chain], [{ chainId: 'ch1', approverUserId: 'u9', action: 'approved' }]);
    const result = await (PATCH as any)(patch('published'));
    expect(result).toEqual({ policy: { id: 'p1', lifecycleStatus: 'published' } });
    expect(m.updateValues[0]).toHaveProperty('publishedAt');
  });

  it('fails closed when the transition cannot be audited', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow()]);
    m.auditDataMutation.mockRejectedValueOnce(new Error('audit store down'));
    await expect((PATCH as any)(patch('review_pending'))).rejects.toThrow('audit store down');
  });

  it('refuses a platform-policy transition that has no audit scope', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow({ orgId: null })]);
    await expect((PATCH as any)({ ...patch('review_pending', { user: { id: 'u1', role: 'system_admin' } }), organizationId: null }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.updateValues).toHaveLength(0);
  });

  it('cannot transition a policy owned by another organization', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow({ orgId: 'org-b' })]);
    await expect((PATCH as any)(patch('archived'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.updateValues).toHaveLength(0);
  });

  it('cannot let an org admin transition a platform policy', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([policyRow({ orgId: null })]);
    await expect((PATCH as any)(patch('archived'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects an invalid target state', async () => {
    const { PATCH } = await loadRoute();
    await expect((PATCH as any)(patch('godmode'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

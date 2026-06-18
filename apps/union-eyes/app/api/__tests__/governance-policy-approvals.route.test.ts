import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  selectQueue: [] as unknown[][],
  insertReturningQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => (m.insertReturningQueue.shift() ?? []) as unknown[]),
    })),
  })),
};

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    desc: vi.fn(() => 'desc'),
  };
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/[id]/approvals/route');
}

describe('governance/lifecycle/policies/[id]/approvals route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.insertReturningQueue = [];
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any = { params: { id: 'pol_1' }, user: { id: 'u1' } }) => {
          const data = await handler({ request, ...ctx });
          return new Response(JSON.stringify(data), { status: 200 });
        },
    );
  });

  it('GET returns chains and actions', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'chain_1', governedPolicyId: 'pol_1', createdAt: new Date() }],
      [{ id: 'action_1', chainId: 'chain_1', governedPolicyId: 'pol_1', createdAt: new Date() }],
    );

    const response = await GET(new NextRequest('http://localhost/api/governance/lifecycle/policies/pol_1/approvals'), {
      params: { id: 'pol_1' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.chains).toHaveLength(1);
    expect(json.actions).toHaveLength(1);
  });

  it('GET returns empty actions when there are no chains', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(new NextRequest('http://localhost/api/governance/lifecycle/policies/pol_1/approvals'), {
      params: { id: 'pol_1' },
    });

    const json = await response.json();
    expect(json.chains).toEqual([]);
    expect(json.actions).toEqual([]);
  });

  it('POST creates approval chain', async () => {
    const { POST } = await loadRoute();
    m.insertReturningQueue.push([{ id: 'chain_new', chainType: 'single' }]);

    const response = await POST(
      new NextRequest('http://localhost/api/governance/lifecycle/policies/pol_1/approvals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'create_chain', chainType: 'parallel', approverRoles: ['admin'] }),
      }),
      { params: { id: 'pol_1' }, user: { id: 'u1' } },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.chain.id).toBe('chain_new');
  });

  it('POST records approval action', async () => {
    const { POST } = await loadRoute();
    m.insertReturningQueue.push([{ id: 'action_new', action: 'approved' }]);

    const response = await POST(
      new NextRequest('http://localhost/api/governance/lifecycle/policies/pol_1/approvals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'record_action', chainId: 'chain_1', action: 'approved', actorRole: 'admin' }),
      }),
      { params: { id: 'pol_1' }, user: { id: 'u1' } },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.action.id).toBe('action_new');
  });

  it('POST returns error payload when record_action params are incomplete', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/governance/lifecycle/policies/pol_1/approvals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'record_action', chainId: 'chain_1' }),
      }),
      { params: { id: 'pol_1' }, user: { id: 'u1' } },
    );

    const json = await response.json();
    expect(json.error).toContain('chainId, action, and actorRole are required.');
  });
});

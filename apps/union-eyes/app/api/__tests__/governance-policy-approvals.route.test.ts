import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORG = 'org-a';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  selectQueue: [] as unknown[][],
  insertReturningQueue: [] as unknown[][],
  insertedValues: [] as Record<string, unknown>[],
  auditSecurityEvent: vi.fn(async () => undefined),
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
  insert: vi.fn(() => ({
    values: vi.fn((values: Record<string, unknown>) => {
      m.insertedValues.push(values);
      return {
        returning: vi.fn(async () => (m.insertReturningQueue.shift() ?? []) as unknown[]),
      };
    }),
  })),
};

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/audit-logger', () => ({
  auditSecurityEvent: m.auditSecurityEvent,
  auditDataMutation: m.auditDataMutation,
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc'), asc: vi.fn(() => 'asc') };
});

const CHAIN_ID = '22222222-2222-2222-2222-222222222222';

const policyRow = (over: Record<string, unknown> = {}) => ({
  id: 'pol_1',
  orgId: ORG,
  authorId: 'author',
  lifecycleStatus: 'approval_required',
  riskClassification: 'medium',
  ...over,
});
const chainRow = (over: Record<string, unknown> = {}) => ({
  id: CHAIN_ID,
  governedPolicyId: 'pol_1',
  chainType: 'multi',
  requiredApprovals: 2,
  requiresNamedApprovers: false,
  approverRoles: ['president', 'vice_president'],
  namedApproverIds: [],
  delegatable: false,
  ...over,
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/[id]/approvals/route');
}

function call(
  handler: (req: NextRequest, ctx?: any) => Promise<Response>,
  body: unknown,
  user: Record<string, unknown> | null,
  organizationId: string | null = ORG,
) {
  return handler(
    new NextRequest('http://localhost/api/governance/lifecycle/policies/pol_1/approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { id: 'pol_1' }, user, organizationId },
  );
}

describe('governance/lifecycle/policies/[id]/approvals route (server-owned authority)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.insertReturningQueue = [];
    m.insertedValues = [];
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any) => {
          const data = await handler({ request, ...ctx });
          return new Response(JSON.stringify(data), { status: 200 });
        },
    );
  });

  describe('GET', () => {
    it('returns chains and actions for an in-scope policy', async () => {
      const { GET } = await loadRoute();
      m.selectQueue.push([policyRow()], [{ id: 'chain_1' }], [{ id: 'action_1' }]);

      const res = await (GET as any)(new NextRequest('http://localhost/x'), {
        params: { id: 'pol_1' }, user: { id: 'u1', role: 'admin' }, organizationId: ORG,
      });
      const json = await res.json();
      expect(json.chains).toHaveLength(1);
      expect(json.actions).toHaveLength(1);
    });

    it('treats another organization\'s policy as not found', async () => {
      const { GET } = await loadRoute();
      m.selectQueue.push([policyRow()]);
      await expect(
        (GET as any)(new NextRequest('http://localhost/x'), {
          params: { id: 'pol_1' }, user: { id: 'u1', role: 'admin' }, organizationId: 'org-b',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('does not let an org admin read a platform policy\'s approvals', async () => {
      const { GET } = await loadRoute();
      m.selectQueue.push([policyRow({ orgId: null })]);
      await expect(
        (GET as any)(new NextRequest('http://localhost/x'), {
          params: { id: 'pol_1' }, user: { id: 'u1', role: 'admin' }, organizationId: ORG,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('POST create_chain', () => {
    it('creates a chain stamped with the session actor', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], []);
      m.insertReturningQueue.push([{ id: 'chain_new' }]);

      const res = await call(POST as any, { op: 'create_chain', chainType: 'multi', approverRoles: ['president'], requiredApprovalCount: 1 }, { id: 'u1', role: 'admin' });
      const json = await res.json();
      expect(json.chain.id).toBe('chain_new');
      expect(m.insertedValues[0]).toMatchObject({ createdBy: 'u1', governedPolicyId: 'pol_1' });
      expect(m.auditDataMutation).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', resource: 'policy_approval_chains' }));
    });

    it('refuses an empty permissive chain and audits the denial', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], []);
      await expect(call(POST as any, { op: 'create_chain' }, { id: 'u1', role: 'admin' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(m.insertedValues).toHaveLength(0);
      expect(m.auditSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'governance.policy_approval.denied' }));
    });

    it('refuses a second chain on the same policy version', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [{ id: 'existing' }]);
      await expect(call(POST as any, { op: 'create_chain', approverRoles: ['president'] }, { id: 'u1', role: 'admin' })).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(m.insertedValues).toHaveLength(0);
    });

    it('refuses chain creation on a policy owned by another organization', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow({ orgId: 'org-b' })]);
      await expect(call(POST as any, { op: 'create_chain', approverRoles: ['president'] }, { id: 'u1', role: 'admin' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('POST record_action', () => {
    it('records an approval using the session role, ignoring a client-supplied actorRole', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [chainRow()], []);
      m.insertReturningQueue.push([{ id: 'action_new' }]);

      const res = await call(
        POST as any,
        { op: 'record_action', chainId: CHAIN_ID, action: 'approved', actorRole: 'system_admin' },
        { id: 'u1', role: 'president' },
      );
      const json = await res.json();
      expect(json.action.id).toBe('action_new');
      expect(json.chainSatisfied).toBe(false);
      expect(m.insertedValues[0]).toMatchObject({ approverUserId: 'u1', approverRole: 'president' });
    });

    it('rejects an ineligible approver who forges a privileged actorRole', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [chainRow()], []);
      await expect(
        call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved', actorRole: 'president' }, { id: 'u1', role: 'admin' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(m.insertedValues).toHaveLength(0);
      expect(m.auditSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ details: expect.objectContaining({ code: 'NOT_AN_ELIGIBLE_APPROVER' }) }),
      );
    });

    it('rejects self-approval by the policy author', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [chainRow()], []);
      await expect(
        call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved' }, { id: 'author', role: 'president' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(m.insertedValues).toHaveLength(0);
    });

    it('rejects a duplicate approval from the same approver', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [chainRow()], [{ chainId: CHAIN_ID, approverUserId: 'u1', action: 'approved' }]);
      await expect(
        call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved' }, { id: 'u1', role: 'president' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(m.insertedValues).toHaveLength(0);
    });

    it('fails closed when the approval cannot be audited', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [chainRow()], []);
      m.insertReturningQueue.push([{ id: 'action_new' }]);
      m.auditDataMutation.mockRejectedValueOnce(new Error('audit store down'));
      await expect(
        call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved' }, { id: 'u1', role: 'president' }),
      ).rejects.toThrow('audit store down');
    });

    it('fails closed when a denial cannot be audited (no silent 403)', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [chainRow()], []);
      m.auditSecurityEvent.mockRejectedValueOnce(new Error('audit store down'));
      await expect(
        call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved' }, { id: 'u1', role: 'admin' }),
      ).rejects.toThrow('audit store down');
    });

    it('refuses platform-policy actions that have no audit scope', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow({ orgId: null })]);
      await expect(
        call(POST as any, { op: 'create_chain', approverRoles: ['system_admin'] }, { id: 'u1', role: 'system_admin' }, null),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(m.insertedValues).toHaveLength(0);
    });

    it('rejects a chain that does not belong to the policy in the URL', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], []);
      await expect(
        call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved' }, { id: 'u1', role: 'president' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(m.insertedValues).toHaveLength(0);
    });

    it('reports the chain as satisfied once the final required approval is recorded', async () => {
      const { POST } = await loadRoute();
      m.selectQueue.push([policyRow()], [chainRow()], [{ chainId: CHAIN_ID, approverUserId: 'u0', action: 'approved' }]);
      m.insertReturningQueue.push([{ id: 'action_final' }]);
      const res = await call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved' }, { id: 'u1', role: 'vice_president' });
      expect((await res.json()).chainSatisfied).toBe(true);
    });
  });

  describe('POST input handling', () => {
    it('rejects an unknown op without touching the database', async () => {
      const { POST } = await loadRoute();
      await expect(call(POST as any, { op: 'delete_everything' }, { id: 'u1', role: 'admin' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('rejects a missing user and does not stamp a system actor', async () => {
      const { POST } = await loadRoute();
      await expect(call(POST as any, { op: 'create_chain' }, null)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(m.withSystemContext).not.toHaveBeenCalled();
    });

    it('rejects a user without an id and does not write', async () => {
      const { POST } = await loadRoute();
      await expect(
        call(POST as any, { op: 'record_action', chainId: CHAIN_ID, action: 'approved' }, { id: '', role: 'admin' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  existing: { current: undefined as Record<string, unknown> | undefined },
  updateSet: vi.fn(),
  insertValues: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auditFails: { current: false },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
  },
}));
vi.mock('@/lib/api-auth-guard', () => ({ GOVERNANCE_SYSTEM_ROLES: ['clc_staff'] }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: async (fn: () => Promise<unknown>) => fn() }));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (...args: unknown[]) => {
    m.persistAtomicAudit(...args);
    if (m.auditFails.current) throw new Error('audit write failed');
  },
}));
vi.mock('@/db/schema/governance-schema', () => ({ councilElections: { id: 'id' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), desc: vi.fn() }));
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => (m.existing.current ? [m.existing.current] : []) }) }) }) }),
    update: () => ({ set: (values: unknown) => { m.updateSet(values); return { where: () => ({ returning: async () => [{ id: 'e1', ...(values as object) }] }) }; } }),
    insert: () => ({ values: (values: unknown) => { m.insertValues(values); return { returning: async () => [{ id: 'e2', ...(values as object) }] }; } }),
  },
}));

const item = () => import('../elections/[id]/route');
const collection = () => import('../elections/route');
const call = (handler: (req: NextRequest, ctx: unknown) => Promise<Response>, method: string, body?: unknown) =>
  handler(new NextRequest('http://localhost/api/elections/e1', { method, body: body ? JSON.stringify(body) : undefined }), { params: { id: 'e1' } });

describe('council elections: certified results and atomic audit (UE-CONV-K-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auditFails.current = false;
    m.existing.current = { id: 'e1', verifiedBy: null, verificationDate: null };
    m.withApi.mockImplementation((_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
      async (req: NextRequest, context: any) => {
        try {
          const data = await handler({ request: req, params: context.params, organizationId: 'org_1', userId: 'user_1' });
          return data instanceof Response ? data : new Response(JSON.stringify(data), { status: 200 });
        } catch (error) {
          const e = error as { status?: number; message: string };
          return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 500 });
        }
      });
  });

  it('updates an uncertified election and audits it in the same transaction', async () => {
    const { PATCH } = await item();
    const response = await call(PATCH as never, 'PATCH', { totalVotes: 120 });
    expect(response.status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'governance.council_election.update', resourceId: 'e1', userId: 'user_1' }));
  });

  it.each([{ verifiedBy: 'Independent Auditor' }, { verificationDate: '2026-10-01' }])('refuses to rewrite the results of a certified election (%j)', async (certified) => {
    m.existing.current = { id: 'e1', ...certified };
    const { PATCH } = await item();
    const response = await call(PATCH as never, 'PATCH', { winners: [{ name: 'Someone Else' }], totalVotes: 1 });
    expect(response.status).toBe(409);
    expect(m.updateSet).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('still records a dispute against a certified result', async () => {
    m.existing.current = { id: 'e1', verifiedBy: 'Independent Auditor' };
    const { PATCH } = await item();
    expect((await call(PATCH as never, 'PATCH', { contestedResults: true })).status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
  });

  it('fails the request when the audit write fails, so the update cannot be reported as done', async () => {
    m.auditFails.current = true;
    const { PATCH } = await item();
    expect((await call(PATCH as never, 'PATCH', { totalVotes: 5 })).status).toBe(500);
  });

  it('returns 404 for an election that does not exist, without writing', async () => {
    m.existing.current = undefined;
    const { PATCH } = await item();
    expect((await call(PATCH as never, 'PATCH', { totalVotes: 5 })).status).toBe(404);
    expect(m.updateSet).not.toHaveBeenCalled();
  });

  it('audits creation in the same transaction as the insert', async () => {
    const { POST } = await collection();
    const response = await call(POST as never, 'POST', { electionYear: 2026, electionDate: '2026-10-01', positionsAvailable: 2 });
    expect(response.status).toBe(201);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'governance.council_election.create', resourceId: 'e2' }));
  });
});

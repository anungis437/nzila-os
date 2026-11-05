import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getVotingSessionById: vi.fn(),
  updateVotingSession: vi.fn(),
  deleteVotingSession: vi.fn(),
  persistAtomicAudit: vi.fn(),
  tx: { marker: 'tx' },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod').z }));
vi.mock('@/lib/services/voting-service', () => ({
  getVotingSessionById: m.getVotingSessionById,
  updateVotingSession: m.updateVotingSession,
  deleteVotingSession: m.deleteVotingSession,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    notFound: (r: string) => Object.assign(new Error(`${r} not found`), { status: 404 }),
    conflict: (message: string, details?: Record<string, unknown>) => Object.assign(new Error(message), { status: 409, details }),
  },
}));

const route = () => import('../voting/sessions/[id]/route');
const call = (handler: (req: NextRequest, ctx: unknown) => Promise<Response>, method: string, body?: unknown) =>
  handler(new NextRequest('http://localhost/api/voting/sessions/s1', { method, body: body ? JSON.stringify(body) : undefined }), { params: { id: 's1' } });

describe('voting/sessions/[id] PATCH and DELETE (UE-CONV-K-009)', () => {
  let session: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    session = { id: 's1', organizationId: 'org_1', status: 'draft', voteCount: 0 };
    m.withApi.mockImplementation((config: { body?: { parse: (b: unknown) => unknown } }, handler: (ctx: any) => Promise<unknown>) =>
      async (req: NextRequest, context: any) => {
        try {
          const raw = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.json();
          const body = config.body ? config.body.parse(raw) : raw;
          const data = await handler({ params: context.params, body, organizationId: 'org_1', userId: 'user_1' });
          return new Response(JSON.stringify(data), { status: 200 });
        } catch (error) {
          const e = error as { status?: number; message: string };
          return new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 500 });
        }
      });
    m.getVotingSessionById.mockImplementation(async () => ({ ...session }));
    m.updateVotingSession.mockImplementation(async (_id: string, _org: string, data: Record<string, unknown>) => ({ ...session, ...data }));
  });

  it('records the update and its audit in one tenant transaction, scoped to the organization', async () => {
    const { PATCH } = await route();
    const response = await call(PATCH as never, 'PATCH', { title: 'Renamed' });
    expect(response.status).toBe(200);
    expect(m.updateVotingSession).toHaveBeenCalledWith('s1', 'org_1', expect.objectContaining({ title: 'Renamed' }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', action: 'voting_session.update', resourceId: 's1' }));
  });

  it('refuses to reopen a closed session and writes nothing', async () => {
    session.status = 'closed';
    const { PATCH } = await route();
    const response = await call(PATCH as never, 'PATCH', { status: 'active' });
    expect(response.status).toBe(409);
    expect(m.updateVotingSession).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('refuses to change the terms of an opened session', async () => {
    session.status = 'active';
    const { PATCH } = await route();
    expect((await call(PATCH as never, 'PATCH', { endTime: '2030-01-01T00:00:00.000Z' })).status).toBe(409);
    expect(m.updateVotingSession).not.toHaveBeenCalled();
  });

  it('does not treat a request field as authority to extend an opened session', async () => {
    session.status = 'active';
    const { PATCH } = await route();
    const response = await call(PATCH as never, 'PATCH', {
      endTime: '2030-01-01T00:00:00.000Z',
      mandateId: 'client-supplied',
      extensionGrant: { issued: true, loadedBy: 'authority-kernel' },
    });
    expect(response.status).toBe(409);
    expect(m.updateVotingSession).not.toHaveBeenCalled();
  });

  it('does not let a session of another organization be touched', async () => {
    session.organizationId = 'org_2';
    const { PATCH, DELETE } = await route();
    expect((await call(PATCH as never, 'PATCH', { title: 'x' })).status).toBe(404);
    expect((await call(DELETE as never, 'DELETE')).status).toBe(404);
    expect(m.updateVotingSession).not.toHaveBeenCalled();
    expect(m.deleteVotingSession).not.toHaveBeenCalled();
  });

  it('deletes only an empty draft, and audits the deletion', async () => {
    const { DELETE } = await route();
    expect((await call(DELETE as never, 'DELETE')).status).toBe(200);
    expect(m.deleteVotingSession).toHaveBeenCalledWith('s1', 'org_1');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'voting_session.delete' }));
  });

  it.each([
    ['a draft that already holds ballots', { status: 'draft', voteCount: 3 }],
    ['an active session', { status: 'active', voteCount: 0 }],
    ['a closed session', { status: 'closed', voteCount: 40 }],
  ])('refuses to delete %s', async (_name, override) => {
    Object.assign(session, override);
    const { DELETE } = await route();
    expect((await call(DELETE as never, 'DELETE')).status).toBe(409);
    expect(m.deleteVotingSession).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});

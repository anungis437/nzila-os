import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  listVotingSessions: vi.fn(),
  rows: { options: [] as unknown[], counts: [] as unknown[], failOptions: false },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod').z }));
vi.mock('@/lib/services/voting-service', () => ({ listVotingSessions: m.listVotingSessions, createVotingSession: vi.fn() }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_o: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({}) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('drizzle-orm', () => ({ inArray: vi.fn(), count: vi.fn() }));
vi.mock('@/db/schema', () => ({ votingOptions: { sessionId: 's', orderIndex: 'o' }, votes: { optionId: 'o', sessionId: 's' } }));
vi.mock('@/db/db', () => ({
  db: {
    select: (shape?: unknown) => ({
      from: () => ({
        where: () =>
          shape
            ? { groupBy: async () => m.rows.counts }
            : {
                orderBy: async () => {
                  if (m.rows.failOptions) throw new Error('options query failed');
                  return m.rows.options;
                },
              },
      }),
    }),
  },
}));

describe('voting/sessions list withholds tallies (UE-CONV-K-009, G12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
      async (req: NextRequest) => new Response(JSON.stringify(await handler({ request: req, organizationId: 'org_1' })), { status: 200 }));
    m.rows.options = [
      { id: 'o1', sessionId: 's1', text: 'Yes', description: null, orderIndex: 0 },
      { id: 'o2', sessionId: 's1', text: 'No', description: null, orderIndex: 1 },
    ];
    m.rows.counts = [{ optionId: 'o1', count: 7 }, { optionId: 'o2', count: 3 }];
    m.rows.failOptions = false;
    m.listVotingSessions.mockResolvedValue({ sessions: [{ id: 's1', status: 'active' }], total: 1, page: 1, limit: 20 });
  });

  it.each(['active', 'closed'])('discloses participation but no per-option count or percentage for a %s session', async (status) => {
    m.listVotingSessions.mockResolvedValue({ sessions: [{ id: 's1', status }], total: 1, page: 1, limit: 20 });
    const { GET } = await import('../voting/sessions/route');
    const body = await (await (GET as never as (r: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/voting/sessions'))).json();
    const session = body.sessions[0];
    expect(session.totalVotes).toBe(10);
    expect(session.resultsWithheld).toBe(true);
    for (const option of session.options) {
      expect(option).not.toHaveProperty('votes');
      expect(option).not.toHaveProperty('percentage');
    }
    expect(JSON.stringify(body)).not.toMatch(/"(votes|percentage)"/);
  });

  it('answers a listing failure as a failure: an empty list would read as "no ballots"', async () => {
    m.listVotingSessions.mockRejectedValue(new Error('Failed to list voting sessions'));
    const { GET } = await import('../voting/sessions/route');
    await expect((GET as never as (r: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/voting/sessions')))
      .rejects.toThrow('Failed to list voting sessions');
  });

  it('answers an options failure as a failure: sessions without options cannot be voted in', async () => {
    m.rows.failOptions = true;
    const { GET } = await import('../voting/sessions/route');
    await expect((GET as never as (r: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/voting/sessions')))
      .rejects.toThrow('options query failed');
  });

  it('lists an empty organisation as an empty page, with the paging it was asked for', async () => {
    m.listVotingSessions.mockResolvedValue({ sessions: [], total: 0, page: 2, limit: 50 });
    const { GET } = await import('../voting/sessions/route');
    const body = await (await (GET as never as (r: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/voting/sessions?page=2&limit=50'))).json();
    expect(body).toEqual({ sessions: [], total: 0, page: 2, limit: 50 });
    expect(m.listVotingSessions).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1' }), { page: 2, limit: 50 });
  });
});

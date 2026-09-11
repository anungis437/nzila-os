import { beforeEach, describe, expect, it, vi } from 'vitest';

// Round 57: this route used to accept a client-supplied voterId and never
// checked voter eligibility, letting a caller impersonate/duplicate ballots.
// It now delegates voter identity + eligibility to castVote(), deriving the
// voter from the authenticated userId only.

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn() },
  castVote: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    unauthorized: (msg: string) => Object.assign(new Error(msg), { status: 401 }),
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({
  votes: { id: 'id', sessionId: 'sessionId', castAt: 'castAt' },
  votingOptions: { id: 'id', sessionId: 'sessionId' },
  votingSessions: { id: 'id', organizationId: 'organizationId' },
}));
vi.mock('@/lib/services/voting-service', () => ({ castVote: m.castVote }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc') };
});

async function loadRoute() {
  return import('../governance/elections/sessions/[id]/vote/route');
}

describe('governance/elections/sessions/[id]/vote route (IDOR + eligibility fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (_opts: unknown, fn: () => Promise<unknown>) => fn());
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 's1', organizationId: 'org-1' }]) })),
    } as any);
  });

  it('derives voterId/eligibility from the authenticated user via castVote(), not the request body', async () => {
    m.castVote.mockResolvedValue({ id: 'vote-1', sessionId: 's1', optionId: '11111111-1111-1111-1111-111111111111', receiptId: 'r1' });
    const { POST } = await loadRoute();

    const result = await POST({
      request: { url: 'http://localhost/api/governance/elections/sessions/s1/vote' },
      body: { optionId: '11111111-1111-1111-1111-111111111111', voterId: 'attacker-supplied-voter-id', isAnonymous: true },
      organizationId: 'org-1',
      userId: 'user-1',
    });

    expect(m.castVote).toHaveBeenCalledWith('s1', '11111111-1111-1111-1111-111111111111', 'user-1', true);
    expect(result).toEqual({ id: 'vote-1', sessionId: 's1', optionId: '11111111-1111-1111-1111-111111111111', receiptId: 'r1' });
  });

  it('rejects when no authenticated user is present', async () => {
    const { POST } = await loadRoute();
    await expect(
      POST({
        request: { url: 'http://localhost/api/governance/elections/sessions/s1/vote' },
        body: { optionId: '11111111-1111-1111-1111-111111111111' },
        organizationId: 'org-1',
        userId: undefined,
      }),
    ).rejects.toThrow('Authenticated user required');
    expect(m.castVote).not.toHaveBeenCalled();
  });

  it('surfaces castVote eligibility/double-vote errors as a 400', async () => {
    m.castVote.mockRejectedValue(new Error('Voter is not eligible'));
    const { POST } = await loadRoute();

    await expect(
      POST({
        request: { url: 'http://localhost/api/governance/elections/sessions/s1/vote' },
        body: { optionId: '11111111-1111-1111-1111-111111111111' },
        organizationId: 'org-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Voter is not eligible');
  });
});

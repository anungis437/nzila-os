import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const m = vi.hoisted(() => ({
  getVotingSessionById: vi.fn(),
  castVote: vi.fn(),
  hasVoted: vi.fn(),
  recordBallotAcceptance: vi.fn(),
  configs: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (config: Record<string, unknown>, handler: unknown) => {
    m.configs.push(config);
    return handler;
  },
  z: require('zod').z,
}));
vi.mock('@/lib/services/voting-service', () => ({
  castVote: m.castVote,
  hasVoted: m.hasVoted,
  getVotingSessionById: m.getVotingSessionById,
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_org: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({}),
}));
vi.mock('@/lib/voting/ballot-process-audit', () => ({ recordBallotAcceptance: m.recordBallotAcceptance }));

const OPTION_ID = '11111111-1111-4111-8111-111111111111';

type Ctx = { body?: { optionId: string; isAnonymous?: boolean }; userId: string; organizationId: string; params: { id: string } };
type Handler = (ctx: Ctx) => Promise<unknown>;

async function loadRoute() {
  return (await import('../voting/sessions/[id]/vote/route')) as unknown as { POST: Handler; GET: Handler };
}

const ctx = (overrides: Partial<Ctx> = {}): Ctx => ({
  body: { optionId: OPTION_ID, isAnonymous: true },
  userId: 'user-1',
  organizationId: 'org-1',
  params: { id: 'session-1' },
  ...overrides,
});

describe('voting/sessions/[id]/vote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getVotingSessionById.mockResolvedValue({ id: 'session-1', organizationId: 'org-1', status: 'active' });
  });

  it('runs both handlers in the tenant context the voting tables require', async () => {
    await loadRoute();
    expect(m.configs).toHaveLength(2);
    for (const config of m.configs) expect(config.rlsOrgContext).toBe(true);
  });

  it.each([
    ['Vote already cast', ErrorCode.CONFLICT],
    ['Voter is not eligible', ErrorCode.FORBIDDEN],
    ['Option does not belong to this voting session', ErrorCode.VALIDATION_ERROR],
  ])('states the refusal "%s" instead of answering a server fault', async (message, code) => {
    m.castVote.mockRejectedValue(new Error(message));
    const { POST } = await loadRoute();
    await expect(POST(ctx())).rejects.toMatchObject({ name: 'ApiError', code, message });
    expect(m.recordBallotAcceptance).not.toHaveBeenCalled();
  });

  it('leaves a genuine failure to cast a vote as a server fault', async () => {
    m.castVote.mockRejectedValue(new Error('Failed to cast vote'));
    const { POST } = await loadRoute();
    const failure = await POST(ctx()).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as { name: string }).name).not.toBe('ApiError');
  });

  it('answers a receipt only: no option, voter identifier or hash', async () => {
    m.castVote.mockResolvedValue({
      id: 'vote-1',
      sessionId: 'session-1',
      optionId: OPTION_ID,
      voterId: 'anonymised-voter',
      voterHash: 'hash',
      castAt: '2026-05-01T12:00:00.000Z',
      receiptId: 'receipt-1',
    });
    const { POST } = await loadRoute();
    const answer = await POST(ctx());
    expect(answer).toEqual({ vote: { id: 'vote-1', sessionId: 'session-1', castAt: '2026-05-01T12:00:00.000Z' }, receiptId: 'receipt-1' });
    expect(JSON.stringify(answer)).not.toMatch(/optionId|voterId|voterHash|anonymised-voter/);
    expect(m.recordBallotAcceptance).toHaveBeenCalledWith({}, { organizationId: 'org-1', sessionId: 'session-1', receiptId: 'vote-1' });
  });

  it('does not accept a ballot for a session that is not open', async () => {
    m.getVotingSessionById.mockResolvedValue({ id: 'session-1', organizationId: 'org-1', status: 'closed' });
    const { POST } = await loadRoute();
    await expect(POST(ctx())).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: 'Voting session is not open' });
    expect(m.castVote).not.toHaveBeenCalled();
  });

  it('reports whether the caller has voted', async () => {
    m.hasVoted.mockResolvedValue(true);
    const { GET } = await loadRoute();
    await expect(GET(ctx({ body: undefined }))).resolves.toEqual({ hasVoted: true });
    expect(m.hasVoted).toHaveBeenCalledWith('session-1', 'user-1');
  });

  it('does not answer "has not voted" when the lookup failed', async () => {
    m.hasVoted.mockRejectedValue(new Error('Failed to check whether the member has voted'));
    const { GET } = await loadRoute();
    await expect(GET(ctx({ body: undefined }))).rejects.toThrow('Failed to check whether the member has voted');
  });

  it('does not reveal another organisation\'s session', async () => {
    m.getVotingSessionById.mockResolvedValue({ id: 'session-1', organizationId: 'org-2', status: 'active' });
    const { GET } = await loadRoute();
    await expect(GET(ctx({ body: undefined }))).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(m.hasVoted).not.toHaveBeenCalled();
  });
});

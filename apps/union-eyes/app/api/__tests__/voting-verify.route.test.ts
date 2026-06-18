import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  voteFindFirst: vi.fn(),
  optionFindFirst: vi.fn(),
  sessionFindFirst: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  z: {
    object: () => ({}),
    string: () => ({ min: () => ({}), optional: () => ({}) }),
  },
}));
vi.mock('@/db/db', () => ({
  db: {
    query: {
      votes: { findFirst: m.voteFindFirst },
      votingOptions: { findFirst: m.optionFindFirst },
      votingSessions: { findFirst: m.sessionFindFirst },
    },
  },
}));
vi.mock('@/db/schema', () => ({
  votes: { receiptId: 'receiptId' },
  votingOptions: { id: 'id' },
  votingSessions: { id: 'id' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

async function loadRoute() {
  return import('../voting/verify/route');
}

describe('voting/verify route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (req: NextRequest) => {
          const body = await req.json();
          const result = await handler({ body });
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
    );

    m.voteFindFirst.mockResolvedValue({
      receiptId: 'r1',
      verificationCode: 'code_1',
      optionId: 'opt_1',
      sessionId: 'sess_1',
      castAt: '2026-01-01T00:00:00.000Z',
      isAnonymous: true,
    });
    m.optionFindFirst.mockResolvedValue({ id: 'opt_1', text: 'Yes' });
    m.sessionFindFirst.mockResolvedValue({ id: 'sess_1', title: 'Ratification Vote' });
  });

  it('returns not verified when receipt cannot be found', async () => {
    const { POST } = await loadRoute();
    m.voteFindFirst.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/voting/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ receiptId: 'missing' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ verified: false, reason: 'Receipt not found' });
  });

  it('returns not verified when verification code mismatches', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/voting/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ receiptId: 'r1', verificationCode: 'wrong' }),
    }));
    const payload = await response.json();

    expect(payload).toEqual({ verified: false, reason: 'Verification code mismatch' });
  });

  it('returns verified payload when vote details are found', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/voting/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ receiptId: 'r1', verificationCode: 'code_1' }),
    }));
    const payload = await response.json();

    expect(payload.verified).toBe(true);
    expect(payload.vote).toMatchObject({
      sessionTitle: 'Ratification Vote',
      optionText: 'Yes',
      isAnonymous: true,
    });
  });

  it('falls back to Unknown labels when option or session is unavailable', async () => {
    const { POST } = await loadRoute();
    m.optionFindFirst.mockResolvedValueOnce(null);
    m.sessionFindFirst.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/voting/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ receiptId: 'r1' }),
    }));
    const payload = await response.json();

    expect(payload.verified).toBe(true);
    expect(payload.vote.sessionTitle).toBe('Unknown');
    expect(payload.vote.optionText).toBe('Unknown');
  });
});

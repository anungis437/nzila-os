import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: { id: 'id' } }));

function mockTx(assessmentRow: unknown) {
  m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => (assessmentRow ? [assessmentRow] : [])) })),
        })),
      })),
    };
    return fn(tx);
  });
}

function req(body: unknown) {
  return new Request('http://localhost/api/icra/a1/capability/exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function loadRoute() {
  return import('../icra/[assessmentId]/capability/exchange/route');
}

describe('icra/[assessmentId]/capability/exchange route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.eq.mockReturnValue('eq');
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost', { method: 'POST', body: '{bad-json' }), {
      params: Promise.resolve({ assessmentId: 'a1' }),
    });
    expect(response.status).toBe(400);
  });

  it('returns 400 for a malformed capability payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(req({ capability: 'x' }), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(400);
  });

  it('returns 404 when the assessment does not exist', async () => {
    mockTx(null);
    const { POST } = await loadRoute();
    const response = await POST(req({ capability: TOKEN }), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(404);
  });

  it('denies a token issued for a different assessment', async () => {
    mockTx({ capabilityTokenHash: createHash('sha256').update('other-token', 'utf8').digest('hex'), capabilityTokenExpiresAt: FUTURE });
    const { POST } = await loadRoute();
    const response = await POST(req({ capability: TOKEN }), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(401);
  });

  it('denies an expired token', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: new Date(Date.now() - 1000) });
    const { POST } = await loadRoute();
    const response = await POST(req({ capability: TOKEN }), { params: Promise.resolve({ assessmentId: 'a1' }) });
    expect(response.status).toBe(410);
  });

  it('sets the HttpOnly capability cookie (never rotates) when the token is valid', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE });
    const { POST } = await loadRoute();
    const response = await POST(req({ capability: TOKEN }), { params: Promise.resolve({ assessmentId: 'a1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain(`icra_cap_a1=${TOKEN}`);
    expect(setCookie).toContain('HttpOnly');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);
const ASSESSMENT_ID = '550e8400-e29b-41d4-a716-446655440000';

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  rateLimit: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id' },
  icraMaturityProfiles: { profilePayload: 'profilePayload', assessmentId: 'assessmentId' },
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

function req(authorized = true) {
  const headers: Record<string, string> = {};
  if (authorized) headers.authorization = `Bearer ${TOKEN}`;
  return new NextRequest(`http://localhost/api/icra/results/${ASSESSMENT_ID}`, { headers });
}

function mockTx(assessmentRow: unknown, profileRows: unknown[]) {
  m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    let selectCall = 0;
    const tx = {
      select: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => (assessmentRow ? [assessmentRow] : [])) })) })) };
        }
        return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => profileRows) })) })) };
      }),
    };
    return fn(tx);
  });
}

async function loadRoute() {
  return import('../icra/results/[id]/route');
}

describe('icra/results/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockReturnValue({ success: true });
  });

  it('returns 429 when rate limited', async () => {
    m.rateLimit.mockReturnValueOnce({ success: false });
    const { GET } = await loadRoute();
    const response = await GET(req(), { params: Promise.resolve({ id: ASSESSMENT_ID }) });

    expect(response.status).toBe(429);
  });

  it('returns 401 when no capability token is presented', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }, []);
    const { GET } = await loadRoute();
    const response = await GET(req(false), { params: Promise.resolve({ id: ASSESSMENT_ID }) });

    expect(response.status).toBe(401);
  });

  it('returns 404 when the assessment does not exist', async () => {
    mockTx(null, []);
    const { GET } = await loadRoute();
    const response = await GET(req(), { params: Promise.resolve({ id: ASSESSMENT_ID }) });

    expect(response.status).toBe(404);
  });

  it('returns the ICRA profile payload when the capability matches', async () => {
    mockTx(
      { capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
      [{ profilePayload: { continuity: 'ok' } }],
    );
    const { GET } = await loadRoute();
    const response = await GET(req(), { params: Promise.resolve({ id: ASSESSMENT_ID }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ continuity: 'ok' });
  });
});
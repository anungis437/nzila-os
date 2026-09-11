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
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id' },
  icraMaturityProfiles: { assessmentId: 'assessmentId', generatedAt: 'generatedAt' },
}));

function req(authorized = true) {
  const headers: Record<string, string> = {};
  if (authorized) headers.authorization = `Bearer ${TOKEN}`;
  return new Request('http://localhost', { headers });
}

function mockTx(assessmentRow: unknown, profileRows: unknown[]) {
  m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    let selectCall = 0;
    const tx = {
      select: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => (assessmentRow ? [assessmentRow] : [])) })),
            })),
          };
        }
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => profileRows) })) })),
          })),
        };
      }),
    };
    return fn(tx);
  });
}

async function loadRoute() {
  return import('../icra/[assessmentId]/profile/route');
}

describe('icra/[assessmentId]/profile route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.eq.mockReturnValue('eq');
  });

  it('returns 401 when no capability token is presented', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }, []);
    const { GET } = await loadRoute();

    const response = await GET(req(false), { params: Promise.resolve({ assessmentId: 'a1' }) });

    expect(response.status).toBe(401);
  });

  it('returns 404 when the assessment does not exist', async () => {
    mockTx(null, []);
    const { GET } = await loadRoute();

    const response = await GET(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });

    expect(response.status).toBe(404);
  });

  it('returns 404 when profile is not found', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }, []);
    const { GET } = await loadRoute();

    const response = await GET(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });

    expect(response.status).toBe(404);
  });

  it('returns profile payload when found and capability matches', async () => {
    mockTx(
      { capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
      [{ profilePayload: { maturityBand: 'developing' } }],
    );
    const { GET } = await loadRoute();

    const response = await GET(req(), { params: Promise.resolve({ assessmentId: 'a1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ profile: { maturityBand: 'developing' } });
  });
});

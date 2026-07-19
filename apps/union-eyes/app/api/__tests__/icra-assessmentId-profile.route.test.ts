import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({
  icraMaturityProfiles: { assessmentId: 'assessmentId', generatedAt: 'generatedAt' },
}));

async function loadRoute() {
  return import('../icra/[assessmentId]/profile/route');
}

describe('icra/[assessmentId]/profile route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.eq.mockReturnValue('eq');
  });

  it('returns 404 when profile is not found', async () => {
    const { GET } = await loadRoute();
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValue({ from });

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ assessmentId: 'a1' }) });

    expect(response.status).toBe(404);
  });

  it('returns profile payload when found', async () => {
    const { GET } = await loadRoute();
    const limit = vi.fn(async () => [{ profilePayload: { maturityBand: 'developing' } }]);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValue({ from });

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ assessmentId: 'a1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ profile: { maturityBand: 'developing' } });
  });
});

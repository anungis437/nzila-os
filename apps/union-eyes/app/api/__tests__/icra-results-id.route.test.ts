import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  db: { select: vi.fn() },
  rateLimit: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema/icra-schema', () => ({ icraMaturityProfiles: { profilePayload: 'profilePayload', assessmentId: 'assessmentId' } }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../icra/results/[id]/route');
}

describe('icra/results/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockReturnValue({ success: true });
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ profilePayload: { continuity: 'ok' } }]) })) })) } as any);
  });

  it('returns the ICRA profile payload', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/icra/results/550e8400-e29b-41d4-a716-446655440000'), { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ continuity: 'ok' });
  });
});
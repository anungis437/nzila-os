import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  hasMinRole: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ organizationMembers: { organizationId: 'organizationId', deletedAt: 'deletedAt', status: 'status', role: 'role' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), isNull: vi.fn(() => 'isNull'), inArray: vi.fn(() => 'inArray'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../admin/members/stats/route');
}

describe('admin/members/stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 10 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 8 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 3 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 2 }]) })) }));
  });

  it('returns aggregate member stats', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/members/stats?organizationId=org_1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.total).toBe(10);
    expect(json.active).toBe(8);
    expect(json.stewards).toBe(3);
    expect(json.officers).toBe(2);
  });
});
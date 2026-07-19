import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizations: { organizationType: 'organizationType', hierarchyLevel: 'hierarchyLevel', name: 'name' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, ne: vi.fn(() => 'ne'), asc: vi.fn(() => 'asc') };
});

async function loadRoute() {
  return import('../organizations/hierarchy/route');
}

describe('organizations/hierarchy route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'org_1', name: 'Union', organizationType: 'union', hierarchyLevel: 1, hierarchyPath: ['root'], parentId: 'root', memberCount: 5, activeMemberCount: 4, status: 'active', sectors: [], clcAffiliated: true }]) })) })) })) } as any);
  });

  it('returns the organization hierarchy', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/organizations/hierarchy'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
  });
});
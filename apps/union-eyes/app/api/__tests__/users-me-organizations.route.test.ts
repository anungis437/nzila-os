import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  selectQueue: [] as unknown[][],
}));

function makeSelectChain() {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  })),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.auth,
  currentUser: m.currentUser,
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@nzila/os-core', () => ({
  createLogger: vi.fn(() => m.logger),
}));

async function loadRoute() {
  return import('../users/me/organizations/route');
}

describe('users/me/organizations route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'user@example.com' }] });
    process.env.PLATFORM_ADMIN_USER_IDS = '';
  });

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    expect(response.status).toBe(401);
  });

  it('returns memberships and orgs for regular users', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'm1', organizationId: 'org_1', userId: 'user_1', role: 'member', isPrimary: true, joinedAt: new Date(), createdAt: new Date() }],
      [
        { id: 'org_1', name: 'Org One', slug: 'org-one', organizationType: 'union', sectors: ['public'], provinceTerritory: 'ON', createdAt: new Date(), updatedAt: new Date() },
      ],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizations).toHaveLength(1);
    expect(payload.memberships).toHaveLength(1);
  });

  it('self-heals memberships by email and returns linked memberships', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [],
      [{ id: 'm1', organizationId: 'org_2', userId: 'legacy', email: 'user@example.com', role: 'member', isPrimary: false, joinedAt: new Date(), createdAt: new Date() }],
      [{ id: 'm1', organizationId: 'org_2', userId: 'user_1', role: 'member', isPrimary: false, joinedAt: new Date(), createdAt: new Date() }],
      [{ id: 'org_2', name: 'Org Two', slug: 'org-two', organizationType: 'union', sectors: ['private'], provinceTerritory: 'BC', createdAt: new Date(), updatedAt: new Date() }],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.memberships).toHaveLength(1);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('returns all organizations for platform admins', async () => {
    const { GET } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1';
    m.selectQueue.push(
      [{ id: 'm1', organizationId: 'org_1', userId: 'user_1', role: 'admin', isPrimary: true, joinedAt: new Date(), createdAt: new Date() }],
      [
        { id: 'org_1', name: 'Org One', slug: 'org-one', organizationType: 'union', sectors: [], provinceTerritory: 'ON', createdAt: new Date(), updatedAt: new Date() },
        { id: 'org_2', name: 'Org Two', slug: 'org-two', organizationType: 'union', sectors: [], provinceTerritory: 'AB', createdAt: new Date(), updatedAt: new Date() },
      ],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizations).toHaveLength(2);
  });
});

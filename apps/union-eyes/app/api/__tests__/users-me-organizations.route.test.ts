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
      [{ id: 'm1', organizationId: 'org_1', userId: 'user_1', role: 'member', status: 'active', isPrimary: true, joinedAt: new Date(), createdAt: new Date() }],
      [
        { id: 'org_1', name: 'Org One', slug: 'org-one', organizationType: 'union', status: 'active', sectors: ['public'], provinceTerritory: 'ON', createdAt: new Date(), updatedAt: new Date() },
      ],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizations).toHaveLength(1);
    expect(payload.memberships).toHaveLength(1);
  });

  // DEF-0B12-PLT-ORGANIZATIONS-GET-REBINDS-EVERY-MEMBERSHIP-ROW-OF-AN-E-MAIL-ADDRESS-TO-THE-CALLER-IN-THE-LEGACY-BRANCH
  it('never links memberships to the caller by e-mail address, in any organization', async () => {
    const { GET } = await loadRoute();
    // The caller has no membership of their own; another user's roster rows carry the caller's e-mail address.
    m.selectQueue.push(
      [],
      [{ id: 'm1', organizationId: 'org_2', userId: 'legacy', email: 'user@example.com', role: 'admin', isPrimary: false, joinedAt: new Date(), createdAt: new Date() }],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.memberships).toEqual([]);
    expect(payload.organizations).toEqual([]);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.currentUser).not.toHaveBeenCalled();
    // Only the membership lookup by the authenticated user id ran.
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('never moves another user id\'s memberships to the caller through a matching profile', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([], [], [{ legacyUserId: 'legacy-user' }]);

    await GET(new NextRequest('http://localhost/api/users/me/organizations'));

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('does not enumerate non-member organizations for platform admins', async () => {
    const { GET } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1';
    m.selectQueue.push(
      [{ id: 'm1', organizationId: 'org_1', userId: 'user_1', role: 'admin', status: 'active', isPrimary: true, joinedAt: new Date(), createdAt: new Date() }],
      [
        { id: 'org_1', name: 'Org One', slug: 'org-one', organizationType: 'union', status: 'active', sectors: [], provinceTerritory: 'ON', createdAt: new Date(), updatedAt: new Date() },
        { id: 'org_2', name: 'Org Two', slug: 'org-two', organizationType: 'union', status: 'active', sectors: [], provinceTerritory: 'AB', createdAt: new Date(), updatedAt: new Date() },
      ],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizations).toHaveLength(1);
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});

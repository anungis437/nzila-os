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
// A person's memberships span organizations, so they are read as the system role inside an explicit context; the ambient handle must never be used.
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get() { throw new Error('ambient db used outside a context'); } }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (operation: (tx: typeof mockDb) => Promise<unknown>) => operation(mockDb)),
}));
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

  // #1116: a platform title confers no tenant enumeration.
  it('offers a platform administrator only the active organizations of their own active memberships', async () => {
    const { GET } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1';
    m.selectQueue.push(
      [{ id: 'm1', organizationId: 'org_1', userId: 'user_1', role: 'admin', isPrimary: true, joinedAt: new Date(), createdAt: new Date() }],
      [
        { id: 'org_1', name: 'Org One', slug: 'org-one', organizationType: 'union', sectors: [], provinceTerritory: 'ON', status: 'active', createdAt: new Date(), updatedAt: new Date() },
      ],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizations.map((o: { id: string }) => o.id)).toEqual(['org_1']);
    expect(payload.memberships.map((x: { organizationId: string }) => x.organizationId)).toEqual(['org_1']);
    // The organization read is bounded to the caller's membership ids, never an unfiltered list.
    const orgChain = mockDb.select.mock.results[1].value;
    expect(orgChain.where).toHaveBeenCalledTimes(1);
    expect(orgChain.limit).not.toHaveBeenCalled();
  });

  it('offers a platform administrator with no membership no organization at all', async () => {
    const { GET } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1';
    m.selectQueue.push([], [{ id: 'org_2', name: 'Org Two', slug: 'org-two', status: 'active' }]);

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizations).toEqual([]);
    expect(payload.memberships).toEqual([]);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('offers a member only the active organizations they belong to, with the memberships of those organizations', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [
        { id: 'm1', organizationId: 'org_1', userId: 'user_1', role: 'member', isPrimary: true, joinedAt: new Date(), createdAt: new Date() },
        { id: 'm2', organizationId: 'org_archived', userId: 'user_1', role: 'admin', isPrimary: false, joinedAt: new Date(), createdAt: new Date() },
      ],
      [
        { id: 'org_1', name: 'Org One', slug: 'org-one', organizationType: 'union', sectors: [], provinceTerritory: 'ON', status: 'active', createdAt: new Date(), updatedAt: new Date() },
        { id: 'org_archived', name: 'Old', slug: 'old', organizationType: 'union', sectors: [], provinceTerritory: 'ON', status: 'archived', createdAt: new Date(), updatedAt: new Date() },
      ],
    );

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.organizations.map((o: { id: string }) => o.id)).toEqual(['org_1']);
    expect(payload.memberships.map((x: { organizationId: string }) => x.organizationId)).toEqual(['org_1']);
  });

  it('answers 500, not an empty 200, when the database read fails', async () => {
    const { GET } = await loadRoute();
    mockDb.select.mockImplementationOnce(() => { throw new Error('connection reset'); });

    const response = await GET(new NextRequest('http://localhost/api/users/me/organizations'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to load organizations' });
  });
});

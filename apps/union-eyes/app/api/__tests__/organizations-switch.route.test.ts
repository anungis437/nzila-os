import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const ORG = '11111111-1111-4111-8111-111111111111';
const ORG_404 = '22222222-2222-4222-8222-222222222222';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  selectQueue: [] as unknown[][],
  contexts: [] as string[],
}));

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

const mockTx = {
  select: vi.fn(() => makeChain((m.selectQueue.shift() ?? []) as unknown[])),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.auth,
}));

// The caller's memberships span organizations, so the lookup runs as the system role inside an explicit context; the ambient handle must never be used.
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get() { throw new Error('ambient db used outside a context'); } }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (operation: (tx: typeof mockTx) => Promise<unknown>) => {
    m.contexts.push('system');
    return operation(mockTx);
  }),
}));
const recordSelection = vi.hoisted(() => vi.fn());
// Disclosed addition (B103): a selection is recorded before it is returned.
vi.mock('@/lib/auth/organization-selection-audit', () => ({ recordOrganizationSelection: recordSelection }));

async function loadRoute() {
  return import('../organizations/switch/route');
}

const request = (body: string) =>
  new NextRequest('http://localhost/api/organizations/switch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

describe('organizations/switch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.contexts = [];
    recordSelection.mockReset();
    recordSelection.mockResolvedValue(undefined);
    m.auth.mockResolvedValue({ userId: 'user_1' });
    delete process.env.PLATFORM_ADMIN_USER_IDS;
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(401);
    expect(m.contexts).toEqual([]);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request('not-json'));

    expect(response.status).toBe(400);
  });

  it('POST returns 400 when organizationId missing', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request(JSON.stringify({})));

    expect(response.status).toBe(400);
  });

  it('POST returns 400, before any statement, for an organizationId that is not an organization id', async () => {
    const { POST } = await loadRoute();

    for (const value of ['org_1', 'x'.repeat(40), 42, null]) {
      const response = await POST(request(JSON.stringify({ organizationId: value })));
      expect(response.status).toBe(400);
    }
    expect(mockTx.select).not.toHaveBeenCalled();
    expect(m.contexts).toEqual([]);
  });

  it('POST returns 413 for a body over the limit', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request(JSON.stringify({ organizationId: ORG, padding: 'x'.repeat(8 * 1024) })));

    expect(response.status).toBe(413);
    expect(mockTx.select).not.toHaveBeenCalled();
  });

  it('POST returns 404 when organization is not found', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(request(JSON.stringify({ organizationId: ORG_404 })));

    expect(response.status).toBe(404);
  });

  it('POST returns 403 when non-admin user has no membership', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: ORG, name: 'Org 1', slug: 'org-1' }],
      [],
      [],
    );

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(403);
  });

  // #1116: a platform title confers no tenant selection.
  it('POST denies a platform administrator who holds no membership of the organization', async () => {
    const { POST } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1,other_user';
    m.selectQueue.push([{ id: ORG, name: 'Org 1', slug: 'org-1', status: 'active' }], []);

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(403);
    expect((await response.json()).organization).toBeUndefined();
    expect(recordSelection).not.toHaveBeenCalled();
    // The membership lookup is made for the platform administrator exactly as for anyone else.
    expect(mockTx.select).toHaveBeenCalledTimes(2);
  });

  it('POST lets a platform administrator switch only on their own membership, and records membership authority', async () => {
    const { POST } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1';
    m.selectQueue.push([{ id: ORG, name: 'Org 1', slug: 'org-1', status: 'active' }], [{ id: 'membership_1', userId: 'user_1', organizationId: ORG }]);

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(200);
    expect(recordSelection).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, userId: 'user_1', authority: 'membership' }));
    expect(recordSelection).not.toHaveBeenCalledWith(expect.objectContaining({ authority: 'platform_administrator' }));
  });

  it('POST answers 404 to a platform administrator for an archived organization, before any membership lookup', async () => {
    const { POST } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1';
    m.selectQueue.push([{ id: ORG, name: 'Org 1', slug: 'org-1', status: 'archived' }], [{ id: 'membership_1' }]);

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(404);
    expect(recordSelection).not.toHaveBeenCalled();
    expect(mockTx.select).toHaveBeenCalledTimes(1);
  });

  it('POST counts only an active, non-deleted membership: a suspended membership is denied', async () => {
    const { POST } = await loadRoute();
    // The suspended row is filtered out by the lookup's predicate, so the database returns nothing.
    m.selectQueue.push([{ id: ORG, name: 'Org 1', slug: 'org-1', status: 'active' }], []);

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(403);
    expect(recordSelection).not.toHaveBeenCalled();
    const membershipWhere = mockTx.select.mock.results[1].value.where.mock.calls[0][0] as SQL;
    const query = new PgDialect().sqlToQuery(membershipWhere);
    expect(query.sql).toContain('"organization_members"."status" = $');
    expect(query.sql).toContain('"organization_members"."deleted_at" is null');
    expect(query.params).toEqual(expect.arrayContaining(['user_1', ORG, 'active']));
  });

  // DEF-0B10-OPL-10
  it('POST records a member selection, and refuses the selection when it cannot be recorded', async () => {
    const { POST } = await loadRoute();
    const req = () => request(JSON.stringify({ organizationId: ORG }));
    m.selectQueue.push([{ id: ORG, name: 'Org 1', slug: 'org-1' }], [{ id: 'membership_1', userId: 'user_1', organizationId: ORG }]);
    expect((await POST(req())).status).toBe(200);
    expect(recordSelection).toHaveBeenCalledWith(expect.objectContaining({ authority: 'membership', mode: 'legacy' }));

    m.selectQueue.push([{ id: ORG, name: 'Org 1', slug: 'org-1' }], [{ id: 'membership_1', userId: 'user_1', organizationId: ORG }]);
    recordSelection.mockRejectedValueOnce(new Error('audit down'));
    const refused = await POST(req());
    expect(refused.status).toBe(503);
    expect((await refused.json()).success).toBeUndefined();
  });

  it('POST allows member user with UUID membership', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: ORG, name: 'Org 1', slug: 'org-1' }],
      [{ id: 'membership_1', userId: 'user_1', organizationId: ORG }],
    );

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    // The organization and the membership are read in one system-role transaction.
    expect(m.contexts).toEqual(['system']);
    expect(mockTx.select).toHaveBeenCalledTimes(2);
  });

  // DEF-0B10-OPL-09
  it('POST answers 404 to a member for an organization that is not active', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: ORG, name: 'Org 1', slug: 'org-1', status: 'archived' }], [{ id: 'membership_1', userId: 'user_1', organizationId: ORG }]);

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(404);
    expect(recordSelection).not.toHaveBeenCalled();
  });

  it('POST denies a member when the UUID membership is absent', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: ORG, name: 'Org 1', slug: 'org-1' }],
      [],
    );

    const response = await POST(request(JSON.stringify({ organizationId: ORG })));

    expect(response.status).toBe(403);
    expect(recordSelection).not.toHaveBeenCalled();
  });
});

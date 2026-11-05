import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server';

// DEF-0B9-ORG-ITEM-GET…, -ANALYTICS…, -CHILDREN…, -DESCENDANTS…, -HIERARCHY-LIST…, DEF-0B10-OPL-05 (search),
// DEF-0B9-ORG-ROSTER-GET…, DEF-0B9-ORG-ROSTER-POST…: each answered any signed-in user, reading as the system role.
// The real routes and the real read-authority module run against real SQL holding three organizations.
// Issue #1116: authority is direct and specific. An administrator above an organization sees its directory entry only, and a platform
// title confers nothing; neither receives a roster, contact details, member counts, grievance counts or analytics.

const state = vi.hoisted(() => ({
  db: null as unknown,
  userId: 'u-member-a',
  platformAdmins: new Set<string>(),
  audit: [] as Array<Record<string, unknown>>,
  ctxRoles: {} as Record<string, string>,
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: state.userId }) }));
vi.mock('@/db/db', () => ({
  db: new Proxy({}, {
    get(_t, prop) {
      const real = state.db as Record<PropertyKey, unknown>;
      if (prop === 'execute') return async (q: unknown) => ((real.execute as (q: unknown) => Promise<{ rows: unknown[] }>)(q)).then((r) => r.rows);
      const value = real[prop];
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
    },
  }),
}));
vi.mock('@/db/schema', async () => {
  const orgs = await vi.importActual<typeof import('@/db/schema-organizations')>('@/db/schema-organizations');
  return { organizationMembers: orgs.organizationMembers, organizations: orgs.organizations };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => Promise<unknown>)(state.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: async (_tx: unknown, e: Record<string, unknown>) => void state.audit.push(e) }));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => false }));
vi.mock('@/lib/api-auth-guard', () => ({
  auth: async () => ({ userId: state.userId }),
  ROLE_HIERARCHY: { member: 20, steward: 50, officer: 80, admin: 140 },
  isPlatformAdminUser: async (id: string) => state.platformAdmins.has(id),
  requireSystemAdmin: async () => { throw new Error('Forbidden'); },
  // Mirrors the mode-aware guard: an ACTIVE membership of this organization, else Forbidden.
  requireUserForOrganization: async (organizationId: string) => {
    const role = state.ctxRoles[`${state.userId}:${organizationId}`];
    if (!role) throw new Error('Forbidden');
    return { userId: state.userId, organizationId, roles: [role] };
  },
}));

const FED = '11111111-1111-4111-8111-111111111111';
const LOCAL_A = '22222222-2222-4222-8222-222222222222';
const LOCAL_B = '33333333-3333-4333-8333-333333333333';
let pg: PGlite;

const get = (url: string) => new NextRequest(`http://localhost${url}`);
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const names = async (res: Response) => ((await res.json()).data as Array<{ id: string }>).map((r) => r.id).sort();

async function member(user: string, org: string, role: string, status = 'active') {
  await pg.query(
    `INSERT INTO organization_members (id, user_id, organization_id, role, status, name, email, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2::uuid, $3, $4, $1, $1 || '@x.example', now(), now())`,
    [user, org, role, status],
  );
  if (status === 'active') state.ctxRoles[`${user}:${org}`] = role;
}

beforeAll(async () => {
  const { organizations, organizationMembers } = await import('@/db/schema-organizations');
  const { createTableDatabase } = await import('./support/pglite-tables');
  const created = await createTableDatabase([organizations, organizationMembers], ['CREATE TABLE grievances (organization_id uuid, status text, created_at timestamptz default now(), resolved_at timestamptz, closed_at timestamptz)']);
  pg = created.pg;
  state.db = created.db;
  // The table helper creates columns only; the production uniqueness of a user on a roster is a separate index.
  await pg.exec('CREATE UNIQUE INDEX unique_org_membership ON organization_members (organization_id, user_id)');
});

afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  state.audit.length = 0;
  state.platformAdmins.clear();
  state.ctxRoles = {};
  state.userId = 'u-member-a';
  await pg.exec('TRUNCATE organizations, organization_members, grievances CASCADE');
  const org = (id: string, name: string, type: string, parent: string | null, path: string[]) =>
    pg.query(
      `INSERT INTO organizations (id, name, slug, organization_type, parent_id, hierarchy_path, settings, billing_contact_id, subscription_tier, created_by)
       VALUES ($1::uuid, $2, lower($2), $3, $4::uuid, $5::uuid[], '{"perCapitaRate": 9}'::jsonb, '44444444-4444-4444-8444-444444444444', 'pro', 'creator')`,
      [id, name, type, parent, path],
    );
  await org(FED, 'Federation', 'federation', null, [FED]);
  await org(LOCAL_A, 'LocalA', 'local', FED, [FED, LOCAL_A]);
  await org(LOCAL_B, 'LocalB', 'local', FED, [FED, LOCAL_B]);
  await member('u-member-a', LOCAL_A, 'member');
  await member('u-steward-a', LOCAL_A, 'steward');
  await member('u-officer-a', LOCAL_A, 'officer');
  await member('u-admin-a', LOCAL_A, 'admin');
  await member('u-admin-fed', FED, 'admin');
  await member('u-member-b', LOCAL_B, 'member');
  await member('u-suspended-a', LOCAL_A, 'member', 'suspended');
  await pg.query(`INSERT INTO grievances (organization_id, status) VALUES ($1::uuid, 'filed'), ($1::uuid, 'closed')`, [LOCAL_A]);
});

/** What an affiliated-only caller must never receive about an organization. */
const PRIVATE_KEYS = [
  'settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'legacy_org_id', 'email', 'phone', 'address', 'charter_number',
  'member_count', 'active_member_count', 'memberCount', 'activeClaims', 'totalClaims', 'description', 'sectors', 'website', 'display_name',
];
const expectDirectoryOnly = (row: Record<string, unknown>, label: string) => {
  for (const key of PRIVATE_KEYS) expect(row, `${label}: ${key}`).not.toHaveProperty(key);
};
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const platformCaller = () => {
  state.userId = 'platform-1';
  state.platformAdmins.add('platform-1');
};

describe('GET /api/organizations/[id]', () => {
  it('a signed-in stranger reads another organization as not found, and a suspended or removed member too', async () => {
    const { GET } = await import('../organizations/[id]/route');
    await member('u-removed-a', LOCAL_A, 'admin');
    await pg.query(`UPDATE organization_members SET deleted_at = now() WHERE user_id = 'u-removed-a'`);
    for (const user of ['u-member-b', 'u-suspended-a', 'u-removed-a', 'nobody']) {
      state.userId = user;
      expect((await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).status, user).toBe(404);
    }
  });

  it('an unknown organization id reads exactly as an organization the caller may not see: no existence leak', async () => {
    const { GET } = await import('../organizations/[id]/route');
    state.userId = 'u-admin-fed';
    const unknown = await GET(get(`/api/organizations/${UNKNOWN}`), params(UNKNOWN));
    state.userId = 'u-member-b';
    const foreign = await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A));
    expect(unknown.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(await unknown.json()).toEqual(await foreign.json());
  });

  it('a member reads the public profile without settings, billing contact, tier, provenance, contact details, membership figures or grievance counts; an administrator reads all', async () => {
    const { GET } = await import('../organizations/[id]/route');
    state.userId = 'u-member-a';
    const asMember = (await (await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).json()).data;
    expect(asMember).toMatchObject({ id: LOCAL_A, name: 'LocalA' });
    for (const key of ['settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'legacy_org_id', 'email', 'phone', 'address', 'charter_number', 'member_count', 'active_member_count', 'memberCount', 'activeClaims', 'totalClaims']) {
      expect(asMember, key).not.toHaveProperty(key);
    }
    state.userId = 'u-admin-a';
    const asAdmin = (await (await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).json()).data;
    expect(asAdmin).toMatchObject({ billing_contact_id: '44444444-4444-4444-8444-444444444444', subscription_tier: 'pro', totalClaims: 2, activeClaims: 1 });
  });

  it('the administrator of the federation sees only the directory entry of a local below it; a member of the federation does not see a local', async () => {
    const { GET } = await import('../organizations/[id]/route');
    state.userId = 'u-admin-fed';
    const response = await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    // Exactly the directory entry (the table helper creates columns without defaults, so level and status are null here).
    expect(Object.keys(data).sort()).toEqual(
      ['id', 'name', 'slug', 'organization_type', 'parent_id', 'hierarchy_level', 'hierarchy_path', 'status', 'childCount'].sort(),
    );
    expect(data).toMatchObject({ id: LOCAL_A, name: 'LocalA', slug: 'locala', organization_type: 'local', parent_id: FED, hierarchy_path: [FED, LOCAL_A], childCount: 0 });
    expectDirectoryOnly(data, 'ancestor admin');
    await member('u-member-fed', FED, 'member');
    state.userId = 'u-member-fed';
    expect((await GET(get(`/api/organizations/${LOCAL_B}`), params(LOCAL_B))).status).toBe(404);
  });

  it('a local administrator does not see a sibling local', async () => {
    const { GET } = await import('../organizations/[id]/route');
    state.userId = 'u-admin-a';
    expect((await GET(get(`/api/organizations/${LOCAL_B}`), params(LOCAL_B))).status).toBe(404);
  });

  it('a platform title confers no organization: every organization reads as not found', async () => {
    const { GET } = await import('../organizations/[id]/route');
    platformCaller();
    for (const id of [FED, LOCAL_A, LOCAL_B]) {
      expect((await GET(get(`/api/organizations/${id}`), params(id))).status, id).toBe(404);
    }
  });
});

describe('children, descendants, hierarchy, search, tree', () => {
  it('children and descendants of an organization are not listed to a stranger, nor siblings to a member', async () => {
    const children = await import('../organizations/[id]/children/route');
    const descendants = await import('../organizations/[id]/descendants/route');
    state.userId = 'u-member-b';
    expect((await children.GET(get(`/api/organizations/${FED}/children`), params(FED))).status).toBe(404);
    expect((await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED))).status).toBe(404);
    await member('u-member-fed', FED, 'member');
    state.userId = 'u-member-fed';
    expect(await names(await children.GET(get(`/api/organizations/${FED}/children`), params(FED)))).toEqual([]);
    state.userId = 'u-admin-fed';
    expect(await names(await children.GET(get(`/api/organizations/${FED}/children`), params(FED)))).toEqual([LOCAL_A, LOCAL_B].sort());
    expect(await names(await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED)))).toEqual([LOCAL_A, LOCAL_B].sort());
  });

  it('gives the administrator above the directory entries of the locals below, without member counts or profile', async () => {
    const children = await import('../organizations/[id]/children/route');
    const descendants = await import('../organizations/[id]/descendants/route');
    state.userId = 'u-admin-fed';
    for (const res of [
      await children.GET(get(`/api/organizations/${FED}/children`), params(FED)),
      await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED)),
    ]) {
      for (const row of (await res.json()).data) expectDirectoryOnly(row, row.id);
    }
    platformCaller();
    expect((await children.GET(get(`/api/organizations/${FED}/children`), params(FED))).status).toBe(404);
    expect((await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED))).status).toBe(404);
  });

  it('rejects a malformed organization id before any read', async () => {
    const children = await import('../organizations/[id]/children/route');
    expect((await children.GET(get('/api/organizations/x/children'), params("x' OR 1=1 --"))).status).toBe(400);
  });

  it('hierarchy and search list only what the caller is affiliated with, and a platform title lists nothing', async () => {
    const hierarchy = await import('../organizations/hierarchy/route');
    const search = await import('../organizations/search/route');
    state.userId = 'u-member-a';
    expect(await names(await hierarchy.GET(get('/api/organizations/hierarchy')))).toEqual([LOCAL_A]);
    expect(await names(await search.GET(get('/api/organizations/search?q=Local')))).toEqual([LOCAL_A]);
    expect(await names(await search.GET(get('/api/organizations/search?q=Federation')))).toEqual([]);
    state.userId = 'u-admin-fed';
    const tree = (await (await hierarchy.GET(get('/api/organizations/hierarchy'))).json()).data as Array<Record<string, unknown>>;
    expect(tree.map((r) => r.id).sort()).toEqual([FED, LOCAL_A, LOCAL_B].sort());
    for (const row of tree.filter((r) => r.id !== FED)) expectDirectoryOnly(row, String(row.id));
    expect(tree.find((r) => r.id === FED)).toHaveProperty('member_count');
    const found = (await (await search.GET(get('/api/organizations/search?q=Local'))).json()).data as Array<Record<string, unknown>>;
    expect(found.map((r) => r.id).sort()).toEqual([LOCAL_A, LOCAL_B].sort());
    for (const row of found) expectDirectoryOnly(row, String(row.id));
    state.userId = 'nobody';
    expect(await (await hierarchy.GET(get('/api/organizations/hierarchy'))).json()).toMatchObject({ data: [] });
    expect(await (await search.GET(get('/api/organizations/search?q=Local'))).json()).toMatchObject({ data: [] });
    platformCaller();
    expect(await (await search.GET(get('/api/organizations/search?q=Local'))).json()).toMatchObject({ data: [] });
    expect(await (await hierarchy.GET(get('/api/organizations/hierarchy'))).json()).toMatchObject({ data: [] });
  });

  it('a suspended member lists nothing', async () => {
    const hierarchy = await import('../organizations/hierarchy/route');
    state.userId = 'u-suspended-a';
    expect(await (await hierarchy.GET(get('/api/organizations/hierarchy'))).json()).toMatchObject({ data: [] });
  });
});

describe('GET /api/organizations (list) and /api/organizations/tree', () => {
  const listed = async (url = '/api/organizations') => {
    const { GET } = await import('../organizations/route');
    return GET(get(url));
  };

  it('lists nothing to a signed-in stranger, a suspended member or a platform title, and refuses an anonymous caller', async () => {
    state.platformAdmins.add('platform-1');
    for (const user of ['nobody', 'u-suspended-a', 'platform-1']) {
      state.userId = user;
      expect(await (await listed()).json(), user).toMatchObject({ data: [] });
    }
    state.userId = '';
    expect((await listed()).status).toBe(401);
  });

  it('lists only the caller\'s own organization to a member, never a sibling or the federation above', async () => {
    state.userId = 'u-member-b';
    expect(await names(await listed())).toEqual([LOCAL_B]);
    state.userId = 'u-member-a';
    expect(await names(await listed())).toEqual([LOCAL_A]);
    expect(await names(await listed(`/api/organizations?parent=${FED}`))).toEqual([LOCAL_A]);
  });

  it('gives a member the public profile only, the administrator everything for their own organization, and the administrator above the directory entry', async () => {
    state.userId = 'u-member-a';
    const [asMember] = (await (await listed('/api/organizations?include_stats=true')).json()).data;
    for (const key of ['settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'legacy_org_id', 'email', 'phone', 'address', 'charter_number', 'activeClaims']) {
      expect(asMember, key).not.toHaveProperty(key);
    }
    expect(asMember).toMatchObject({ id: LOCAL_A, childCount: 0 });

    state.userId = 'u-admin-a';
    const [asAdmin] = (await (await listed('/api/organizations?include_stats=true')).json()).data;
    expect(asAdmin).toMatchObject({ id: LOCAL_A, billing_contact_id: '44444444-4444-4444-8444-444444444444', subscription_tier: 'pro', activeClaims: 1 });

    state.userId = 'u-admin-fed';
    const rows = (await (await listed('/api/organizations?include_stats=true')).json()).data as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.id).sort()).toEqual([FED, LOCAL_A, LOCAL_B].sort());
    for (const local of rows.filter((r) => r.id !== FED)) expectDirectoryOnly(local, String(local.id));
    expect(rows.find((r) => r.id === FED)).toMatchObject({ subscription_tier: 'pro', activeClaims: 0, childCount: 2 });
  });

  it('rejects a malformed parent or status filter before any read', async () => {
    state.userId = 'u-admin-fed';
    expect((await listed('/api/organizations?parent=not-a-uuid')).status).toBe(400);
    expect((await listed("/api/organizations?status=active'%20OR%201=1")).status).toBe(400);
    expect((await listed('/api/organizations?purpose=everything')).status).toBe(400);
  });

  // DEF-0B10-OPL-02: what a caller may read is not what they may choose as a parent. Changing a parent needs an approved institutional
  // workflow that is not built, so no caller (a platform title included) is offered candidates.
  it('offers parent candidates to no caller, platform title included, and says so honestly', async () => {
    const candidates = async (user: string) => {
      state.userId = user;
      return (await listed('/api/organizations?purpose=parent')).json();
    };
    state.platformAdmins.add('platform-1');
    for (const user of ['platform-1', 'u-admin-fed', 'u-admin-a', 'u-officer-a', 'u-member-a', 'nobody']) {
      expect(await candidates(user), user).toEqual({ data: [], purpose: 'parent', assignable: false });
    }
    // The same federation administrator still sees the locals below (as directory entries) when no purpose is named.
    state.userId = 'u-admin-fed';
    expect(await names(await listed())).toEqual([FED, LOCAL_A, LOCAL_B].sort());
  });

  it('confines the tree to what the caller is affiliated with, in the legacy mode', async () => {
    const { GET } = await import('../organizations/tree/route');
    state.userId = 'u-member-b';
    expect(await names(await GET(get('/api/organizations/tree')))).toEqual([LOCAL_B]);
    state.userId = 'nobody';
    expect(await (await GET(get('/api/organizations/tree'))).json()).toMatchObject({ data: [] });
    platformCaller();
    expect(await (await GET(get('/api/organizations/tree'))).json()).toMatchObject({ data: [] });
    state.userId = 'u-admin-fed';
    const rows = (await (await GET(get('/api/organizations/tree'))).json()).data as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.id).sort()).toEqual([FED, LOCAL_A, LOCAL_B].sort());
    for (const local of rows.filter((r) => r.id !== FED)) {
      expectDirectoryOnly(local, String(local.id));
      for (const key of ['sector', 'jurisdiction', 'createdAt', 'updatedAt']) expect(local, key).not.toHaveProperty(key);
    }
  });
});

describe('analytics', () => {
  it('is given only to the organization\'s own administrator; everyone else (officer, ancestor administrator, platform title, stranger) reads not found', async () => {
    const { GET } = await import('../organizations/[id]/analytics/route');
    state.platformAdmins.add('platform-1');
    for (const user of ['u-member-b', 'u-member-a', 'u-steward-a', 'u-officer-a', 'u-admin-fed', 'u-suspended-a', 'platform-1', 'nobody']) {
      state.userId = user;
      expect((await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).status, user).toBe(404);
    }
    state.userId = 'u-admin-a';
    expect((await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).status).toBe(200);
  });

  // DEF-0B9-ORG-ANALYTICS-METRIC-QUERIES-RUN-IN-SESSION-ORGANIZATION-CONTEXT-FILTERED-BY-PATH-ID-RETURNING-ZEROS: the figures are those of the
  // organization in the path.
  it('reports the figures of the organization in the path to its own administrator', async () => {
    const { GET } = await import('../organizations/[id]/analytics/route');
    state.userId = 'u-admin-a';
    const { data } = await (await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).json();
    // The seeded organization is below the minimum group size (5 members of whom 1 is inactive, 2 claims), so the figures are withheld
    // rather than published (the small-group rule); the identity of the organization and its child count are not figures about people.
    expect(data).toMatchObject({
      organizationId: LOCAL_A,
      totalMembers: null,
      activeMembers: null,
      totalClaims: null,
      activeClaims: null,
      resolvedClaims: null,
      childOrganizations: 0,
      claimsByStatus: null,
      suppression: { members: true, claims: true },
    });
  });
});

describe('roster', () => {
  const rosterGet = async (user: string, org = LOCAL_A) => {
    const { GET } = await import('../organizations/[id]/members/route');
    state.userId = user;
    return GET(get(`/api/organizations/${org}/members`), params(org));
  };
  const rosterPost = async (user: string, body: Record<string, unknown>, org = LOCAL_A) => {
    const { POST } = await import('../organizations/[id]/members/route');
    state.userId = user;
    return POST(new NextRequest(`http://localhost/api/organizations/${org}/members`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), params(org));
  };

  it('only the organization\'s own administrator reads the roster: not a member, steward, officer, ancestor administrator, platform title or stranger', async () => {
    state.platformAdmins.add('platform-1');
    for (const user of ['u-member-a', 'u-suspended-a', 'u-member-b', 'u-steward-a', 'u-officer-a', 'u-admin-fed', 'platform-1']) {
      expect((await rosterGet(user)).status, user).toBe(403);
    }
    const admin = await rosterGet('u-admin-a');
    expect(admin.status).toBe(200);
    expect((await admin.json()).data.every((r: { organization_id: string }) => r.organization_id === LOCAL_A)).toBe(true);
  });

  // DEF-0B9-ORG-ROSTER-GET-INCLUDES-REMOVED-MEMBERS-AND-IS-UNBOUNDED
  it('leaves a removed member off the roster and reads it a page at a time in a stable order', async () => {
    await pg.query(`UPDATE organization_members SET deleted_at = now() WHERE user_id = 'u-member-a'`);
    const { GET } = await import('../organizations/[id]/members/route');
    state.userId = 'u-admin-a';
    const all = (await (await GET(get(`/api/organizations/${LOCAL_A}/members`), params(LOCAL_A))).json()).data as Array<{ user_id: string }>;
    expect(all.map((r) => r.user_id)).not.toContain('u-member-a');
    const first = (await (await GET(get(`/api/organizations/${LOCAL_A}/members?limit=2&page=1`), params(LOCAL_A))).json()).data as Array<{ user_id: string }>;
    const second = (await (await GET(get(`/api/organizations/${LOCAL_A}/members?limit=2&page=2`), params(LOCAL_A))).json()).data as Array<{ user_id: string }>;
    expect(first).toHaveLength(2);
    expect([...first, ...second].map((r) => r.user_id)).toEqual(all.slice(0, first.length + second.length).map((r) => r.user_id));
    expect(new Set([...first, ...second].map((r) => r.user_id)).size).toBe(first.length + second.length);
  });

  it('a removed administrator no longer reads the roster', async () => {
    await pg.query(`UPDATE organization_members SET deleted_at = now() WHERE user_id = 'u-admin-a'`);
    expect((await rosterGet('u-admin-a')).status).toBe(403);
  });

  const candidate = { user_id: 'new-user', name: 'New Person', email: 'new@x.example' };

  it('the organization\'s administrator may add a member, but only as a pending membership; naming a user id grants no access', async () => {
    const response = await rosterPost('u-admin-a', { ...candidate, role: 'member', status: 'active' });
    expect(response.status).toBe(201);
    const { rows } = await pg.query('SELECT role, status FROM organization_members WHERE user_id = $1', ['new-user']);
    expect(rows).toEqual([{ role: 'member', status: 'pending' }]);
    expect(state.audit).toContainEqual(expect.objectContaining({ action: 'membership.create', details: expect.objectContaining({ status: 'pending' }) }));
  });

  // DEF-0B9-ORG-ROSTER-POST-DUPLICATE-USER-ID-AND-INVALID-JSON-HANDLING-LEAVES-UNHANDLED-ERRORS
  it('answers 409, not a server error, when the user is already on the roster, and keeps the one row', async () => {
    expect((await rosterPost('u-admin-a', { ...candidate, role: 'member' })).status).toBe(201);
    const again = await rosterPost('u-admin-a', { ...candidate, role: 'member' });
    expect(again.status).toBe(409);
    expect((await pg.query('SELECT 1 FROM organization_members WHERE user_id = $1', ['new-user'])).rows).toHaveLength(1);
  });

  it('nobody grants a privileged role (admin, executive) through this route', async () => {
    for (const role of ['admin', 'executive']) {
      const response = await rosterPost('u-admin-a', { ...candidate, role });
      expect(response.status, role).toBe(403);
    }
    expect((await pg.query('SELECT 1 FROM organization_members WHERE user_id = $1', ['new-user'])).rows).toHaveLength(0);
    expect((await rosterPost('u-admin-a', { ...candidate, role: 'steward' })).status).toBe(201);
  });

  it('a member, steward, officer, ancestor administrator, platform title and stranger cannot add anyone', async () => {
    state.platformAdmins.add('platform-1');
    for (const user of ['u-member-a', 'u-member-b', 'u-steward-a', 'u-officer-a', 'u-admin-fed', 'platform-1', 'nobody']) {
      expect((await rosterPost(user, { ...candidate, role: 'member' })).status, user).toBe(403);
    }
    expect((await pg.query('SELECT 1 FROM organization_members WHERE user_id = $1', ['new-user'])).rows).toHaveLength(0);
  });
});

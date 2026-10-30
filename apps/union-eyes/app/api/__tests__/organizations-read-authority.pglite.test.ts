import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server';

// DEF-0B9-ORG-ITEM-GET…, -ANALYTICS…, -CHILDREN…, -DESCENDANTS…, -HIERARCHY-LIST…, DEF-0B10-OPL-05 (search),
// DEF-0B9-ORG-ROSTER-GET…, DEF-0B9-ORG-ROSTER-POST…: each answered any signed-in user, reading as the system role.
// The real routes and the real read-authority module run against real SQL holding three organizations.

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

describe('GET /api/organizations/[id]', () => {
  it('a signed-in stranger reads another organization as not found, and a suspended member too', async () => {
    const { GET } = await import('../organizations/[id]/route');
    for (const user of ['u-member-b', 'u-suspended-a', 'nobody']) {
      state.userId = user;
      expect((await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).status, user).toBe(404);
    }
  });

  it('a member reads the profile without settings, billing contact, tier or provenance; an administrator reads all', async () => {
    const { GET } = await import('../organizations/[id]/route');
    state.userId = 'u-member-a';
    const asMember = (await (await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).json()).data;
    expect(asMember).toMatchObject({ id: LOCAL_A, name: 'LocalA', totalClaims: 2 });
    for (const key of ['settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'legacy_org_id']) expect(asMember).not.toHaveProperty(key);
    state.userId = 'u-admin-a';
    const asAdmin = (await (await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).json()).data;
    expect(asAdmin).toMatchObject({ billing_contact_id: '44444444-4444-4444-8444-444444444444', subscription_tier: 'pro' });
  });

  it('the administrator of the federation reads a local below it; a member of the federation does not read a sibling local', async () => {
    const { GET } = await import('../organizations/[id]/route');
    state.userId = 'u-admin-fed';
    expect((await GET(get(`/api/organizations/${LOCAL_B}`), params(LOCAL_B))).status).toBe(200);
    await member('u-member-fed', FED, 'member');
    state.userId = 'u-member-fed';
    expect((await GET(get(`/api/organizations/${LOCAL_B}`), params(LOCAL_B))).status).toBe(404);
  });

  it('a platform administrator reads any organization', async () => {
    const { GET } = await import('../organizations/[id]/route');
    state.userId = 'platform-1';
    state.platformAdmins.add('platform-1');
    expect((await GET(get(`/api/organizations/${LOCAL_B}`), params(LOCAL_B))).status).toBe(200);
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

  it('rejects a malformed organization id before any read', async () => {
    const children = await import('../organizations/[id]/children/route');
    expect((await children.GET(get('/api/organizations/x/children'), params("x' OR 1=1 --"))).status).toBe(400);
  });

  it('hierarchy and search list only what the caller may read', async () => {
    const hierarchy = await import('../organizations/hierarchy/route');
    const search = await import('../organizations/search/route');
    state.userId = 'u-member-a';
    expect(await names(await hierarchy.GET(get('/api/organizations/hierarchy')))).toEqual([LOCAL_A]);
    expect(await names(await search.GET(get('/api/organizations/search?q=Local')))).toEqual([LOCAL_A]);
    expect(await names(await search.GET(get('/api/organizations/search?q=Federation')))).toEqual([]);
    state.userId = 'u-admin-fed';
    expect(await names(await hierarchy.GET(get('/api/organizations/hierarchy')))).toEqual([FED, LOCAL_A, LOCAL_B].sort());
    state.userId = 'nobody';
    expect(await (await hierarchy.GET(get('/api/organizations/hierarchy'))).json()).toMatchObject({ data: [] });
    expect(await (await search.GET(get('/api/organizations/search?q=Local'))).json()).toMatchObject({ data: [] });
    state.userId = 'platform-1';
    state.platformAdmins.add('platform-1');
    expect(await names(await search.GET(get('/api/organizations/search?q=Local')))).toEqual([LOCAL_A, LOCAL_B].sort());
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

  it('lists nothing to a signed-in stranger or a suspended member, and refuses an anonymous caller', async () => {
    for (const user of ['nobody', 'u-suspended-a']) {
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

  it('gives a member the public profile only, and the administrator everything for what they administer', async () => {
    state.userId = 'u-member-a';
    const [asMember] = (await (await listed('/api/organizations?include_stats=true')).json()).data;
    for (const key of ['settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'legacy_org_id', 'email', 'phone', 'address', 'charter_number', 'activeClaims']) {
      expect(asMember, key).not.toHaveProperty(key);
    }
    expect(asMember).toMatchObject({ id: LOCAL_A, childCount: 0 });

    state.userId = 'u-admin-fed';
    const rows = (await (await listed('/api/organizations?include_stats=true')).json()).data as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.id).sort()).toEqual([FED, LOCAL_A, LOCAL_B].sort());
    const local = rows.find((r) => r.id === LOCAL_A);
    expect(local).toMatchObject({ billing_contact_id: '44444444-4444-4444-8444-444444444444', subscription_tier: 'pro', activeClaims: 1 });
  });

  it('shows the federation administrator the locals below, and a platform administrator everything', async () => {
    state.userId = 'platform-1';
    state.platformAdmins.add('platform-1');
    expect(await names(await listed())).toEqual([FED, LOCAL_A, LOCAL_B].sort());
  });

  it('rejects a malformed parent or status filter before any read', async () => {
    state.userId = 'u-admin-fed';
    expect((await listed('/api/organizations?parent=not-a-uuid')).status).toBe(400);
    expect((await listed("/api/organizations?status=active'%20OR%201=1")).status).toBe(400);
  });

  it('confines the tree to what the caller may read, in the legacy mode', async () => {
    const { GET } = await import('../organizations/tree/route');
    state.userId = 'u-member-b';
    expect(await names(await GET(get('/api/organizations/tree')))).toEqual([LOCAL_B]);
    state.userId = 'nobody';
    expect(await (await GET(get('/api/organizations/tree'))).json()).toMatchObject({ data: [] });
    state.userId = 'u-admin-fed';
    expect(await names(await GET(get('/api/organizations/tree')))).toEqual([FED, LOCAL_A, LOCAL_B].sort());
  });
});

describe('analytics', () => {
  it('is refused to a stranger (404) and a plain member (403), and given to an officer and to the administrator above', async () => {
    const { GET } = await import('../organizations/[id]/analytics/route');
    state.userId = 'u-member-b';
    expect((await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).status).toBe(404);
    state.userId = 'u-member-a';
    expect((await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).status).toBe(403);
    state.userId = 'u-officer-a';
    expect((await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).status).toBe(200);
    state.userId = 'u-admin-fed';
    expect((await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).status).toBe(200);
  });

  // DEF-0B9-ORG-ANALYTICS-METRIC-QUERIES-RUN-IN-SESSION-ORGANIZATION-CONTEXT-FILTERED-BY-PATH-ID-RETURNING-ZEROS: the figures are those of the
  // organization in the path whoever reads them, including the administrator of the federation above, whose own organization has none.
  it('reports the figures of the organization in the path to its officer and to the federation administrator above it', async () => {
    const { GET } = await import('../organizations/[id]/analytics/route');
    for (const user of ['u-officer-a', 'u-admin-fed']) {
      state.userId = user;
      const { data } = await (await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).json();
      expect(data, user).toMatchObject({
        organizationId: LOCAL_A,
        totalMembers: 5,
        activeMembers: 4,
        totalClaims: 2,
        activeClaims: 1,
        resolvedClaims: 1,
        childOrganizations: 0,
        claimsByStatus: { filed: 1, closed: 1 },
      });
    }
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

  it('a plain member, a suspended member and a stranger cannot read the roster; a steward can', async () => {
    expect((await rosterGet('u-member-a')).status).toBe(403);
    expect((await rosterGet('u-suspended-a')).status).toBe(403);
    expect((await rosterGet('u-member-b')).status).toBe(403);
    const steward = await rosterGet('u-steward-a');
    expect(steward.status).toBe(200);
    expect((await steward.json()).data.every((r: { organization_id: string }) => r.organization_id === LOCAL_A)).toBe(true);
    expect((await rosterGet('u-admin-fed')).status).toBe(200);
  });

  // DEF-0B9-ORG-ROSTER-GET-INCLUDES-REMOVED-MEMBERS-AND-IS-UNBOUNDED
  it('leaves a removed member off the roster and reads it a page at a time in a stable order', async () => {
    await pg.query(`UPDATE organization_members SET deleted_at = now() WHERE user_id = 'u-member-a'`);
    const { GET } = await import('../organizations/[id]/members/route');
    state.userId = 'u-steward-a';
    const all = (await (await GET(get(`/api/organizations/${LOCAL_A}/members`), params(LOCAL_A))).json()).data as Array<{ user_id: string }>;
    expect(all.map((r) => r.user_id)).not.toContain('u-member-a');
    const first = (await (await GET(get(`/api/organizations/${LOCAL_A}/members?limit=2&page=1`), params(LOCAL_A))).json()).data as Array<{ user_id: string }>;
    const second = (await (await GET(get(`/api/organizations/${LOCAL_A}/members?limit=2&page=2`), params(LOCAL_A))).json()).data as Array<{ user_id: string }>;
    expect(first).toHaveLength(2);
    expect([...first, ...second].map((r) => r.user_id)).toEqual(all.slice(0, first.length + second.length).map((r) => r.user_id));
    expect(new Set([...first, ...second].map((r) => r.user_id)).size).toBe(first.length + second.length);
  });

  const candidate = { user_id: 'new-user', name: 'New Person', email: 'new@x.example' };

  it('a steward may add a member, but only as a pending membership; naming a user id grants no access', async () => {
    const response = await rosterPost('u-steward-a', { ...candidate, role: 'member', status: 'active' });
    expect(response.status).toBe(201);
    const { rows } = await pg.query('SELECT role, status FROM organization_members WHERE user_id = $1', ['new-user']);
    expect(rows).toEqual([{ role: 'member', status: 'pending' }]);
    expect(state.audit).toContainEqual(expect.objectContaining({ action: 'membership.create', details: expect.objectContaining({ status: 'pending' }) }));
  });

  it('no caller may grant a role at or above their own, and nobody grants admin through this route', async () => {
    for (const [user, role] of [['u-steward-a', 'steward'], ['u-steward-a', 'admin'], ['u-steward-a', 'executive'], ['u-officer-a', 'admin'], ['u-admin-a', 'admin']] as const) {
      const response = await rosterPost(user, { ...candidate, role });
      expect(response.status, `${user} -> ${role}`).toBe(403);
    }
    expect((await pg.query('SELECT 1 FROM organization_members WHERE user_id = $1', ['new-user'])).rows).toHaveLength(0);
    expect((await rosterPost('u-admin-a', { ...candidate, role: 'steward' })).status).toBe(201);
  });

  it('a plain member and a stranger cannot add anyone', async () => {
    expect((await rosterPost('u-member-a', { ...candidate, role: 'member' })).status).toBe(403);
    expect((await rosterPost('u-member-b', { ...candidate, role: 'member' })).status).toBe(403);
  });
});

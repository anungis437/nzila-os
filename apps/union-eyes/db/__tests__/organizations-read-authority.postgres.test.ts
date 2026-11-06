/**
 * Native PostgreSQL proof for the organization read routes (list, tree, item, hierarchy, search, children).
 *
 * The routes read `organizations` and `organization_members` as the system role, which is not tenant-scoped, so what a
 * caller sees is decided by lib/organizations/read-authority and not by row-level security. This runs the unmodified route
 * handlers against a database built by Django `migrate` plus the approved Drizzle bootstrap, with each statement executed as
 * `union_eyes_system` or `union_eyes_runtime` through the same ambient-transaction mechanism production uses. It proves the
 * system role holds the privileges those reads need on the real schema, and that a stranger, a sibling and a suspended member
 * read nothing. Issue #1116: authority is direct and specific. The administrator of the federation sees the locals below it as
 * directory entries only (no roster, contacts, member counts, grievance counts or analytics), and a platform title confers nothing.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (see apps/union-eyes/db/__tests__/README.md); skipped when it is not set.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({
  admin: null as unknown,
  pool: null as unknown,
  als: null as unknown,
  userId: 'nobody',
  platformAdmins: new Set<string>(),
  roles: {} as Record<string, string>,
}))

type Tx = ReturnType<typeof drizzle>

async function inRole<T>(role: string, organizationId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = state.pool as pg.Pool
  const als = state.als as AsyncLocalStorage<Tx>
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    if (organizationId) await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId])
    const db = drizzle(client)
    const execute = db.execute.bind(db)
    ;(db as unknown as { execute: unknown }).execute = async (q: never) => (await execute(q)).rows
    const result = await als.run(db, () => fn(db))
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

const ambientDb = () =>
  new Proxy({}, {
    get(_t, prop) {
      const store = (state.als as AsyncLocalStorage<Tx> | null)?.getStore() ?? (state.admin as Tx)
      const value = (store as unknown as Record<PropertyKey, unknown>)[prop]
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(store) : value
    },
  })

vi.mock('@/db/db', () => ({ db: ambientDb() }))
vi.mock('@/db', () => ({ db: ambientDb() }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_system', null, fn as never),
  withRLSContext: async (...args: unknown[]) => {
    const fn = args[args.length - 1] as (tx: unknown) => Promise<unknown>
    const ctx = args.length > 1 ? (args[0] as { organizationId?: string }) : {}
    return inRole('union_eyes_runtime', ctx?.organizationId ?? null, fn as never)
  },
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: state.userId }) }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => false }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: async () => undefined }))
vi.mock('@/lib/api-auth-guard', () => ({
  ROLE_HIERARCHY: { member: 20, steward: 50, officer: 80, admin: 140 },
  auth: async () => ({ userId: state.userId }),
  isPlatformAdminUser: async (id: string) => state.platformAdmins.has(id),
  requireSystemAdmin: async () => {
    throw new Error('Forbidden')
  },
  requireUserForOrganization: async (organizationId: string) => {
    const role = state.roles[`${state.userId}:${organizationId}`]
    if (!role) throw new Error('Forbidden')
    return { userId: state.userId, organizationId, roles: [role] }
  },
}))

describe.skipIf(!URL)('organization read routes on the combined schema, as the system role', () => {
  const FED = randomUUID()
  const LOCAL_A = randomUUID()
  const LOCAL_B = randomUUID()
  const tag = FED.slice(0, 6)
  let admin: pg.Client
  let pool: pg.Pool

  const get = (url: string) => new NextRequest(`http://localhost${url}`)
  const params = (id: string) => ({ params: Promise.resolve({ id }) })
  const ids = async (res: Response) => ((await res.json()).data as Array<{ id: string }>).map((r) => r.id).filter((id) => [FED, LOCAL_A, LOCAL_B].includes(id)).sort()
  const as = (user: string) => {
    state.userId = user
  }
  /** What a caller affiliated only through an organization above must never receive. */
  const PRIVATE_KEYS = [
    'settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'legacy_org_id', 'email', 'phone', 'address', 'charter_number',
    'member_count', 'active_member_count', 'memberCount', 'activeClaims', 'totalClaims', 'description', 'sectors', 'website',
  ]
  const expectDirectoryOnly = (row: Record<string, unknown> | undefined, label: string) => {
    expect(row, label).toBeDefined()
    for (const key of PRIVATE_KEYS) expect(row, `${label}: ${key}`).not.toHaveProperty(key)
  }

  async function org(id: string, name: string, type: string, parent: string | null, path: string[]) {
    await admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, parent_id, hierarchy_path, hierarchy_level, sectors, clc_affiliated,
         member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day, billing_contact_id, subscription_tier)
       VALUES ($1,$2,$3,$4,$5,$6::text[],$7,'{}',false,0,0,'{"perCapitaRate": 9}','{}','active',now(),now(),1,$8,'pro')`,
      [id, `${name}-${tag}`, `${name.toLowerCase()}-${tag}`, type, parent, path, path.length - 1, randomUUID()],
    )
  }
  async function member(user: string, organizationId: string, role: string, status = 'active') {
    await admin.query(
      `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, created_at, updated_at, name, email) VALUES ($1,$2,$3,$4,false,now(),now(),$1,$1 || '@example.test')`,
      [user, organizationId, role, status],
    )
    if (status === 'active') state.roles[`${user}:${organizationId}`] = role
  }

  beforeAll(async () => {
    state.als = new AsyncLocalStorage<Tx>()
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.admin = drizzle(admin)
    state.pool = pool
    await org(FED, 'Federation', 'federation', null, [FED])
    await org(LOCAL_A, 'LocalA', 'local', FED, [FED, LOCAL_A])
    await org(LOCAL_B, 'LocalB', 'local', FED, [FED, LOCAL_B])
    await member('member-a', LOCAL_A, 'member')
    await member('admin-a', LOCAL_A, 'admin')
    await member('admin-fed', FED, 'admin')
    await member('member-b', LOCAL_B, 'member')
    await member('steward-a', LOCAL_A, 'steward')
    await member('officer-a', LOCAL_A, 'officer')
    await member('suspended-a', LOCAL_A, 'member', 'suspended')
    await member('removed-a', LOCAL_A, 'admin')
    await admin.query('UPDATE organization_members SET deleted_at = now() WHERE user_id = $1 AND organization_id = $2', ['removed-a', LOCAL_A])
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await admin?.end()
  })

  it('lists nothing to a stranger or a suspended member, and only their own organization to a member', async () => {
    const { GET } = await import('../../app/api/organizations/route')
    for (const user of ['nobody', 'suspended-a']) {
      as(user)
      expect(await ids(await GET(get('/api/organizations'))), user).toEqual([])
    }
    as('member-b')
    expect(await ids(await GET(get('/api/organizations')))).toEqual([LOCAL_B])
    as('member-a')
    expect(await ids(await GET(get('/api/organizations')))).toEqual([LOCAL_A])
  })

  it('soft-deleted administrator membership confers no organization or descendant visibility', async () => {
    const { GET } = await import('../../app/api/organizations/route')
    const hierarchy = await import('../../app/api/organizations/hierarchy/route')
    const item = await import('../../app/api/organizations/[id]/route')
    as('removed-a')
    expect(await ids(await GET(get('/api/organizations')))).toEqual([])
    expect(await ids(await hierarchy.GET(get('/api/organizations/hierarchy')))).toEqual([])
    expect((await item.GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).status).toBe(404)
  })

  it('gives a member the public profile, the local administrator everything for their own local, and the administrator of the federation directory entries below it', async () => {
    const { GET } = await import('../../app/api/organizations/route')
    as('member-a')
    const [asMember] = (await (await GET(get('/api/organizations'))).json()).data as Array<Record<string, unknown>>
    for (const key of ['settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'email', 'phone', 'address', 'charter_number']) {
      expect(asMember, key).not.toHaveProperty(key)
    }
    as('admin-a')
    const [asAdmin] = (await (await GET(get('/api/organizations?include_stats=true'))).json()).data as Array<Record<string, unknown>>
    expect(asAdmin).toMatchObject({ id: LOCAL_A, subscription_tier: 'pro', activeClaims: 0 })
    as('admin-fed')
    const rows = (await (await GET(get('/api/organizations?include_stats=true'))).json()).data as Array<Record<string, unknown>>
    expect(rows.filter((r) => [FED, LOCAL_A, LOCAL_B].includes(r.id as string)).map((r) => r.id).sort()).toEqual([FED, LOCAL_A, LOCAL_B].sort())
    expectDirectoryOnly(rows.find((r) => r.id === LOCAL_A), 'LOCAL_A')
    expectDirectoryOnly(rows.find((r) => r.id === LOCAL_B), 'LOCAL_B')
    expect(rows.find((r) => r.id === FED)).toMatchObject({ subscription_tier: 'pro' })
  })

  it('a platform title lists no organization', async () => {
    const { GET } = await import('../../app/api/organizations/route')
    state.platformAdmins.add('platform-1')
    as('platform-1')
    expect(await ids(await GET(get('/api/organizations')))).toEqual([])
  })

  it('the tree, hierarchy and search confine a member to their own organization and show the federation administrator the subtree', async () => {
    const tree = await import('../../app/api/organizations/tree/route')
    const hierarchy = await import('../../app/api/organizations/hierarchy/route')
    as('member-b')
    expect(await ids(await tree.GET(get('/api/organizations/tree')))).toEqual([LOCAL_B])
    expect(await ids(await hierarchy.GET(get('/api/organizations/hierarchy')))).toEqual([LOCAL_B])
    as('nobody')
    expect(await ids(await tree.GET(get('/api/organizations/tree')))).toEqual([])
    as('admin-fed')
    expect(await ids(await tree.GET(get('/api/organizations/tree')))).toEqual([FED, LOCAL_A, LOCAL_B].sort())
    const hierarchyRows = (await (await hierarchy.GET(get('/api/organizations/hierarchy'))).json()).data as Array<Record<string, unknown>>
    expectDirectoryOnly(hierarchyRows.find((r) => r.id === LOCAL_A), 'hierarchy LOCAL_A')
    state.platformAdmins.add('platform-1')
    as('platform-1')
    expect(await ids(await tree.GET(get('/api/organizations/tree')))).toEqual([])
    expect(await ids(await hierarchy.GET(get('/api/organizations/hierarchy')))).toEqual([])
  })

  it('the item route answers 404 to a stranger, a sibling and a suspended member, and the profile to a member', async () => {
    const { GET } = await import('../../app/api/organizations/[id]/route')
    for (const user of ['nobody', 'member-b', 'suspended-a']) {
      as(user)
      expect((await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).status, user).toBe(404)
    }
    as('member-a')
    const body = (await (await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).json()).data
    expect(body).toMatchObject({ id: LOCAL_A })
    expect(body).not.toHaveProperty('settings')
    as('admin-a')
    expect((await (await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).json()).data).toMatchObject({ subscription_tier: 'pro' })
    as('admin-fed')
    const asAncestor = await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))
    expect(asAncestor.status).toBe(200)
    const directory = (await asAncestor.json()).data
    expect(Object.keys(directory).sort()).toEqual(
      ['id', 'name', 'slug', 'organization_type', 'parent_id', 'hierarchy_level', 'hierarchy_path', 'status', 'childCount'].sort(),
    )
    state.platformAdmins.add('platform-1')
    as('platform-1')
    expect((await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).status).toBe(404)
    as('admin-a')
    expect((await GET(get(`/api/organizations/${LOCAL_B}`), params(LOCAL_B))).status, 'sibling').toBe(404)
    const unknown = randomUUID()
    expect((await GET(get(`/api/organizations/${unknown}`), params(unknown))).status, 'unknown id').toBe(404)
  })

  it('children and descendants list nothing to a stranger or a sibling, and the subtree to the federation administrator', async () => {
    const children = await import('../../app/api/organizations/[id]/children/route')
    const descendants = await import('../../app/api/organizations/[id]/descendants/route')
    as('member-b')
    expect((await children.GET(get(`/api/organizations/${FED}/children`), params(FED))).status).toBe(404)
    expect((await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED))).status).toBe(404)
    as('admin-fed')
    const childRes = await children.GET(get(`/api/organizations/${FED}/children`), params(FED))
    const childRows = (await childRes.json()).data as Array<Record<string, unknown>>
    expect(childRows.map((r) => r.id).sort()).toEqual([LOCAL_A, LOCAL_B].sort())
    for (const row of childRows) expectDirectoryOnly(row, `child ${row.id}`)
    expect(await ids(await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED)))).toEqual([LOCAL_A, LOCAL_B].sort())
  })

  it('legacy breadcrumb path denies foreign organizations and filters inaccessible ancestors', async () => {
    const { GET } = await import('../../app/api/organizations/[id]/path/route')
    as('member-b')
    expect((await GET(get(`/api/organizations/${LOCAL_A}/path`), params(LOCAL_A))).status).toBe(404)
    as('member-a')
    const memberPath = await GET(get(`/api/organizations/${LOCAL_A}/path`), params(LOCAL_A))
    expect((await memberPath.json()).data.map((row: { id: string }) => row.id)).toEqual([LOCAL_A])
    as('admin-fed')
    const adminPath = await GET(get(`/api/organizations/${LOCAL_A}/path`), params(LOCAL_A))
    expect((await adminPath.json()).data.map((row: { id: string }) => row.id)).toEqual([FED, LOCAL_A])
  })

  it('ancestry denies foreign organizations and only projects authorized ancestors', async () => {
    const { GET } = await import('../../app/api/organizations/[id]/ancestors/route')
    as('member-b')
    expect((await GET(get(`/api/organizations/${LOCAL_A}/ancestors`), params(LOCAL_A))).status).toBe(404)
    as('member-a')
    expect(await ids(await GET(get(`/api/organizations/${LOCAL_A}/ancestors`), params(LOCAL_A)))).toEqual([])
    state.platformAdmins.add('platform-1')
    as('platform-1')
    expect((await GET(get(`/api/organizations/${LOCAL_A}/ancestors`), params(LOCAL_A))).status).toBe(404)
    as('admin-fed')
    expect(await ids(await GET(get(`/api/organizations/${LOCAL_A}/ancestors`), params(LOCAL_A)))).toEqual([FED])
    expect((await GET(get('/api/organizations/not-a-uuid/ancestors'), params('not-a-uuid'))).status).toBe(400)
  })

  it('analytics is given only to the organization\'s own administrator, read under its row-level policy; everyone else reads 404', async () => {
    const { GET } = await import('../../app/api/organizations/[id]/analytics/route')
    state.platformAdmins.add('platform-1')
    for (const [user, status] of [
      ['member-b', 404], ['member-a', 404], ['steward-a', 404], ['officer-a', 404], ['admin-fed', 404], ['platform-1', 404], ['removed-a', 404], ['admin-a', 200],
    ] as const) {
      as(user)
      expect((await GET(get(`/api/organizations/${LOCAL_A}/analytics`), params(LOCAL_A))).status, user).toBe(status)
    }
  })

  describe('roster', () => {
    const rosterGet = async (user: string) => {
      const { GET } = await import('../../app/api/organizations/[id]/members/route')
      as(user)
      return GET(get(`/api/organizations/${LOCAL_A}/members`), params(LOCAL_A))
    }
    const rosterPost = async (user: string, body: Record<string, unknown>) => {
      const { POST } = await import('../../app/api/organizations/[id]/members/route')
      as(user)
      return POST(new NextRequest(`http://localhost/api/organizations/${LOCAL_A}/members`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), params(LOCAL_A))
    }
    const candidate = { user_id: `new-${tag}`, name: 'New Person', email: 'new@example.test' }

    it('only the organization\'s own administrator reads the roster: not a member, steward, officer, administrator above, platform title or removed administrator', async () => {
      state.platformAdmins.add('platform-1')
      for (const user of ['member-a', 'suspended-a', 'member-b', 'steward-a', 'officer-a', 'admin-fed', 'platform-1', 'removed-a']) {
        expect((await rosterGet(user)).status, user).toBe(403)
      }
      const localAdmin = await rosterGet('admin-a')
      expect(localAdmin.status).toBe(200)
      expect(((await localAdmin.json()).data as Array<{ organization_id: string }>).every((r) => r.organization_id === LOCAL_A)).toBe(true)
    })

    it('nobody grants a privileged role, and no one but the organization\'s own administrator adds anyone', async () => {
      for (const role of ['admin', 'executive']) {
        expect((await rosterPost('admin-a', { ...candidate, role })).status, `admin-a -> ${role}`).toBe(403)
      }
      for (const user of ['member-a', 'member-b', 'steward-a', 'officer-a', 'admin-fed', 'platform-1']) {
        expect((await rosterPost(user, { ...candidate, role: 'member' })).status, user).toBe(403)
      }
      expect((await admin.query('SELECT 1 FROM organization_members WHERE user_id = $1', [candidate.user_id])).rows).toHaveLength(0)
    })

    it('the administrator adds a member only as a pending membership, written as the runtime role under the real row-level policy', async () => {
      const response = await rosterPost('admin-a', { ...candidate, role: 'member', status: 'active' })
      expect(response.status).toBe(201)
      const { rows } = await admin.query('SELECT role, status, organization_id FROM organization_members WHERE user_id = $1', [candidate.user_id])
      expect(rows).toEqual([{ role: 'member', status: 'pending', organization_id: LOCAL_A }])
    })
  })
})

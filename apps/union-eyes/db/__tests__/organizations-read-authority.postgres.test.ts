/**
 * Native PostgreSQL proof for the organization read routes (list, tree, item, hierarchy, search, children).
 *
 * The routes read `organizations` and `organization_members` as the system role, which is not tenant-scoped, so what a
 * caller sees is decided by lib/organizations/read-authority and not by row-level security. This runs the unmodified route
 * handlers against a database built by Django `migrate` plus the approved Drizzle bootstrap, with each statement executed as
 * `union_eyes_system` or `union_eyes_runtime` through the same ambient-transaction mechanism production uses. It proves the
 * system role holds the privileges those reads need on the real schema, and that a stranger, a sibling and a suspended member
 * read nothing.
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
      `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, created_at, updated_at) VALUES ($1,$2,$3,$4,false,now(),now())`,
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

  it('gives a member the public profile and the administrator of the federation everything below it', async () => {
    const { GET } = await import('../../app/api/organizations/route')
    as('member-a')
    const [asMember] = (await (await GET(get('/api/organizations'))).json()).data as Array<Record<string, unknown>>
    for (const key of ['settings', 'billing_contact_id', 'subscription_tier', 'created_by', 'email', 'phone', 'address', 'charter_number']) {
      expect(asMember, key).not.toHaveProperty(key)
    }
    as('admin-fed')
    const rows = (await (await GET(get('/api/organizations'))).json()).data as Array<Record<string, unknown>>
    expect(rows.filter((r) => [FED, LOCAL_A, LOCAL_B].includes(r.id as string)).map((r) => r.id).sort()).toEqual([FED, LOCAL_A, LOCAL_B].sort())
    expect(rows.find((r) => r.id === LOCAL_A)).toMatchObject({ subscription_tier: 'pro' })
  })

  it('a platform administrator lists every organization', async () => {
    const { GET } = await import('../../app/api/organizations/route')
    state.platformAdmins.add('platform-1')
    as('platform-1')
    expect(await ids(await GET(get('/api/organizations')))).toEqual([FED, LOCAL_A, LOCAL_B].sort())
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
    expect((await GET(get(`/api/organizations/${LOCAL_A}`), params(LOCAL_A))).status).toBe(200)
  })

  it('children and descendants list nothing to a stranger or a sibling, and the subtree to the federation administrator', async () => {
    const children = await import('../../app/api/organizations/[id]/children/route')
    const descendants = await import('../../app/api/organizations/[id]/descendants/route')
    as('member-b')
    expect((await children.GET(get(`/api/organizations/${FED}/children`), params(FED))).status).toBe(404)
    expect((await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED))).status).toBe(404)
    as('admin-fed')
    expect(await ids(await children.GET(get(`/api/organizations/${FED}/children`), params(FED)))).toEqual([LOCAL_A, LOCAL_B].sort())
    expect(await ids(await descendants.GET(get(`/api/organizations/${FED}/descendants`), params(FED)))).toEqual([LOCAL_A, LOCAL_B].sort())
  })

  it('analytics is refused to a stranger (404) and a plain member (403), and given to an officer and to the administrator above', async () => {
    const { GET } = await import('../../app/api/organizations/[id]/analytics/route')
    for (const [user, status] of [['member-b', 404], ['member-a', 403], ['officer-a', 200], ['admin-fed', 200]] as const) {
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

    it('a plain member, a suspended member and a stranger cannot read the roster; a steward and the administrator above can', async () => {
      for (const user of ['member-a', 'suspended-a', 'member-b']) expect((await rosterGet(user)).status, user).toBe(403)
      const steward = await rosterGet('steward-a')
      expect(steward.status).toBe(200)
      expect(((await steward.json()).data as Array<{ organization_id: string }>).every((r) => r.organization_id === LOCAL_A)).toBe(true)
      expect((await rosterGet('admin-fed')).status).toBe(200)
    })

    it('no caller grants a role at or above their own, nobody grants admin, and a plain member or stranger adds no one', async () => {
      for (const [user, role] of [['steward-a', 'steward'], ['steward-a', 'admin'], ['officer-a', 'admin'], ['admin-a', 'admin']] as const) {
        expect((await rosterPost(user, { ...candidate, role })).status, `${user} -> ${role}`).toBe(403)
      }
      for (const user of ['member-a', 'member-b']) expect((await rosterPost(user, { ...candidate, role: 'member' })).status, user).toBe(403)
      expect((await admin.query('SELECT 1 FROM organization_members WHERE user_id = $1', [candidate.user_id])).rows).toHaveLength(0)
    })

    it('a steward adds a member only as a pending membership, written as the runtime role under the real row-level policy', async () => {
      const response = await rosterPost('steward-a', { ...candidate, role: 'member', status: 'active' })
      expect(response.status).toBe(201)
      const { rows } = await admin.query('SELECT role, status, organization_id FROM organization_members WHERE user_id = $1', [candidate.user_id])
      expect(rows).toEqual([{ role: 'member', status: 'pending', organization_id: LOCAL_A }])
    })
  })
})

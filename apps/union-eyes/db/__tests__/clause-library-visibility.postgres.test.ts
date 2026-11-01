/**
 * F03-B on real PostgreSQL: who may read a shared clause, through the list route and the item rule (lib/clause-library/sharing-authority.ts).
 *
 * DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS. The list, item, tags, compare and search reads used to run on the system role, which holds no
 * privilege on these tables, and the only boundary between organizations was a hand-written predicate. This runs the unmodified list route and the
 * unmodified sharing rule against the combined Django + Drizzle schema as the real roles, over a fixed hierarchy (a federation with two locals,
 * a local outside it, a local in another federation, congress members and a non-member), and proves that
 *   - for every caller and every clause the list returns exactly the clauses the independent expectation names: the owner's own clauses, the clauses
 *     that name the caller in an explicit grant, and the public ones, and nothing else;
 *   - a clause shared at the federation or congress level, or at an unknown or retired level, is read by its owner only, whatever the hierarchy says
 *     (cache 0048 evaluated those levels with SECURITY DEFINER functions that the catalog admission contract refuses, and 0050 retired them);
 *   - the list and the item rule (canReadSharedClause, which guards the item, tags, compare and search reads) agree on every pair, so a clause is
 *     never listed that its own page would refuse;
 *   - the tenant runtime role, which cannot bypass row-level security, reads exactly what the rule allows, with no application predicate (the policy
 *     of cache 0011/0012 is the floor and the rule states the same thing), and a clause's tags follow the clause;
 *   - no ue_clause_* function exists, and the owner's name is read for the clauses the caller may read, on the system role, by id.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ admin: null as unknown, pool: null as unknown, als: null as unknown, schema: null as unknown }))

type Tx = ReturnType<typeof drizzle>

async function inRole<T>(role: string, organizationId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await (state.pool as pg.Pool).connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    if (organizationId) await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId])
    const db = drizzle(client, { schema: state.schema as never })
    const execute = db.execute.bind(db)
    ;(db as unknown as { execute: unknown }).execute = async (q: never) => (await execute(q)).rows
    const result = await (state.als as AsyncLocalStorage<Tx>).run(db, () => fn(db))
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

vi.mock('@/db/db', () => ({
  db: new Proxy({}, {
    get(_t, prop) {
      const store = (state.als as AsyncLocalStorage<Tx> | null)?.getStore() ?? (state.admin as Tx)
      const value = (store as unknown as Record<PropertyKey, unknown>)[prop]
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(store) : value
    },
  }),
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (work: (tx: Tx) => Promise<unknown>) => inRole('union_eyes_system', null, work),
  withRLSContext: (ctx: { organizationId: string }, work: (tx: Tx) => Promise<unknown>) => inRole('union_eyes_runtime', ctx.organizationId, work),
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: async () => undefined }))
vi.mock('@/lib/api/framework', async () => {
  class ApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message)
    }
    static badRequest = (message: string) => new ApiError(400, message)
    static forbidden = (message: string) => new ApiError(403, message)
    static notFound = (message: string) => new ApiError(404, message)
    static conflict = (message: string) => new ApiError(409, message)
    static internal = (message: string) => new ApiError(500, message)
  }
  return { ApiError, withApi: (_config: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx) }
})

const route = URL ? await import('@/app/api/clause-library/route') : null
const sharing = URL ? await import('@/lib/clause-library/sharing-authority') : null

describe.skipIf(!URL)('shared clause visibility on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const O = { fed: randomUUID(), a: randomUUID(), b: randomUUID(), c: randomUUID(), fed2: randomUUID(), d: randomUUID(), congress: randomUUID() }
  const clauseIds: Record<string, string> = {}
  let admin: pg.Client
  let pool: pg.Pool

  const insertOrg = (id: string, name: string, type: string, path: string[], clc: boolean) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,$4,$5::uuid[],$6,'{}',$7,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `cl-${tag}-${id.slice(0, 6)}`, type, path, path.length - 1, clc],
    )
  const insertClause = async (key: string, owner: string, level: string, sharedWith: string[] = []) => {
    const id = randomUUID()
    clauseIds[key] = id
    await admin.query(
      `INSERT INTO shared_clause_library (id, source_organization_id, sharing_level, shared_with_org_ids, clause_title, clause_text, clause_type, created_by, is_anonymized, created_at, updated_at)
       VALUES ($1,$2,$3,$4::uuid[],$5,'Text of the clause','wages','creator',false,now(),now())`,
      [id, owner, level, sharedWith, `${key} ${tag}`],
    )
  }

  beforeAll(async () => {
    state.als = new AsyncLocalStorage<Tx>()
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.pool = pool
    state.schema = await import('@/db/schema')
    state.admin = drizzle(admin, { schema: state.schema as never })
    await insertOrg(O.fed, `Federation ${tag}`, 'federation', [O.fed], false)
    await insertOrg(O.a, `Local A ${tag}`, 'local', [O.fed, O.a], true)
    await insertOrg(O.b, `Local B ${tag}`, 'local', [O.fed, O.b], false)
    await insertOrg(O.c, `Local C ${tag}`, 'local', [O.c], true)
    await insertOrg(O.fed2, `Federation Two ${tag}`, 'federation', [O.fed2], false)
    await insertOrg(O.d, `Local D ${tag}`, 'local', [O.fed2, O.d], true)
    // A and C are active members of a congress; D is CLC-affiliated but holds no membership; B is neither. None of it admits a reader: the
    // federation and congress levels are readable by the owner only.
    for (const org of [O.a, O.c]) {
      await admin.query(`INSERT INTO congress_memberships (id, organization_id, congress_id, status, joined_at, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 'active', now(), now(), now())`, [org, O.congress])
    }
    await insertClause('a-private', O.a, 'private')
    await insertClause('a-private-to-c', O.a, 'private', [O.c])
    await insertClause('a-federation', O.a, 'federation')
    await insertClause('a-congress', O.a, 'congress')
    await insertClause('a-public', O.a, 'public')
    await insertClause('a-retired-level', O.a, 'retired')
    await insertClause('c-congress', O.c, 'congress')
    await insertClause('c-private', O.c, 'private')
    await insertClause('d-federation', O.d, 'federation')
  }, 120_000)

  afterAll(async () => {
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  // The expectation is written out, not derived from the code under test.
  const EXPECTED: Record<string, string[]> = {
    a: ['a-private', 'a-private-to-c', 'a-federation', 'a-congress', 'a-public', 'a-retired-level'],
    b: ['a-public'],
    c: ['a-private-to-c', 'a-public', 'c-congress', 'c-private'],
    d: ['a-public', 'd-federation'],
  }
  const listed = async (org: string) => {
    const out: string[] = []
    for (let page = 1; ; page += 1) {
      const result = (await (route!.GET as unknown as (c: unknown) => Promise<Record<string, any>>)({
        request: new Request(`http://localhost/api/clause-library?limit=100&page=${page}&includeExpired=true`),
        organizationId: org,
      })) as { clauses?: Array<{ id: string }>; data?: Array<{ id: string }> }
      const rows = result.clauses ?? result.data ?? []
      out.push(...rows.map((r) => r.id))
      if (rows.length < 100) return out
    }
  }
  const keysOf = (ids: string[]) => Object.entries(clauseIds).filter(([, id]) => ids.includes(id)).map(([key]) => key).sort()

  it.each(Object.keys(EXPECTED))('the list for organization %s is exactly the clauses it may read', async (name) => {
    const org = O[name as keyof typeof O]
    expect(keysOf(await listed(org))).toEqual([...EXPECTED[name]].sort())
  })

  it('the list and the item rule agree on every caller and clause, so a clause is never listed that its page would refuse', async () => {
    const rows = (await admin.query(`SELECT id::text id, source_organization_id::text source, sharing_level, coalesce(shared_with_org_ids, '{}')::text[] shared FROM shared_clause_library WHERE id = ANY ($1::uuid[])`, [Object.values(clauseIds)])).rows
    for (const name of Object.keys(EXPECTED)) {
      const org = O[name as keyof typeof O]
      const fromList = new Set(await listed(org))
      for (const row of rows) {
        const item = await sharing!.canReadSharedClause(org, { sourceOrganizationId: row.source, sharingLevel: row.sharing_level, sharedWithOrgIds: row.shared })
        expect(fromList.has(row.id), `${name} ${keysOf([row.id])[0]}`).toBe(item)
      }
    }
  })

  it('an organization outside every hierarchy and membership reads only what is public', async () => {
    const stranger = randomUUID()
    await insertOrg(stranger, `Stranger ${tag}`, 'local', [stranger], false)
    expect(keysOf(await listed(stranger))).toEqual(['a-public'])
  })

  it('a federation or congress clause is read by its owner alone, even by an organization of the same federation or a congress member', async () => {
    const { sql } = await import('drizzle-orm')
    const visibleTo = (org: string, key: string) =>
      inRole('union_eyes_runtime', org, async (tx) =>
        ((await (tx as unknown as { execute: (q: unknown) => Promise<Array<{ id: string }>> }).execute(
          sql`SELECT id::text id FROM shared_clause_library WHERE id = ${clauseIds[key]}::uuid`,
        )) as Array<{ id: string }>).length === 1,
      )
    expect(await visibleTo(O.a, 'a-federation')).toBe(true)
    expect(await visibleTo(O.b, 'a-federation')).toBe(false)
    expect(await visibleTo(O.c, 'a-congress')).toBe(false)
    expect(await visibleTo(O.c, 'c-congress')).toBe(true)
    expect(await visibleTo(O.a, 'c-congress')).toBe(false)
    expect(await visibleTo(O.b, 'a-retired-level')).toBe(false)
  })

  it('the tenant runtime role, which cannot bypass row-level security, reads exactly what the rule allows, with no application predicate', async () => {
    const { sql } = await import('drizzle-orm')
    const literal = `{${Object.values(clauseIds).join(',')}}`
    for (const name of Object.keys(EXPECTED)) {
      const org = O[name as keyof typeof O]
      const visible = await inRole('union_eyes_runtime', org, async (tx) =>
        ((await (tx as unknown as { execute: (q: unknown) => Promise<Array<{ id: string }>> }).execute(
          sql`SELECT id::text id FROM shared_clause_library WHERE id = ANY (${literal}::uuid[])`,
        )) as Array<{ id: string }>).map((r) => r.id),
      )
      expect(keysOf(visible), `${name} as a tenant`).toEqual([...EXPECTED[name]].sort())
    }
  })

  it("a clause's tags follow the clause: a granted organization reads the tags of a private clause that names it, and nobody else does", async () => {
    const { sql } = await import('drizzle-orm')
    await admin.query(`INSERT INTO clause_library_tags (id, clause_id, tag_name, created_by, created_at) VALUES (gen_random_uuid(), $1, 'wage-parity', 'creator', now())`, [clauseIds['a-private-to-c']])
    await admin.query(`INSERT INTO clause_library_tags (id, clause_id, tag_name, created_by, created_at) VALUES (gen_random_uuid(), $1, 'federation-only', 'creator', now())`, [clauseIds['a-federation']])
    const tagsFor = (org: string, key: string) =>
      inRole('union_eyes_runtime', org, async (tx) =>
        ((await (tx as unknown as { execute: (q: unknown) => Promise<Array<{ tag_name: string }>> }).execute(
          sql`SELECT tag_name FROM clause_library_tags WHERE clause_id = ${clauseIds[key]}::uuid`,
        )) as Array<{ tag_name: string }>).map((r) => r.tag_name),
      )
    expect(await tagsFor(O.a, 'a-private-to-c')).toEqual(['wage-parity'])
    expect(await tagsFor(O.c, 'a-private-to-c')).toEqual(['wage-parity'])
    expect(await tagsFor(O.b, 'a-private-to-c')).toEqual([])
    expect(await tagsFor(O.d, 'a-private-to-c')).toEqual([])
    expect(await tagsFor(O.a, 'a-federation')).toEqual(['federation-only'])
    expect(await tagsFor(O.b, 'a-federation')).toEqual([])
  })

  it('no ue_clause_* function exists any more, and no SECURITY DEFINER function is executable by a business role', async () => {
    const helpers = await admin.query(`SELECT proname FROM pg_proc WHERE proname LIKE 'ue_clause_%'`)
    expect(helpers.rows).toEqual([])
    const definers = await admin.query(
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef AND n.nspname = 'public'
          AND (has_function_privilege('union_eyes_runtime', p.oid, 'EXECUTE') OR has_function_privilege('union_eyes_system', p.oid, 'EXECUTE') OR has_function_privilege('public', p.oid, 'EXECUTE'))`,
    )
    expect(definers.rows).toEqual([])
  })

  it("the owner's name is read by id on the system role, only for a source the projection may disclose", async () => {
    const names = await sharing!.sourceNamesFor(
      [
        { sourceOrganizationId: O.a, isAnonymized: false },
        { sourceOrganizationId: O.c, isAnonymized: true },
        { sourceOrganizationId: O.d, isAnonymized: null },
      ],
      O.b,
    )
    expect([...names.keys()]).toEqual([O.a])
    expect(names.get(O.a)).toBe(`Local A ${tag}`)
    const own = await sharing!.sourceNamesFor([{ sourceOrganizationId: O.c, isAnonymized: true }], O.c)
    expect(own.get(O.c)).toBe(`Local C ${tag}`)
  })

  it('the share refusal is not stored: a federation or congress level is denied before any write', async () => {
    expect(await sharing!.sharingChangeDenial(O.a, { sharingLevel: 'federation' })).toMatchObject({ status: 403 })
    expect(await sharing!.sharingChangeDenial(O.a, { sharingLevel: 'congress' })).toMatchObject({ status: 403 })
    expect(await sharing!.sharingChangeDenial(O.a, { sharingLevel: 'public' })).toBeNull()
  })
})

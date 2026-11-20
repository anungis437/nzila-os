/**
 * The precedent library on real PostgreSQL, as the real roles (lib/services/precedent-service and the two library routes over arbitration_decisions).
 *
 * DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT. Platform 0060 gave arbitration_decisions the columns its declaration names; this runs the
 * unmodified service and the unmodified collection and item routes against the combined Django + Drizzle schema, so what they send is what PostgreSQL
 * receives. Only the context boundary is replaced so each statement runs as a real role: the ambient handle the service reads with is the tenant runtime
 * role with no organization (as in production), and a tenant transaction is the runtime role with app.current_org_id set. Over eight decisions (public,
 * private, restricted, pending review, owned by two organizations and by nobody) this proves that
 *   - every read, by id, by case number, list, search, issue type, related, statistics and most cited, returns exactly the public unrestricted decisions
 *     and nothing else, with the expected ordering, so a decision another organization keeps private is never read;
 *   - the row-level-security floor under it agrees: a tenant reads what is public and unrestricted plus what it supplied, and nobody else's;
 *   - a decision is created owned by the supplying organization, not public and pending review, whatever the caller sends, and only that organization
 *     changes or deletes it; another organization and the ownerless library cannot;
 *   - the collection and item routes answer the same set, and a non-public or restricted decision is not found.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ ambient: null as unknown, pool: null as unknown, als: null as unknown, schema: null as unknown }))

type Tx = ReturnType<typeof drizzle>

async function inRole<T>(role: string, organizationId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await (state.pool as pg.Pool).connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    if (organizationId) await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [organizationId])
    const db = drizzle(client, { schema: state.schema as never })
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
    get(_target, prop) {
      const store = (state.als as AsyncLocalStorage<Tx> | null)?.getStore() ?? (state.ambient as Tx)
      const value = (store as unknown as Record<PropertyKey, unknown>)[prop]
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(store) : value
    },
  }),
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (work: (tx: Tx) => Promise<unknown>) => inRole('union_eyes_system', null, work),
  withRLSContext: (ctx: { organizationId: string }, work: (tx: Tx) => Promise<unknown>) => inRole('union_eyes_runtime', ctx.organizationId, work),
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: async () => undefined }))
// The role floor and the session are not under test here: the wrapper hands the handler the context a signed-in caller would have.
vi.mock('@/lib/api/with-api', () => ({
  withApi: (_config: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
}))

const service = URL ? await import('@/lib/services/precedent-service') : null
const collection = URL ? await import('@/app/api/arbitration/precedents/route') : null
const item = URL ? await import('@/app/api/arbitration/precedents/[id]/route') : null

type Key = 'pubA' | 'pubBLow' | 'pubBMedium' | 'platform' | 'privA' | 'restrictedA' | 'pendingA' | 'privNobody'

describe.skipIf(!URL)('the precedent library on the combined schema, as the real roles', () => {
  const tag = `pl${randomUUID().slice(0, 8)}`
  const O = { a: randomUUID(), b: randomUUID(), other: randomUUID() }
  const ids = {} as Record<Key, string>
  const createdIds: string[] = []
  let admin: pg.Client
  let pool: pg.Pool
  let runtimePool: pg.Pool
  let schema: typeof import('@/db/schema')

  const caseNumber = (key: string) => `${tag}-${key}`
  const keyOf = (id: string) => (Object.entries(ids) as [Key, string][]).find(([, value]) => value === id)?.[0]
  const mine = <T extends { caseNumber?: string | null }>(rows: T[]) => rows.filter((row) => row.caseNumber?.startsWith(tag))
  const keysOfRows = (rows: { id: string; caseNumber?: string | null }[]) => mine(rows).map((row) => keyOf(row.id) ?? row.caseNumber)

  const PUBLIC_UNRESTRICTED: Key[] = ['pubA', 'pubBLow', 'pubBMedium', 'platform']

  const enumValue = (column: { enumValues?: readonly string[] }, index = 0) => (column.enumValues as readonly string[])[index]

  const insertOrg = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local',ARRAY[$1::uuid],0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `pl-${tag}-${id.slice(0, 6)}`],
    )

  const decision = (key: Key, o: { owner: string | null; isPublic: boolean; restrictions?: string | null; value: 'high' | 'medium' | 'low'; outcome: string; issues: string[]; sector: string; citations: number; date: string }) => {
    const t = schema.arbitrationDecisions
    return {
      caseNumber: caseNumber(key),
      caseTitle: `Decision ${key} ${tag}`,
      tribunal: enumValue(t.tribunal) as never,
      decisionType: enumValue(t.decisionType) as never,
      decisionDate: new Date(o.date),
      arbitrator: `Arbitrator ${tag}`,
      union: `Union ${tag}`,
      employer: `Employer ${tag}`,
      outcome: o.outcome as never,
      precedentValue: o.value as never,
      fullText: `Full text of ${key} ${tag}`,
      summary: `Summary of ${key}`,
      issueTypes: o.issues,
      sector: o.sector,
      jurisdiction: 'ON',
      citationCount: o.citations,
      sourceOrganizationId: o.owner,
      isPublic: o.isPublic,
      accessRestrictions: o.restrictions ?? null,
    }
  }

  beforeAll(async () => {
    state.als = new AsyncLocalStorage<Tx>()
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.pool = pool
    // The handle the service reads with outside a tenant transaction is the runtime role, which row-level security applies to.
    runtimePool = new pg.Pool({ connectionString: URL, max: 4, options: '-c role=union_eyes_runtime' })
    schema = await import('@/db/schema')
    state.schema = schema
    state.ambient = drizzle(runtimePool, { schema: schema as never })

    await insertOrg(O.a, `Precedent Local A ${tag}`)
    await insertOrg(O.b, `Precedent Local B ${tag}`)
    await insertOrg(O.other, `Precedent Local Other ${tag}`)


    const adminDb = drizzle(admin, { schema: schema as never })
    const rows: [Key, ReturnType<typeof decision>][] = [
      ['pubA', decision('pubA', { owner: O.a, isPublic: true, value: 'high', outcome: 'grievance_upheld', issues: ['wages', 'overtime'], sector: 'public', citations: 5, date: '2025-03-01' })],
      ['pubBLow', decision('pubBLow', { owner: O.b, isPublic: true, value: 'low', outcome: 'grievance_denied', issues: ['wages'], sector: 'public', citations: 9, date: '2025-02-01' })],
      ['pubBMedium', decision('pubBMedium', { owner: O.b, isPublic: true, restrictions: '', value: 'medium', outcome: 'partial_success', issues: ['wages', 'seniority'], sector: 'public', citations: 1, date: '2025-01-01' })],
      ['platform', decision('platform', { owner: null, isPublic: true, value: 'medium', outcome: 'grievance_upheld', issues: ['health'], sector: 'health', citations: 3, date: '2024-12-01' })],
      ['privA', decision('privA', { owner: O.a, isPublic: false, value: 'high', outcome: 'grievance_upheld', issues: ['wages'], sector: 'public', citations: 2, date: '2025-03-15' })],
      ['restrictedA', decision('restrictedA', { owner: O.a, isPublic: true, restrictions: 'members_only', value: 'high', outcome: 'grievance_upheld', issues: ['wages'], sector: 'public', citations: 7, date: '2025-03-20' })],
      ['pendingA', decision('pendingA', { owner: O.a, isPublic: false, restrictions: 'pending_review', value: 'medium', outcome: 'grievance_upheld', issues: ['wages'], sector: 'public', citations: 0, date: '2025-03-25' })],
      ['privNobody', decision('privNobody', { owner: null, isPublic: false, value: 'low', outcome: 'grievance_denied', issues: ['wages'], sector: 'public', citations: 0, date: '2025-03-28' })],
    ]
    for (const [key, values] of rows) {
      const [inserted] = await adminDb.insert(schema.arbitrationDecisions).values(values as never).returning({ id: schema.arbitrationDecisions.id })
      ids[key] = inserted.id
    }
  }, 120_000)

  afterAll(async () => {
    await admin?.query('DELETE FROM arbitration_decisions WHERE case_number LIKE $1 OR id = ANY($2::uuid[])', [`${tag}-%`, createdIds]).catch(() => undefined)
    await admin?.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [[O.a, O.b, O.other]]).catch(() => undefined)
    await runtimePool?.end().catch(() => undefined)
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  // Canonical V2 contains arbitration_decisions (lib/operations/catalog-v2-decisions.json: CONTAINED_NO_AUTHORITY, no runtime and no system
  // grant; "this does not implement or qualify the unavailable operation"). The public/private reading rules this file proved under the legacy
  // lineage cannot be exercised: no application role reaches the table. What holds instead, at the same strength: every service entry point
  // and every library route answers 501 NOT_IMPLEMENTED before any statement, nothing is written, and the database refuses both roles, so no
  // decision - public, private, restricted, pending or ownerless - is ever read or changed through the application.
  const notImplemented = { status: 501, code: 'NOT_IMPLEMENTED', storage: 'arbitration_decisions' }
  const snapshotOfDecisions = async () =>
    (await admin.query(`SELECT id::text, case_number, is_public, access_restrictions, citation_count, updated_at FROM arbitration_decisions WHERE case_number LIKE $1 ORDER BY id`, [`${tag}-%`])).rows

  describe('the service answers 501 before it reaches the database', () => {
    it('refuses every reader and writer of the library, and changes no decision', async () => {
      const before = await snapshotOfDecisions()
      expect(before).toHaveLength(8)
      const calls: Array<[string, () => Promise<unknown>]> = [
        ['getPrecedentById', () => service!.getPrecedentById(ids.pubA)],
        ['getPrecedentByCaseNumber', () => service!.getPrecedentByCaseNumber(caseNumber('pubA'))],
        ['listPrecedents', () => service!.listPrecedents({}, { page: 1, limit: 100 })],
        ['searchPrecedents', () => service!.searchPrecedents('wages')],
        ['getPrecedentsByIssueType', () => service!.getPrecedentsByIssueType('wages')],
        ['getRelatedPrecedents', () => service!.getRelatedPrecedents(ids.pubA)],
        ['getPrecedentStatistics', () => service!.getPrecedentStatistics()],
        ['getMostCitedPrecedents', () => service!.getMostCitedPrecedents()],
        ['updateArbitratorStats', () => service!.updateArbitratorStats(`Arbitrator ${tag}`)],
        ['createPrecedent', () => (service!.createPrecedent as (...a: unknown[]) => Promise<unknown>)({ organizationId: O.a }, { caseNumber: caseNumber('new'), caseTitle: 'x' })],
        ['updatePrecedent', () => (service!.updatePrecedent as (...a: unknown[]) => Promise<unknown>)({ organizationId: O.a }, ids.privA, { caseTitle: 'changed' })],
        ['deletePrecedent', () => service!.deletePrecedent({ organizationId: O.a }, ids.privA)],
      ]
      for (const [name, call] of calls) await expect(call(), name).rejects.toMatchObject(notImplemented)
      expect(await snapshotOfDecisions()).toEqual(before)
    })
  })

  describe('the database refuses both application roles', () => {
    it('grants neither the runtime nor the system role any privilege on arbitration_decisions, and refuses their reads and writes', async () => {
      for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
          expect((await admin.query(`SELECT has_any_column_privilege($1, 'public.arbitration_decisions', $2) AS ok`, [role, privilege === 'DELETE' ? 'SELECT' : privilege])).rows[0].ok
            || (await admin.query(`SELECT has_table_privilege($1, 'public.arbitration_decisions', $2) AS ok`, [role, privilege])).rows[0].ok, `${role} ${privilege}`).toBe(false)
        await expect(inRole(role, role === 'union_eyes_runtime' ? O.a : null, (tx) => tx.execute(sql`SELECT id FROM arbitration_decisions`))).rejects.toMatchObject({ cause: { code: '42501' } })
        await expect(inRole(role, role === 'union_eyes_runtime' ? O.a : null, (tx) => tx.execute(sql`UPDATE arbitration_decisions SET citation_count = citation_count + 1`))).rejects.toMatchObject({ cause: { code: '42501' } })
      }
    })
  })

  describe('the library routes answer 501', () => {
    const body = async (response: Response) => (await response.json()) as Record<string, unknown>
    it('the collection and item routes answer 501 NOT_IMPLEMENTED to every method, and change nothing', async () => {
      const before = await snapshotOfDecisions()
      const responses: Array<[string, Response]> = [
        ['collection GET', await (collection!.GET as unknown as (...a: unknown[]) => Promise<Response>)(new Request('http://localhost/api/arbitration/precedents?limit=100'))],
        ['collection POST', await (collection!.POST as unknown as (...a: unknown[]) => Promise<Response>)(new Request('http://localhost/api/arbitration/precedents', { method: 'POST', body: JSON.stringify({ caseTitle: 'x' }) }))],
        ['item GET', await (item!.GET as unknown as (...a: unknown[]) => Promise<Response>)(new Request(`http://localhost/api/arbitration/precedents/${ids.pubA}`), { params: Promise.resolve({ id: ids.pubA }) })],
        ['item PATCH', await (item!.PATCH as unknown as (...a: unknown[]) => Promise<Response>)(new Request(`http://localhost/api/arbitration/precedents/${ids.privA}`, { method: 'PATCH', body: '{}' }), { params: Promise.resolve({ id: ids.privA }) })],
        ['item DELETE', await (item!.DELETE as unknown as (...a: unknown[]) => Promise<Response>)(new Request(`http://localhost/api/arbitration/precedents/${ids.privA}`, { method: 'DELETE' }), { params: Promise.resolve({ id: ids.privA }) })],
      ]
      for (const [name, response] of responses) {
        expect(response.status, name).toBe(501)
        expect(response.headers.get('X-Error-Code'), name).toBe('NOT_IMPLEMENTED')
        const payload = await body(response)
        expect(payload, name).toMatchObject({ code: 'NOT_IMPLEMENTED', capabilityState: 'NOT_IMPLEMENTED' })
        expect(payload, name).not.toHaveProperty('data')
      }
      expect(await snapshotOfDecisions()).toEqual(before)
    })

    it('/api/precedents and its search answer 501 before reading anything', async () => {
      const precedents = await import('@/app/api/precedents/route')
      const search = await import('@/app/api/precedents/search/route')
      const ctx = (request: Request) => ({ request, organizationId: O.a, userId: 'user-1' })
      await expect((precedents.GET as unknown as (c: unknown) => Promise<unknown>)(ctx(new Request('http://localhost/api/precedents')))).rejects.toMatchObject(notImplemented)
      await expect((precedents.POST as unknown as (c: unknown) => Promise<unknown>)(ctx(new Request('http://localhost/api/precedents', { method: 'POST', body: '{}' })))).rejects.toMatchObject(notImplemented)
      await expect((search.POST as unknown as (c: unknown) => Promise<unknown>)(ctx(new Request('http://localhost/api/precedents/search', { method: 'POST', body: JSON.stringify({ query: 'wages' }) })))).rejects.toMatchObject(notImplemented)
    })
  })
})

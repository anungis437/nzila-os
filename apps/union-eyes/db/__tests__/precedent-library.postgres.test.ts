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
import { inArray } from 'drizzle-orm'
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
  let baseline: { total: number; byOutcome: Record<string, number> }

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

    const stats = await service!.getPrecedentStatistics()
    baseline = { total: stats.total, byOutcome: Object.fromEntries(stats.byOutcome.map((row) => [String(row.outcome), row.count])) }

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

  describe('the service reads only public, unrestricted decisions', () => {
    it('returns a decision by id or by case number exactly when it is public and unrestricted, and never its full text unless asked', async () => {
      for (const key of Object.keys(ids) as Key[]) {
        const readable = PUBLIC_UNRESTRICTED.includes(key)
        const byId = await service!.getPrecedentById(ids[key])
        const byCase = await service!.getPrecedentByCaseNumber(caseNumber(key))
        expect(byId?.id ?? null, `${key} by id`).toBe(readable ? ids[key] : null)
        expect(byCase?.id ?? null, `${key} by case number`).toBe(readable ? ids[key] : null)
        if (readable) {
          expect((byId as { fullText?: string }).fullText).toBeUndefined()
          expect((await service!.getPrecedentById(ids[key], { includeFullText: true }))?.fullText).toBe(`Full text of ${key} ${tag}`)
        }
      }
    })

    it('lists exactly the readable decisions, newest first, with the right total, and pages, sorts and filters them', async () => {
      const all = await service!.listPrecedents({ searchQuery: tag })
      expect(all.total).toBe(4)
      expect(keysOfRows(all.precedents)).toEqual(['pubA', 'pubBLow', 'pubBMedium', 'platform'])

      const byCitations = await service!.listPrecedents({ searchQuery: tag }, { sortBy: 'citationCount', sortOrder: 'desc' })
      expect(keysOfRows(byCitations.precedents)).toEqual(['pubBLow', 'pubA', 'platform', 'pubBMedium'])

      const second = await service!.listPrecedents({ searchQuery: tag }, { page: 2, limit: 2 })
      expect(keysOfRows(second.precedents)).toEqual(['pubBMedium', 'platform'])
      expect(second.total).toBe(4)

      expect(keysOfRows((await service!.listPrecedents({ searchQuery: tag, precedentValue: ['high'] })).precedents)).toEqual(['pubA'])
      expect(keysOfRows((await service!.listPrecedents({ searchQuery: tag, sector: 'health' })).precedents)).toEqual(['platform'])
      expect(keysOfRows((await service!.listPrecedents({ searchQuery: tag, dateFrom: new Date('2025-01-15'), dateTo: new Date('2025-02-15') })).precedents)).toEqual(['pubBLow'])
    })

    it('searches only the readable decisions and ranks the most valuable first, then the most cited', async () => {
      const found = await service!.searchPrecedents(tag)
      // high, then medium (the more cited first), then low
      expect(keysOfRows(found)).toEqual(['pubA', 'platform', 'pubBMedium', 'pubBLow'])
      expect(keysOfRows(await service!.searchPrecedents(tag, { precedentValue: ['low'] }))).toEqual(['pubBLow'])
      expect(await service!.searchPrecedents(`${tag}-privA`)).toEqual([])
      expect(await service!.searchPrecedents(`${tag}-restrictedA`)).toEqual([])
    })

    it('finds by issue type only among the readable decisions, most valuable first', async () => {
      const wages = await service!.getPrecedentsByIssueType('wages', 50)
      expect(keysOfRows(wages)).toEqual(['pubA', 'pubBMedium', 'pubBLow'])
    })

    it('finds related decisions among the readable ones that share an issue type and a sector, and none for a decision that is not readable', async () => {
      expect(keysOfRows(await service!.getRelatedPrecedents(ids.pubA))).toEqual(['pubBMedium', 'pubBLow'])
      expect(await service!.getRelatedPrecedents(ids.privA)).toEqual([])
    })

    it('relates nothing to a decision that has no issue type and no sector, instead of every readable decision', async () => {
      const adminDb = drizzle(admin, { schema: schema as never })
      const [bare] = await adminDb
        .insert(schema.arbitrationDecisions)
        .values({ ...decision('pubA', { owner: O.a, isPublic: true, value: 'high', outcome: 'grievance_upheld', issues: [], sector: 'public', citations: 0, date: '2025-05-01' }), caseNumber: caseNumber('bare'), issueTypes: null, sector: null } as never)
        .returning({ id: schema.arbitrationDecisions.id })
      createdIds.push(bare.id)
      try {
        expect(await service!.getRelatedPrecedents(bare.id)).toEqual([])
      } finally {
        await admin.query('DELETE FROM arbitration_decisions WHERE id = $1', [bare.id])
      }
    })

    it('counts and ranks only the readable decisions', async () => {
      const stats = await service!.getPrecedentStatistics()
      expect(stats.total - baseline.total).toBe(4)
      const delta = (outcome: string) => (stats.byOutcome.find((row) => row.outcome === outcome)?.count ?? 0) - (baseline.byOutcome[outcome] ?? 0)
      expect([delta('grievance_upheld'), delta('grievance_denied'), delta('partial_success')]).toEqual([2, 1, 1])

      const cited = await service!.getMostCitedPrecedents(500)
      expect(keysOfRows(cited)).toEqual(['pubBLow', 'pubA', 'platform', 'pubBMedium'])
    })
  })

  describe('row-level security agrees, as the tenant runtime role', () => {
    const visibleTo = async (org: string | null) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SET LOCAL ROLE union_eyes_runtime')
        if (org) await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [org])
        const { rows } = await client.query(`SELECT id::text AS id FROM arbitration_decisions WHERE case_number LIKE $1`, [`${tag}-%`])
        await client.query('ROLLBACK')
        return rows.map((row) => keyOf(row.id)).sort()
      } finally {
        client.release()
      }
    }

    it('shows a tenant what is public and unrestricted and what it supplied, and nobody else\'s', async () => {
      expect(await visibleTo(null)).toEqual([...PUBLIC_UNRESTRICTED].sort())
      expect(await visibleTo(O.a)).toEqual([...PUBLIC_UNRESTRICTED, 'privA', 'restrictedA', 'pendingA'].sort())
      expect(await visibleTo(O.b)).toEqual([...PUBLIC_UNRESTRICTED].sort())
      expect(await visibleTo(O.other)).toEqual([...PUBLIC_UNRESTRICTED].sort())
    })

    it('refuses a tenant a write that is not its own: a row owned by another organization or by nobody, and a change to what it does not own', async () => {
      const codeOf = async (work: () => Promise<unknown>) => {
        try {
          await work()
          return null
        } catch (error) {
          const e = error as { code?: string; cause?: { code?: string } }
          return e.cause?.code ?? e.code ?? 'other'
        }
      }
      const row = (owner: string | null) => ({ ...decision('pubA', { owner, isPublic: false, value: 'high', outcome: 'grievance_upheld', issues: ['wages'], sector: 'public', citations: 0, date: '2025-06-01' }), caseNumber: caseNumber(`rls-${randomUUID().slice(0, 6)}`) })
      for (const owner of [O.b, null]) {
        expect(await codeOf(() => inRole('union_eyes_runtime', O.a, (tx) => tx.insert(schema.arbitrationDecisions).values(row(owner) as never))), `owner ${owner}`).toBe('42501')
      }
      const foreign = [ids.pubBLow, ids.platform]
      const changed = await inRole('union_eyes_runtime', O.a, (tx) =>
        tx.update(schema.arbitrationDecisions).set({ caseTitle: 'Taken over' }).where(inArray(schema.arbitrationDecisions.id, foreign)).returning({ id: schema.arbitrationDecisions.id }),
      )
      const removed = await inRole('union_eyes_runtime', O.a, (tx) =>
        tx.delete(schema.arbitrationDecisions).where(inArray(schema.arbitrationDecisions.id, foreign)).returning({ id: schema.arbitrationDecisions.id }),
      )
      expect([changed, removed]).toEqual([[], []])
    })
  })

  describe('writes belong to the supplying organization', () => {
    const base = () => ({
      caseNumber: `${tag}-created-${randomUUID().slice(0, 6)}`,
      caseTitle: `Created ${tag}`,
      tribunal: enumValue(schema.arbitrationDecisions.tribunal) as never,
      decisionType: enumValue(schema.arbitrationDecisions.decisionType) as never,
      decisionDate: new Date('2025-04-01'),
      arbitrator: `Created ${randomUUID()}`,
      union: `Union ${tag}`,
      employer: `Employer ${tag}`,
      outcome: 'grievance_upheld' as never,
      precedentValue: 'high' as never,
      fullText: 'Created text',
      issueTypes: ['wages'],
    })

    it('creates a decision owned by the supplier, not public and pending review, whatever the caller sends', async () => {
      const created = await service!.createPrecedent({ organizationId: O.a }, { ...base(), isPublic: true, accessRestrictions: '', sourceOrganizationId: O.b } as never)
      createdIds.push(created.id)
      expect(created.sourceOrganizationId).toBe(O.a)
      expect(created.isPublic).toBe(false)
      expect(created.accessRestrictions).toBe('pending_review')
      // not readable through the library until it is reviewed
      expect(await service!.getPrecedentById(created.id)).toBeNull()
    })

    it('lets only the supplier change or delete it', async () => {
      const created = await service!.createPrecedent({ organizationId: O.a }, base() as never)
      createdIds.push(created.id)
      expect(await service!.updatePrecedent({ organizationId: O.b }, created.id, { caseTitle: 'Taken over' })).toBeNull()
      expect(await service!.deletePrecedent({ organizationId: O.b }, created.id)).toBe(false)
      expect((await service!.updatePrecedent({ organizationId: O.a }, created.id, { caseTitle: 'Retitled' }))?.caseTitle).toBe('Retitled')
      const [still] = (await admin.query('SELECT case_title, is_public, source_organization_id FROM arbitration_decisions WHERE id = $1', [created.id])).rows
      expect([still.case_title, still.is_public, still.source_organization_id]).toEqual(['Retitled', false, O.a])
      expect(await service!.deletePrecedent({ organizationId: O.a }, created.id)).toBe(true)
    })

    it('never lets a tenant change or delete a decision nobody owns, or one another organization owns', async () => {
      expect(await service!.updatePrecedent({ organizationId: O.a }, ids.platform, { caseTitle: 'Rewritten' })).toBeNull()
      expect(await service!.deletePrecedent({ organizationId: O.a }, ids.platform)).toBe(false)
      expect(await service!.updatePrecedent({ organizationId: O.a }, ids.pubBLow, { caseTitle: 'Rewritten' })).toBeNull()
      expect(await service!.deletePrecedent({ organizationId: O.a }, ids.pubBLow)).toBe(false)
      const titles = (await admin.query('SELECT case_title FROM arbitration_decisions WHERE id = ANY($1::uuid[])', [[ids.platform, ids.pubBLow]])).rows.map((row) => row.case_title)
      expect(titles.sort()).toEqual([`Decision platform ${tag}`, `Decision pubBLow ${tag}`].sort())
    })
  })

  describe('the library routes answer the same set', () => {
    type Page = { data?: { id: string; caseNumber?: string }[]; items?: { id: string; caseNumber?: string }[] }
    const asCaller = <T>(org: string, work: () => Promise<T>) => inRole('union_eyes_runtime', org, async () => work())
    const listed = async (org: string) => {
      const result = (await asCaller(org, () =>
        (collection!.GET as unknown as (ctx: unknown) => Promise<Page>)({ request: new Request('http://localhost/api/arbitration/precedents?limit=100'), organizationId: org, userId: 'user-1' }),
      )) as Page
      return keysOfRows(((result.data ?? result.items ?? []) as { id: string; caseNumber?: string }[]).map((row) => ({ id: row.id, caseNumber: row.caseNumber })))
    }
    const fetched = (org: string, key: Key) =>
      asCaller(org, () => (item!.GET as unknown as (ctx: unknown) => Promise<{ data: { id: string } }>)({ params: { id: ids[key] }, organizationId: org, userId: 'user-1' }))

    it('lists exactly the public unrestricted decisions to every organization, including the owner of the private ones', async () => {
      for (const org of [O.a, O.b, O.other]) expect(await listed(org), `organization ${org}`).toEqual(expect.arrayContaining(PUBLIC_UNRESTRICTED))
      for (const org of [O.a, O.b, O.other]) {
        const keys = await listed(org)
        expect(keys.filter((key) => !PUBLIC_UNRESTRICTED.includes(key as Key)), `organization ${org}`).toEqual([])
      }
    })

    it('returns a readable decision and reports a private, restricted or pending one as not found, even to its owner', async () => {
      for (const org of [O.a, O.b]) expect((await fetched(org, 'pubA')).data.id).toBe(ids.pubA)
      for (const key of ['privA', 'restrictedA', 'pendingA', 'privNobody'] as Key[]) {
        await expect(fetched(O.a, key), `${key} as its owner`).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND/i) })
        await expect(fetched(O.b, key), `${key} as another organization`).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND/i) })
      }
    })
  })
})

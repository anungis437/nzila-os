/**
 * Clause suggestions on real PostgreSQL, as the real roles (lib/utils/smart-onboarding suggestRelevantClauses).
 *
 * DEF-0B9-ASM-CLAUSE-RELEVANCE-SCORES-SHARING-LEVELS-AND-SOURCE-NAMES-THAT-THE-ROW-LEVEL-POLICIES-WITHHOLD and the anonymization-on-read finding
 * DEF-0B4-CLAUSE-LIBRARY-ANONYMIZATION-NOT-ENFORCED-ON-READ. The function runs unmodified; only the context boundary is replaced so each statement
 * runs as the real role. On the combined Django + Drizzle schema this proves that
 *   - the suggestions are read as the tenant: a clause the policy does not show the organization (another organization's private clause that does
 *     not name it, and a clause at the federation or congress level) is never suggested, and none is ever described by a federation or congress reason;
 *   - an organization that has parents is offered its parents' clauses, the nearest parent first, a clause shared with it above a public one;
 *   - a clause whose source is anonymized or unclassified is never drawn from the parents (that would say where it comes from) and, offered to an
 *     organization without parents, never names its owner;
 *   - an organization is never offered its own clauses, and only the sector and province it asked for.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ pool: null as unknown, schema: null as unknown }))

type Role = 'union_eyes_runtime' | 'union_eyes_system'

async function inRole<T>(role: Role, organizationId: string | null, work: (tx: unknown) => Promise<T>): Promise<T> {
  const client = await (state.pool as pg.Pool).connect()
  try {
    return await drizzle(client, { schema: state.schema as never }).transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
      await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId ?? ''}, true), set_config('app.current_user_id', '', true)`)
      return work(tx)
    })
  } finally {
    client.release()
  }
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (work: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_system', null, work),
  withRLSContext: (ctx: { organizationId: string }, work: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_runtime', ctx.organizationId, work),
}))
vi.mock('@/lib/services/cache-service', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }))

const suggestions = URL ? await import('@/lib/utils/smart-onboarding') : null

const UNDISCLOSED = 'Another organization (source not disclosed)'

describe.skipIf(!URL)('clause suggestions on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const O = { root: randomUUID(), parent: randomUUID(), org: randomUUID(), alone: randomUUID(), peer: randomUUID() }
  const names = { root: `Root Congress ${tag}`, parent: `Parent Federation ${tag}`, org: `Local ${tag}`, alone: `Standalone ${tag}`, peer: `Peer Local ${tag}` }
  const clauseIds: Record<string, string> = {}
  let admin: pg.Client
  let pool: pg.Pool

  const insertOrg = (id: string, name: string, type: string, path: string[]) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, province_territory, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,$4,$5::uuid[],$6,ARRAY['public'],false,0,0,'{}','{}','active','ON',now(),now(),1)`,
      [id, name, `cs-${tag}-${id.slice(0, 6)}`, type, path, path.length - 1],
    )

  const insertClause = async (
    key: string,
    owner: string,
    level: string,
    opts: { grantTo?: string[]; anonymized?: boolean | null; sector?: string; province?: string } = {},
  ) => {
    const id = randomUUID()
    clauseIds[key] = id
    await admin.query(
      `INSERT INTO shared_clause_library (id, source_organization_id, sharing_level, shared_with_org_ids, clause_title, clause_text, clause_type, sector, province, created_by, is_anonymized, created_at, updated_at)
       VALUES ($1,$2,$3,$4::uuid[],$5,'Text of the clause','wages',$6,$7,'creator',$8,now(),now())`,
      [id, owner, level, opts.grantTo ?? [], `${key} ${tag}`, opts.sector ?? 'public', opts.province ?? 'ON', opts.anonymized === undefined ? false : opts.anonymized],
    )
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.pool = pool
    state.schema = await import('@/db/schema')
    await insertOrg(O.root, names.root, 'congress', [O.root])
    await insertOrg(O.parent, names.parent, 'federation', [O.root, O.parent])
    await insertOrg(O.org, names.org, 'local', [O.root, O.parent, O.org])
    await insertOrg(O.alone, names.alone, 'local', [O.alone])
    await insertOrg(O.peer, names.peer, 'local', [O.peer])

    await insertClause('parent-public', O.parent, 'public')
    await insertClause('root-public', O.root, 'public')
    await insertClause('parent-granted', O.parent, 'private', { grantTo: [O.org] })
    await insertClause('parent-private', O.parent, 'private')
    await insertClause('parent-federation', O.parent, 'federation')
    await insertClause('parent-congress', O.parent, 'congress')
    await insertClause('parent-anonymized', O.parent, 'public', { anonymized: true })
    await insertClause('parent-unclassified', O.parent, 'public', { anonymized: null })
    await insertClause('parent-other-sector', O.parent, 'public', { sector: 'health' })
    await insertClause('parent-other-province', O.parent, 'public', { province: 'BC' })
    await insertClause('org-public', O.org, 'public')
    await insertClause('org-federation', O.org, 'federation')
    await insertClause('peer-public', O.peer, 'public')
    await insertClause('peer-anonymized', O.peer, 'public', { anonymized: true })
  }, 120_000)

  afterAll(async () => {
    // Public clauses of this run would be offered to every later run in the same sector and province: remove what this run added.
    await admin?.query('DELETE FROM shared_clause_library WHERE id = ANY($1::uuid[])', [Object.values(clauseIds)]).catch(() => undefined)
    await admin?.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [Object.values(O)]).catch(() => undefined)
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  const keyOf = (id: string) => Object.entries(clauseIds).find(([, v]) => v === id)?.[0]
  const run = async (org: string) => {
    const found = await suggestions!.suggestRelevantClauses(org)
    return found.map((s) => ({ ...s, key: keyOf(s.clauseId) }))
  }

  it('offers an organization with parents their public clauses and the ones shared with it, nearest parent first and a shared one above a public one', async () => {
    const found = await run(O.org)
    expect(found.map((s) => s.key)).toEqual(['parent-granted', 'parent-public', 'root-public'])
    expect(found.map((s) => s.relevanceScore)).toEqual([40 + 2 * 15, 20 + 2 * 15, 20 + 1 * 15])
    expect(found[0].relevanceReasons).toEqual(['Shared with your organization', 'From parent organization'])
    expect(found[1].relevanceReasons).toEqual(['Publicly available', 'From parent organization'])
  })

  it('never suggests what the policy does not show the organization, at any level, and never describes a federation or congress hierarchy', async () => {
    const text = JSON.stringify(await run(O.org))
    for (const hidden of ['parent-private', 'parent-federation', 'parent-congress', 'org-public', 'org-federation', 'peer-public']) {
      expect(text, hidden).not.toContain(clauseIds[hidden])
    }
    expect(text).not.toMatch(/Federation-shared|Congress-level|Same sector|Same province/)
  })

  it('draws no anonymized or unclassified clause from the parents, which would say where it comes from, and only the asked sector and province', async () => {
    const keys = (await run(O.org)).map((s) => s.key)
    for (const withheld of ['parent-anonymized', 'parent-unclassified', 'parent-other-sector', 'parent-other-province']) expect(keys).not.toContain(withheld)
  })

  it('names a source that may be named, and nothing else', async () => {
    const found = await run(O.org)
    expect(found.find((s) => s.key === 'parent-public')!.sourceOrgName).toBe(names.parent)
    expect(found.find((s) => s.key === 'root-public')!.sourceOrgName).toBe(names.root)
  })

  it('offers an organization with no parents every clause it may read, labelling the ones whose source is not disclosed and never naming it', async () => {
    const found = await run(O.alone)
    const keys = found.map((s) => s.key)
    expect(keys.sort()).toEqual(
      ['org-public', 'parent-anonymized', 'parent-public', 'parent-unclassified', 'peer-anonymized', 'peer-public', 'root-public'].sort(),
    )
    for (const withheld of ['parent-anonymized', 'parent-unclassified', 'peer-anonymized']) {
      const entry = found.find((s) => s.key === withheld)!
      expect(entry.sourceOrgName, withheld).toBe(UNDISCLOSED)
      expect(entry.relevanceReasons, withheld).toEqual(['Publicly available'])
    }
    // The owner of an anonymized clause is not named anywhere in what the organization receives for it.
    const anonymizedText = JSON.stringify(found.filter((s) => ['parent-anonymized', 'parent-unclassified', 'peer-anonymized'].includes(s.key!)))
    for (const name of [names.parent, names.peer]) expect(anonymizedText).not.toContain(name)
    expect(found.find((s) => s.key === 'peer-public')!.sourceOrgName).toBe(names.peer)
  })

  it('a clause shared with one organization is not offered to another, and a federation or congress clause is offered to no one', async () => {
    const alone = (await run(O.alone)).map((s) => s.key)
    const peer = (await run(O.peer)).map((s) => s.key)
    for (const keys of [alone, peer]) {
      expect(keys).not.toContain('parent-granted')
      expect(keys).not.toContain('parent-private')
      expect(keys).not.toContain('parent-federation')
      expect(keys).not.toContain('parent-congress')
      expect(keys).not.toContain('org-federation')
    }
    // The organization's own clauses are never suggested back to it, at whatever level they are stored.
    expect(peer).not.toContain('peer-public')
    expect(peer).not.toContain('peer-anonymized')
  })

  it('is read as the tenant: the tenant runtime role is the only role that reads the clause table here', async () => {
    const asSystem = await inRole('union_eyes_system', null, async (tx) => {
      try {
        await (tx as { execute: (q: unknown) => Promise<unknown> }).execute(sql`SELECT count(*) FROM shared_clause_library`)
        return 'read'
      } catch {
        return 'denied'
      }
    })
    expect(asSystem).toBe('denied')
    expect((await run(O.org)).length).toBeGreaterThan(0)
  })
})

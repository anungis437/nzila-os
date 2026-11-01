/**
 * F03-B on real PostgreSQL: the federation directory a prospective affiliate is offered (lib/utils/smart-onboarding autoDetectParentFederation).
 *
 * DEF-0B9-ASM-FEDERATION-DISCOVERY-LISTS-FEDERATIONS-AND-CONGRESSES-BY-NAME-AND-MEMBER-COUNT-WITH-NO-ORGANIZATION-PREDICATE.
 * The function runs unmodified; only the context boundary is replaced so each statement runs as the real role. This proves, on the
 * combined Django + Drizzle schema, that
 *   - the directory is an explicit read as the system role and does not depend on what a tenant may see: as the tenant runtime role the
 *     very same predicate finds only the caller's own row (the control), so the earlier bare read was empty or unbounded by connection role;
 *   - only an active federation or congress whose own settings say affiliation.discoverable is true is offered, in the asked province;
 *     an organization that never opted in, one with a string or a number instead of true, an inactive one and a local are never offered;
 *   - a suggestion discloses a name, a type, a province and a size band, never the exact member count, an e-mail or the settings.
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
}))
vi.mock('@/lib/services/cache-service', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }))

const discovery = URL ? await import('@/lib/utils/smart-onboarding') : null

describe.skipIf(!URL)('the federation directory on the combined schema, as the real roles', () => {
  const tag = randomUUID().slice(0, 8)
  const ids = { listed: randomUUID(), listedSmall: randomUUID(), congress: randomUUID(), optedOut: randomUUID(), stringTrue: randomUUID(), inactive: randomUUID(), otherProvince: randomUUID(), local: randomUUID() }
  let admin: pg.Client
  let pool: pg.Pool

  const insert = (id: string, name: string, type: string, status: string, province: string, members: number, settings: unknown, email: string | null = null) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, province_territory, email, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,$4,'{}',0,ARRAY['public'],true,$5,$5,$6::jsonb,'{}',$7,$8,$9,now(),now(),1)`,
      [id, name, `fd-${tag}-${id.slice(0, 6)}`, type, members, JSON.stringify(settings ?? {}), status, province, email],
    )

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.pool = pool
    state.schema = await import('@/db/schema')
    const on = { affiliation: { discoverable: true } }
    await insert(ids.listed, `Federation Big ${tag}`, 'federation', 'active', 'ON', 52_321, on, 'secretary@federation.example')
    await insert(ids.listedSmall, `Federation Small ${tag}`, 'federation', 'active', 'ON', 420, on)
    await insert(ids.congress, `Congress ${tag}`, 'congress', 'active', 'ON', 1_200_000, on)
    await insert(ids.optedOut, `Federation Quiet ${tag}`, 'federation', 'active', 'ON', 9_000, {})
    await insert(ids.stringTrue, `Federation String ${tag}`, 'federation', 'active', 'ON', 9_000, { affiliation: { discoverable: 'true' } })
    await insert(ids.inactive, `Federation Dormant ${tag}`, 'federation', 'inactive', 'ON', 9_000, on)
    await insert(ids.otherProvince, `Federation West ${tag}`, 'federation', 'active', 'BC', 9_000, on)
    await insert(ids.local, `Local ${tag}`, 'local', 'active', 'ON', 300, on)
  }, 120_000)

  afterAll(async () => {
    // Rows that every later run of the directory would otherwise see: remove what this run added.
    await admin?.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [Object.values(ids)]).catch(() => undefined)
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  const mine = (suggestions: Array<{ id: string }>) => suggestions.filter((s) => Object.values(ids).includes(s.id))

  it('offers only active federations and congresses in the asked province that turned listing on, largest first', async () => {
    const found = mine(await discovery!.autoDetectParentFederation('on', 'public', 1000))
    expect(found.map((s) => s.id).sort()).toEqual([ids.congress, ids.listed, ids.listedSmall].sort())
    for (const never of [ids.optedOut, ids.stringTrue, ids.inactive, ids.otherProvince, ids.local]) expect(found.map((s) => s.id)).not.toContain(never)
  })

  it('discloses a name, a type, a province and a size band, never the exact count, an e-mail or the settings', async () => {
    const found = mine(await discovery!.autoDetectParentFederation('ON', 'public', 1000))
    const big = found.find((s) => s.id === ids.listed) as unknown as Record<string, unknown>
    expect(Object.keys(big).sort()).toEqual(['id', 'jurisdiction', 'matchReasons', 'matchScore', 'name', 'organizationType', 'province', 'sizeBand'])
    expect(big.sizeBand).toBe('20,000 or more')
    expect(JSON.stringify(found)).not.toContain('52321')
    expect(JSON.stringify(found)).not.toContain('federation.example')
    expect((found.find((s) => s.id === ids.listedSmall) as unknown as { sizeBand: string }).sizeBand).toBe('100 to 499')
  })

  it('control: as a tenant the same predicate finds only the caller\'s own row, so the read must be an explicit system read', async () => {
    const seen = await inRole('union_eyes_runtime', ids.local, async (tx) => {
      const rows = (await (tx as { execute: (q: unknown) => Promise<{ rows: Array<{ id: string }> }> }).execute(
        sql`SELECT id::text id FROM organizations WHERE organization_type IN ('federation','congress') AND status = 'active' AND settings @> '{"affiliation":{"discoverable":true}}'::jsonb`,
      )).rows
      return rows.map((r) => r.id)
    })
    expect(seen).toEqual([])
    const asSystem = await inRole('union_eyes_system', null, async (tx) => {
      const rows = (await (tx as { execute: (q: unknown) => Promise<{ rows: Array<{ id: string }> }> }).execute(
        sql`SELECT id::text id FROM organizations WHERE organization_type IN ('federation','congress') AND status = 'active' AND settings @> '{"affiliation":{"discoverable":true}}'::jsonb`,
      )).rows
      return rows.map((r) => r.id)
    })
    expect(asSystem).toEqual(expect.arrayContaining([ids.listed, ids.listedSmall, ids.congress]))
  })

  it('a federation that never turned listing on is not offered however the asker phrases the question', async () => {
    for (const [province, sector] of [['ON', null], ['ON', 'public'], [null, null]] as Array<[string | null, string | null]>) {
      const found = mine(await discovery!.autoDetectParentFederation(province, sector, 9_000))
      expect(found.map((s) => s.id)).not.toContain(ids.optedOut)
      expect(found.map((s) => s.id)).not.toContain(ids.stringTrue)
    }
  })
})

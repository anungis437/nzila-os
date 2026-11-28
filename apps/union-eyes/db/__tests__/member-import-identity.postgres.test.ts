/**
 * Membership import identity reconciliation on real PostgreSQL, as the tenant runtime role under FORCE row-level security
 * (lib/membership/import-memberships.ts, POST /api/members/import, platform 0089).
 *
 * What this holds:
 *   - an imported member is inserted with its external identity; importing it again changes nothing;
 *   - an existing member without an external identity is bound to the offered one, and nothing else about the membership changes;
 *   - an external id already bound to another member, and a member bound to another external id, are reported and change nothing;
 *   - the same external id in another organization is another member, and each organization's session sees only its own;
 *   - two imports racing to bind one external id to two people: exactly one commits, the other raises MembershipImportConflictError and
 *     leaves nothing behind.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'
import { installNativeBusinessContext, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import { seedDeclaredCanonicalActor } from './native-declared-actor'
import { importMemberships, MembershipImportConflictError, type MembershipImportCandidate } from '@/lib/membership/import-memberships'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const SOURCE = 'synthetic-registry'
const IMPORTER = 'member-importer-1'

describe.skipIf(!URL)('membership import identity reconciliation over the real organization_members table', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG = randomUUID()
  const OTHER = randomUUID()
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  type Tx = Parameters<typeof importMemberships>[0]
  let run: <T>(organizationId: string, work: (tx: Tx) => Promise<T>) => Promise<T>

  const person = () => `directory-${randomUUID()}`
  const candidate = (line: number, userId: string, external?: string): MembershipImportCandidate => ({
    line,
    userId,
    name: `Synthetic ${line}`,
    email: `${userId}@members.example.test`,
    ...(external ? { external: { source: SOURCE, id: external } } : {}),
  })
  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows
  const membersOf = (organizationId: string) =>
    rows(`SELECT user_id, external_member_source, external_member_id, name FROM organization_members WHERE organization_id = $1 AND user_id LIKE 'directory-%' ORDER BY user_id`, [organizationId])

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 6, onnotice: () => undefined })
    const db = drizzle(client)
    serializeRawDates(client)
    run = (organizationId, work) =>
      withNativeCanonicalActor(IMPORTER, organizationId, (binding) => db.transaction(async (tx) => {
        await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true), set_config('app.current_user_id', ${IMPORTER}, true)`)
        await installNativeBusinessContext((statement) => tx.execute(statement), binding)
        return work(tx as unknown as Tx)
      }))
    for (const [id, name] of [
      [ORG, 'Identity Fixture Branch'],
      [OTHER, 'Unrelated Fixture Tenant'],
    ]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, name, `idn-${sfx}-${id.slice(0, 6)}`],
      )
      await seedDeclaredCanonicalActor(admin, IMPORTER, id, 'admin')
    }
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  const alice = person()
  const bob = person()

  it('inserts a member with its external identity, and importing it again changes nothing', async () => {
    const first = await run(ORG, (tx) => importMemberships(tx, ORG, [candidate(2, alice, '000123')]))
    expect(first).toEqual({ inserted: 1, bound: 0, unchanged: 0, conflicts: [] })
    const again = await run(ORG, (tx) => importMemberships(tx, ORG, [candidate(2, alice, '000123')]))
    expect(again).toEqual({ inserted: 0, bound: 0, unchanged: 1, conflicts: [] })
    expect(await membersOf(ORG)).toEqual([{ user_id: alice, external_member_source: SOURCE, external_member_id: '000123', name: 'Synthetic 2' }])
  })

  it('binds an existing unbound member to the offered external identity and changes nothing else', async () => {
    await run(ORG, (tx) => importMemberships(tx, ORG, [candidate(3, bob)]))
    const bound = await run(ORG, (tx) => importMemberships(tx, ORG, [{ ...candidate(3, bob, '000456'), name: 'A different name' }]))
    expect(bound).toEqual({ inserted: 0, bound: 1, unchanged: 0, conflicts: [] })
    const row = (await membersOf(ORG)).find((r) => r.user_id === bob)
    expect(row).toEqual({ user_id: bob, external_member_source: SOURCE, external_member_id: '000456', name: 'Synthetic 3' })
  })

  it('reports an external id held by another member, and a member bound to another id, and changes nothing', async () => {
    const before = await membersOf(ORG)
    const carol = person()
    const outcome = await run(ORG, (tx) => importMemberships(tx, ORG, [
      candidate(4, carol, '000123'), // alice holds 000123
      candidate(5, alice, '999999'), // alice is bound to 000123
    ]))
    expect(outcome).toEqual({
      inserted: 0,
      bound: 0,
      unchanged: 0,
      conflicts: [
        { row: 4, reason: 'EXTERNAL_ID_BOUND_TO_OTHER_MEMBER' },
        { row: 5, reason: 'MEMBER_BOUND_TO_OTHER_EXTERNAL_ID' },
      ],
    })
    expect(await membersOf(ORG)).toEqual(before)
  })

  it('treats the same external id in another organization as another member, and each organization sees only its own', async () => {
    const dana = person()
    const theirs = await run(OTHER, (tx) => importMemberships(tx, OTHER, [candidate(2, dana, '000123')]))
    expect(theirs.inserted).toBe(1)
    const seenByOther = await run(OTHER, async (tx) =>
      Array.from(await (tx as unknown as { execute: (q: unknown) => Promise<Iterable<{ organization_id: string }>> }).execute(sql`SELECT organization_id::text FROM organization_members WHERE external_member_id = '000123'`)))
    expect(seenByOther.map((r) => r.organization_id)).toEqual([OTHER])
    // An import into one organization never consults or binds the other's members.
    const mine = await run(ORG, (tx) => importMemberships(tx, ORG, [candidate(6, dana, '000789')]))
    expect(mine).toEqual({ inserted: 1, bound: 0, unchanged: 0, conflicts: [] })
    expect((await membersOf(OTHER)).map((r) => r.external_member_id)).toEqual(['000123'])
  })

  it('lets exactly one of two racing imports bind an external id; the other raises a conflict and leaves nothing', async () => {
    const erin = person()
    const frank = person()
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    // The first import inserts and holds its transaction open; the second has already passed its pre-check and blocks on the unique index until the first commits.
    const first = run(ORG, async (tx) => {
      const outcome = await importMemberships(tx, ORG, [candidate(2, erin, 'RACE-1')])
      await pause(1_500)
      return outcome
    })
    await pause(300)
    const second = run(ORG, (tx) => importMemberships(tx, ORG, [candidate(2, frank, 'RACE-1')]))
    const [a, b] = await Promise.allSettled([first, second])
    expect(a).toMatchObject({ status: 'fulfilled', value: { inserted: 1 } })
    expect(b.status).toBe('rejected')
    expect((b as PromiseRejectedResult).reason).toBeInstanceOf(MembershipImportConflictError)
    const holders = await rows(`SELECT user_id FROM organization_members WHERE organization_id = $1 AND external_member_id = 'RACE-1'`, [ORG])
    expect(holders).toEqual([{ user_id: erin }])
    expect((await rows(`SELECT count(*)::int n FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [ORG, frank]))[0].n).toBe(0)
  }, 60_000)
})

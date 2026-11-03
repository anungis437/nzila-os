/**
 * The organization hierarchy queries on real PostgreSQL (UE-CONV-H-013).
 *
 * db/queries/organization-queries.ts finds an organization's descendants with `hierarchy_path @> ARRAY[id]::uuid[]`, and hierarchy_path is text[]: `text[] @> uuid[]`
 * is not an operator, so getOrganizationDescendants, getOrganizationTree(root) and, through the first, getOrganizationMemberStats failed on the first call. Their
 * integration test replaced drizzle and evaluated `@>` in JavaScript (its own header says it does not replace a live-Postgres test of the operator), so nothing
 * noticed; the mismatch census (scripts/runtime/mismatch-census.ts) found it. This runs the real queries over the real organizations table, as the system role, which
 * reads across organizations (a tenant session reads only its own row under row-level security).
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ run: null as null | (<T>(work: (tx: unknown) => Promise<T>) => Promise<T>) }))

// The queries run in the caller's transaction; the system role is what reads across organizations.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (work: (tx: unknown) => Promise<unknown>) => state.run!(work),
}))

const q = URL ? await import('@/db/queries/organization-queries') : null

describe.skipIf(!URL)('the organization hierarchy queries over the real organizations table', () => {
  const sfx = randomUUID().slice(0, 8)
  const ROOT = randomUUID()
  const MID = randomUUID()
  const LEAF = randomUUID()
  const SIBLING = randomUUID()
  const OTHER_ROOT = randomUUID()
  let admin: pg.Client
  let client: ReturnType<typeof postgres>

  const names = (rows: Array<{ name: string }>) => rows.map((row) => row.name)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 2, onnotice: () => undefined })
    const db = drizzle(client)
    serializeRawDates(client)
    state.run = (work) =>
      db.transaction(async (tx) => {
        await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_system'))
        return work(tx)
      })
    const insert = (id: string, name: string, parent: string | null, path: string[], level: number, members: number, active: number) =>
      admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, parent_id, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local',$4,$5,$6,'{}',false,$7,$8,'{}','{}','active',now(),now(),1)`,
        [id, name, `hier-${sfx}-${id.slice(0, 6)}`, parent, path, level, members, active],
      )
    // hierarchy_path holds the ancestors, root first, and not the organization itself (createOrganization: the parent's path plus the parent's id); a root's is empty.
    await insert(ROOT, `Hier ${sfx} Root`, null, [], 0, 10, 8)
    await insert(MID, `Hier ${sfx} Mid`, ROOT, [ROOT], 1, 20, 15)
    await insert(LEAF, `Hier ${sfx} Leaf`, MID, [ROOT, MID], 2, 30, 25)
    await insert(SIBLING, `Hier ${sfx} Sibling`, ROOT, [ROOT], 1, 40, 35)
    await insert(OTHER_ROOT, `Hier ${sfx} Other root`, null, [], 0, 50, 45)
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('finds every descendant of an organization at every depth, in level and name order, and none of another tree', async () => {
    expect(names(await q!.getOrganizationDescendants(ROOT))).toEqual([`Hier ${sfx} Mid`, `Hier ${sfx} Sibling`, `Hier ${sfx} Leaf`])
    expect((await q!.getOrganizationDescendants(MID)).map((row) => row.id)).toEqual([LEAF])
    expect(await q!.getOrganizationDescendants(LEAF)).toEqual([])
    expect(await q!.getOrganizationDescendants(OTHER_ROOT)).toEqual([])
  })

  it('returns a subtree and the whole tree', async () => {
    expect((await q!.getOrganizationTree(MID)).map((row) => row.id)).toEqual([MID, LEAF])
    expect((await q!.getOrganizationTree(ROOT, 1)).map((row) => row.id).sort()).toEqual([MID, ROOT, SIBLING].sort())
    const whole = (await q!.getOrganizationTree()).map((row) => row.id)
    expect(whole).toEqual(expect.arrayContaining([ROOT, MID, LEAF, SIBLING, OTHER_ROOT]))
  })

  it('lists the children of an organization and the ancestors of one', async () => {
    expect((await q!.getOrganizationChildren(ROOT)).map((row) => row.id).sort()).toEqual([MID, SIBLING].sort())
    expect((await q!.getOrganizationAncestors(LEAF)).map((row) => row.id)).toEqual([ROOT, MID])
  })

  it('totals the members of an organization and its descendants', async () => {
    expect(await q!.getOrganizationMemberStats(ROOT)).toEqual({ totalMembers: 10 + 20 + 30 + 40, activeMembers: 8 + 15 + 25 + 35, descendantOrgs: 3 })
    expect(await q!.getOrganizationMemberStats(MID)).toEqual({ totalMembers: 20 + 30, activeMembers: 15 + 25, descendantOrgs: 1 })
    expect(await q!.getOrganizationMemberStats(MID, false)).toEqual({ totalMembers: 20, activeMembers: 15, descendantOrgs: 0 })
  })
})

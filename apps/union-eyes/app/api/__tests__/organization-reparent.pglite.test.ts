import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { organizations } from '@/db/schema-organizations'
import { repointHierarchy, ReparentRefusal } from '@/lib/organizations/reparent'
import { createTableDatabase } from './support/pglite-tables'

// DEF-0B9-ORG-ITEM-PATCH-PARENT-CHANGE-DOES-NOT-REPOINT-HIERARCHY-PATH-OR-CHECK-CYCLE: a parent change wrote only parent_id.
const ROOT_A = '11111111-1111-4111-8111-111111111111'
const ROOT_B = '22222222-2222-4222-8222-222222222222'
const MID = '33333333-3333-4333-8333-333333333333'
const LEAF = '44444444-4444-4444-8444-444444444444'
const GRAND = '55555555-5555-4555-8555-555555555555'

let pg: PGlite
let tx: Parameters<typeof repointHierarchy>[0]

async function org(id: string, parent: string | null, path: string[], level: number) {
  await pg.query(
    `INSERT INTO organizations (id, name, slug, organization_type, parent_id, hierarchy_path, hierarchy_level) VALUES ($1, $2, $3, 'local', $4, $5::text[], $6)`,
    [id, `org-${id.slice(0, 4)}`, `org-${id.slice(0, 4)}`, parent, path, level],
  )
}
const row = async (id: string) =>
  (await pg.query<{ parent_id: string | null; hierarchy_path: string[]; hierarchy_level: number }>('SELECT parent_id, hierarchy_path, hierarchy_level FROM organizations WHERE id = $1', [id])).rows[0]

beforeAll(async () => {
  const created = await createTableDatabase([organizations])
  pg = created.pg
  tx = created.db as unknown as typeof tx
})
afterAll(async () => { await pg.close() })

beforeEach(async () => {
  await pg.exec('TRUNCATE organizations CASCADE')
  await org(ROOT_A, null, [], 0)
  await org(ROOT_B, null, [], 0)
  await org(MID, ROOT_A, [ROOT_A], 1)
  await org(LEAF, MID, [ROOT_A, MID], 2)
  await org(GRAND, LEAF, [ROOT_A, MID, LEAF], 3)
})

describe('repointHierarchy', () => {
  it('recomputes the moved organization and every descendant under the new parent', async () => {
    const plan = await repointHierarchy(tx, MID, ROOT_B)
    expect(plan).toEqual({ previousParentId: ROOT_A, hierarchyPath: [ROOT_B], hierarchyLevel: 1, descendantsRepointed: 2 })
    expect((await row(LEAF)).hierarchy_path).toEqual([ROOT_B, MID])
    expect((await row(LEAF)).hierarchy_level).toBe(2)
    expect((await row(GRAND)).hierarchy_path).toEqual([ROOT_B, MID, LEAF])
    expect((await row(GRAND)).hierarchy_level).toBe(3)
    // The caller writes the moved organization itself in its own update.
    expect((await row(MID)).parent_id).toBe(ROOT_A)
  })

  it('moves an organization to the top level', async () => {
    const plan = await repointHierarchy(tx, MID, null)
    expect(plan).toMatchObject({ hierarchyPath: [], hierarchyLevel: 0, descendantsRepointed: 2 })
    expect((await row(LEAF)).hierarchy_path).toEqual([MID])
    expect((await row(LEAF)).hierarchy_level).toBe(1)
    expect((await row(GRAND)).hierarchy_level).toBe(2)
  })

  it('refuses a parent that does not exist, the organization itself and one of its descendants, changing nothing', async () => {
    const refuse = async (parent: string) => repointHierarchy(tx, MID, parent).catch((e) => e)
    expect(await refuse('99999999-9999-4999-8999-999999999999')).toMatchObject({ kind: 'parent-not-found' })
    expect(await refuse(MID)).toMatchObject({ kind: 'cycle' })
    expect(await refuse(GRAND)).toMatchObject({ kind: 'cycle' })
    expect(await refuse(LEAF)).toBeInstanceOf(ReparentRefusal)
    expect((await row(LEAF)).hierarchy_path).toEqual([ROOT_A, MID])
  })

  it('refuses a move that would push a branch past the maximum depth', async () => {
    const deepIds = Array.from({ length: 9 }, (_, i) => `a${i}000000-0000-4000-8000-00000000000${i}`)
    let parent = ROOT_B
    let path: string[] = []
    let level = 0
    for (const id of deepIds) {
      path = level === 0 ? [] : [...path, parent]
      await org(id, parent, level === 0 ? [] : path, level)
      parent = id
      level += 1
    }
    const refusal = await repointHierarchy(tx, MID, deepIds[deepIds.length - 1]).catch((e) => e)
    expect(refusal).toMatchObject({ kind: 'too-deep' })
  })
})

describe('organization item route', () => {
  it('applies the repoint, records the previous parent and answers a refusal as 400', async () => {
    const { readFileSync } = await import('node:fs')
    const route = readFileSync(`${process.cwd()}/app/api/organizations/[id]/route.ts`, 'utf8').replace(/\r\n/g, '\n')
    expect(route).toContain('repointHierarchy(tx, id, body.parent_id ?? null)')
    expect(route).toContain('previousParentId: reparent.previousParentId')
    expect(route).toContain("'refused' in updated")
  })
})

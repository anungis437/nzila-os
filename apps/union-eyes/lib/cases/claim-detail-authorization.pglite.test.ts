import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TRIAGE_DESIGNATIONS_DDL, designate } from '@/lib/triage/__tests__/fixture'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { claimDetailQuery } from './claim-detail-query'
import type { CaseActor } from './case-authorization'

// PostgreSQL regression for the single-case read. It executes the exact SQL the claims
// detail endpoint runs, so a change to the read scope cannot silently widen disclosure.
const org = '11111111-1111-4111-8111-111111111111'
const foreignOrg = '22222222-2222-4222-8222-222222222222'
const ids = { own: randomUUID(), other: randomUUID(), assigned: randomUUID(), unassigned: randomUUID(), foreign: randomUUID() }
const number = (name: string) => `CASE-${name.toUpperCase()}`

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(fs.readFileSync(new URL('../../db/queries/__tests__/fixtures/canonical-claim-write.sql', import.meta.url), 'utf8'))
  await pg.exec(TRIAGE_DESIGNATIONS_DDL)
  await pg.exec('CREATE TABLE organization_members (user_id text, organization_id uuid, name text, email text, phone text)')
  db = drizzle(pg)
  const rows: Array<[keyof typeof ids, string, string, string | null]> = [
    ['own', org, 'member-1', null],
    ['other', org, 'member-2', null],
    ['assigned', org, 'member-3', 'steward-1'],
    ['unassigned', org, 'member-3', null],
    ['foreign', foreignOrg, 'member-1', null],
  ]
  for (const [name, orgId, member, assignee] of rows) {
    await pg.query(
      `INSERT INTO claims(id,claim_id,claim_number,created_at,updated_at,organization_id,member_id,assigned_to,description,
        is_anonymous,previously_reported,witnesses_present,priority,progress,status)
       VALUES($1,$2,$3,now(),now(),$4,$5,$6,$7,false,false,false,'medium',0,'submitted')`,
      [randomUUID(), ids[name], number(name), orgId, member, assignee, `private detail of ${name}`],
    )
  }
})
afterAll(async () => { await pg?.close() })

async function read(actor: CaseActor, reference: string) {
  const result = await db.execute(claimDetailQuery(actor, reference))
  return result.rows as Array<Record<string, unknown>>
}
const actor = (userId: string, role: CaseActor['role'], organizationId = org): CaseActor => ({ userId, organizationId, role })

describe('claim detail read scope against PostgreSQL', () => {
  it('lets a member read their own case by claimId and by case number', async () => {
    const member = actor('member-1', 'member')
    expect((await read(member, ids.own))[0]?.claimNumber).toBe(number('own'))
    expect((await read(member, number('own')))[0]?.claimId).toBe(ids.own)
  })

  it.each(['other', 'assigned', 'unassigned'] as const)('denies a member %s member\'s case by both identifiers', async name => {
    const member = actor('member-1', 'member')
    expect(await read(member, ids[name])).toEqual([])
    expect(await read(member, number(name))).toEqual([])
  })

  it('denies cross-organization reads even when the user id matches the owner', async () => {
    const member = actor('member-1', 'member')
    expect(await read(member, ids.foreign)).toEqual([])
    expect(await read(member, number('foreign'))).toEqual([])
    const officer = actor('officer-1', 'officer')
    expect(await read(officer, ids.foreign)).toEqual([])
    expect(await read(officer, number('foreign'))).toEqual([])
  })

  it('restricts a steward to own or assigned cases, not the whole organization', async () => {
    const steward = actor('steward-1', 'steward')
    expect((await read(steward, ids.assigned))[0]?.claimId).toBe(ids.assigned)
    expect((await read(steward, number('assigned')))[0]?.claimId).toBe(ids.assigned)
    for (const name of ['own', 'other', 'unassigned'] as const) {
      expect(await read(steward, ids[name])).toEqual([])
      expect(await read(steward, number(name))).toEqual([])
    }
  })

  it.each(['chief_steward', 'officer', 'admin', 'platform_admin'] as const)('gives %s no tenant-wide read: seniority is not a case relationship', async role => {
    const staff = actor('staff-1', role)
    for (const name of ['own', 'other', 'assigned', 'unassigned'] as const) {
      expect(await read(staff, number(name))).toEqual([])
    }
    expect(await read(staff, number('foreign'))).toEqual([])
  })

  it('lets a live cases designation holder read an unassigned case only, in their own organization', async () => {
    await designate(pg, { organizationId: org, scope: 'cases', userId: 'triager-1' })
    const triager = actor('triager-1', 'chief_steward')
    for (const name of ['own', 'other', 'unassigned'] as const) expect((await read(triager, number(name)))[0]?.claimId).toBe(ids[name])
    // A case that already has an assignee is not part of the unassigned queue, and a foreign case never is.
    expect(await read(triager, number('assigned'))).toEqual([])
    expect(await read(triager, number('foreign'))).toEqual([])
    expect(await read(actor('triager-1', 'chief_steward', foreignOrg), number('unassigned'))).toEqual([])
  })

  it('never returns a row for an empty or unmatched reference', async () => {
    const officer = actor('officer-1', 'officer')
    expect(await read(officer, '')).toEqual([])
    expect(await read(officer, 'CASE-DOES-NOT-EXIST')).toEqual([])
  })
})

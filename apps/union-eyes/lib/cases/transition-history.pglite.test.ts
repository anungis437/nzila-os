import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TRIAGE_DESIGNATIONS_DDL, designate } from '@/lib/triage/__tests__/fixture'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { CaseActor } from './case-authorization'
import { readTransitionHistory } from './transition-history'
import type { RLSTx } from '@/lib/db/with-rls-context'

// PostgreSQL regression for the case status-history read. grievance_transitions has no RLS policy,
// so the case scope and visibility applied here are the only barrier between members.
const org = '11111111-1111-4111-8111-111111111111'
const foreignOrg = '22222222-2222-4222-8222-222222222222'
const ids = { own: randomUUID(), other: randomUUID(), assigned: randomUUID(), foreign: randomUUID() }
const number = (name: string) => `CASE-${name.toUpperCase()}`
const STAFF_ONLY_NOTE = 'STAFF-ONLY-STRATEGY-NOTE'
const MEMBER_NOTE = 'Your case moved to review'
const OTHER_MEMBER_NOTE = 'PRIVATE-OTHER-MEMBER-TRANSITION'

let pg: PGlite
let tx: RLSTx

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(fs.readFileSync(new URL('../../db/queries/__tests__/fixtures/canonical-claim-write.sql', import.meta.url), 'utf8'))
  await pg.exec(TRIAGE_DESIGNATIONS_DDL)
  await pg.exec(`
    CREATE TABLE grievance_transitions (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL, claim_id uuid NOT NULL,
      from_stage_id uuid, to_stage_id uuid NOT NULL, reason text, notes text, transitioned_by text,
      transitioned_at timestamptz DEFAULT now(), visibility_scope text NOT NULL DEFAULT 'staff'
    );`)
  tx = drizzle(pg) as unknown as RLSTx
  const stageA = randomUUID()
  const stageB = randomUUID()
  const rows: Array<[keyof typeof ids, string, string, string | null]> = [
    ['own', org, 'member-1', null],
    ['other', org, 'member-2', null],
    ['assigned', org, 'member-3', 'steward-1'],
    ['foreign', foreignOrg, 'member-1', null],
  ]
  for (const [name, orgId, member, assignee] of rows) {
    await pg.query(
      `INSERT INTO claims(id,claim_id,claim_number,created_at,updated_at,organization_id,member_id,assigned_to,description,
        is_anonymous,previously_reported,witnesses_present,priority,progress,status)
       VALUES($1,$2,$3,now(),now(),$4,$5,$6,$7,false,false,false,'medium',0,'submitted')`,
      [randomUUID(), ids[name], number(name), orgId, member, assignee, `detail of ${name}`],
    )
    const memberNote = name === 'other' ? OTHER_MEMBER_NOTE : MEMBER_NOTE
    await pg.query(
      `INSERT INTO grievance_transitions(id,organization_id,claim_id,from_stage_id,to_stage_id,notes,transitioned_by,visibility_scope)
       VALUES ($1,$2,$3,$4,$5,$6,'steward-secret-id','member'),($7,$2,$3,$4,$5,$8,'steward-secret-id','staff'),($9,$2,$3,$4,$5,'unmarked','steward-secret-id','staff')`,
      [randomUUID(), orgId, ids[name], stageA, stageB, memberNote, randomUUID(), STAFF_ONLY_NOTE, randomUUID()],
    )
  }
})
afterAll(async () => { await pg?.close() })

const actor = (userId: string, role: CaseActor['role'], organizationId = org): CaseActor => ({ userId, organizationId, role })

describe('case status history against PostgreSQL', () => {
  it('shows a member only member-visible transitions on their own case, by claimId and case number', async () => {
    for (const reference of [ids.own, number('own')]) {
      const history = await readTransitionHistory(tx, actor('member-1', 'member'), reference)
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({ notes: MEMBER_NOTE })
      const text = JSON.stringify(history)
      expect(text).not.toContain(STAFF_ONLY_NOTE)
      expect(text).not.toContain('steward-secret-id')
    }
  })

  it.each(['other', 'assigned', 'foreign'] as const)('answers another member\'s or organization\'s case (%s) as not found', async name => {
    for (const reference of [ids[name], number(name)]) {
      await expect(readTransitionHistory(tx, actor('member-1', 'member'), reference)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
  })

  it('does not disclose another member\'s transition content in the denial', async () => {
    const error = await readTransitionHistory(tx, actor('member-1', 'member'), number('other')).catch(e => e)
    const text = JSON.stringify({ message: error.message, code: error.code })
    expect(text).not.toContain(OTHER_MEMBER_NOTE)
    expect(text).not.toContain(number('other'))
  })

  it('lets an assigned steward see member and staff transitions but not an unassigned case', async () => {
    const steward = actor('steward-1', 'steward')
    const history = await readTransitionHistory(tx, steward, number('assigned'))
    expect(history).toHaveLength(3)
    await expect(readTransitionHistory(tx, steward, number('other'))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('gives a chief steward no tenant-wide read: an unassigned case is invisible without a cases designation', async () => {
    const chief = actor('chief-1', 'chief_steward')
    await expect(readTransitionHistory(tx, chief, number('other'))).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await designate(pg, { organizationId: org, scope: 'cases', userId: 'chief-1' })
    expect(await readTransitionHistory(tx, chief, number('other'))).toHaveLength(3)
    await expect(readTransitionHistory(tx, chief, number('assigned'))).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(readTransitionHistory(tx, chief, number('foreign'))).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

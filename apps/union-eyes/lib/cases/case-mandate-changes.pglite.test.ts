import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { claims } from '@/db/schema/claims-schema'

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: vi.fn() }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: vi.fn(), getUserRoleInOrganization: vi.fn() }))
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(), AuditEventType: {}, AuditSeverity: {} }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => true }))
import { caseReadScope, type CaseActor } from './case-authorization'

const org = '11111111-1111-4111-8111-111111111111'
const otherOrg = '22222222-2222-4222-8222-222222222222'
const caseId = randomUUID()

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(fs.readFileSync(new URL('../../db/queries/__tests__/fixtures/canonical-claim-write.sql', import.meta.url), 'utf8'))
  db = drizzle(pg)
  await pg.query(`INSERT INTO claims(id,claim_id,claim_number,created_at,updated_at,organization_id,member_id,assigned_to,
    is_anonymous,previously_reported,witnesses_present,priority,progress,status)
    VALUES($1,$2,'CASE-1',now(),now(),$3,'member-1','steward-a',false,false,false,'medium',0,'submitted')`, [randomUUID(), caseId, org])
})
afterAll(async () => { await pg?.close() })

const actor = (userId: string, role: CaseActor['role'], organizationId = org): CaseActor => ({ userId, organizationId, role })
const readable = async (who: CaseActor) =>
  (await db.select({ id: claims.claimId }).from(claims).where(caseReadScope(who))).map(r => r.id)

describe('mandate changes take effect on the very next read (PostgreSQL)', () => {
  it('lets the assigned steward read, and nobody else at steward level', async () => {
    expect(await readable(actor('steward-a', 'steward'))).toEqual([caseId])
    expect(await readable(actor('steward-b', 'steward'))).toEqual([])
  })

  it('moves access with a reassignment: the previous representative loses it and the new one gains it', async () => {
    await pg.query(`UPDATE claims SET assigned_to='steward-b' WHERE claim_id=$1`, [caseId])
    expect(await readable(actor('steward-a', 'steward'))).toEqual([])
    expect(await readable(actor('steward-b', 'steward'))).toEqual([caseId])
  })

  it('removes the assignment-based access of a representative who is demoted to member', async () => {
    expect(await readable(actor('steward-b', 'member'))).toEqual([])
  })

  it('leaves the filing member with their own case regardless of assignment', async () => {
    expect(await readable(actor('member-1', 'member'))).toEqual([caseId])
  })

  it('does not honour the same user id in another organization (multi-affiliation)', async () => {
    expect(await readable(actor('steward-b', 'steward', otherOrg))).toEqual([])
    expect(await readable(actor('steward-b', 'chief_steward', otherOrg))).toEqual([])
  })

  it('leaves a matter with no assignee unreadable to stewards, so absence of assignment grants nothing', async () => {
    await pg.query(`UPDATE claims SET assigned_to=NULL WHERE claim_id=$1`, [caseId])
    expect(await readable(actor('steward-a', 'steward'))).toEqual([])
    expect(await readable(actor('steward-b', 'steward'))).toEqual([])
    const supervised = await db.execute(sql`SELECT count(*)::int AS n FROM claims c WHERE ${caseReadScope(actor('chief-1', 'chief_steward'), 'c')}`)
    expect(supervised.rows[0].n).toBe(1)
  })
})

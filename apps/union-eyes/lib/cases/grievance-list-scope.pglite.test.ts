import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { and, desc } from 'drizzle-orm'
import { grievances } from '@/db/schema/domains/claims/grievances'
import { GRIEVANCE_TRIAGE_COLUMNS, grievanceCaseAuthorityScope, grievanceTriageScope } from './grievance-list-scope'

const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const steward = '33333333-3333-4333-8333-333333333333'
const other = '44444444-4444-4444-8444-444444444444'
const gid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

let pg: PGlite
let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    CREATE TABLE grievances(id uuid PRIMARY KEY, organization_id uuid NOT NULL, grievance_number text, type text, title text,
      description text, status text, priority text, created_by text, union_rep_id uuid, grievant_name text, grievant_email text,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE ue_authority_resource_relationships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, principal_user_id text NOT NULL,
      resource_type text NOT NULL, resource_id uuid NOT NULL, relation text NOT NULL, status text NOT NULL DEFAULT 'active',
      revoked_at timestamptz, effective_at timestamptz NOT NULL DEFAULT now() - interval '1 minute', expires_at timestamptz
    );
    CREATE TABLE ue_authority_recusals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, principal_user_id text NOT NULL,
      resource_type text NOT NULL, resource_id uuid NOT NULL, lifted_at timestamptz
    );
  `)
  const rows: [number, string, string, string | null, string | null][] = [
    // n, org, status, createdBy, unionRep
    [1, org, 'filed', steward, null],          // created by steward
    [2, org, 'filed', other, steward],          // steward is primary representative
    [3, org, 'filed', other, other],            // collaborator (active)
    [4, org, 'filed', other, other],            // collaborator expired
    [5, org, 'filed', other, other],            // collaborator revoked
    [6, org, 'filed', other, other],            // unrelated case
    [7, org, 'draft', other, null],             // unassigned intake -> triage only
    [8, org, 'draft', other, other],            // assigned intake -> not triage
    [9, foreign, 'filed', steward, steward],    // foreign organization, same user id
    [0, foreign, 'draft', other, null],         // foreign unassigned intake
    [10, org, 'filed', steward, other],         // steward created it, then it was reassigned away
    [11, org, 'filed', other, steward],         // reassigned TO the steward
  ]
  for (const [n, o, status, createdBy, rep] of rows) {
    await pg.query(
      `INSERT INTO grievances(id,organization_id,grievance_number,type,title,description,status,priority,created_by,union_rep_id,grievant_name,grievant_email)
       VALUES($1,$2,$3,'individual','t','private narrative',$4,'high',$5,$6,'Grievant','g@example.test')`,
      [gid(n), o, `G-${n}`, status, createdBy, rep],
    )
  }
  const relate = (n: number, user: string, relation: string, status = 'active', expires: string | null = null, org_ = org) =>
    pg.query(
      `INSERT INTO ue_authority_resource_relationships(organization_id, principal_user_id, resource_type, resource_id, relation, status, revoked_at, expires_at)
       VALUES($1,$2,'case',$3,$4,$5,$6,$7)`,
      [org_, user, gid(n), relation, status, status === 'revoked' ? new Date() : null, expires],
    )
  // The kernel, not the legacy column, names who handles each matter.
  await relate(2, steward, 'assignee')
  await relate(11, steward, 'assignee')
  await relate(10, other, 'assignee')
  await relate(3, steward, 'collaborator')
  await relate(4, steward, 'collaborator', 'active', '2000-01-01')
  await relate(5, steward, 'collaborator', 'revoked')
  await relate(8, other, 'assignee')
  await relate(9, steward, 'assignee', 'active', null, foreign)
  db = drizzle(pg)
})
afterAll(async () => { await pg?.close() })

const numbers = (rows: { grievanceNumber: string | null }[]) => rows.map(r => r.grievanceNumber).sort()

describe('grievance list scope against PostgreSQL', () => {
  it('grants case authority only for authored-while-unassigned matters and live kernel relationships in the actor organization', async () => {
    const rows = await db.select({ grievanceNumber: grievances.grievanceNumber }).from(grievances)
      .where(grievanceCaseAuthorityScope(org, steward))
    expect(numbers(rows)).toEqual(['G-1', 'G-11', 'G-2', 'G-3'])
  })

  it('ends access for a representative who created a matter once it is reassigned, and grants it to the new representative', async () => {
    const rows = await db.select({ grievanceNumber: grievances.grievanceNumber }).from(grievances)
      .where(grievanceCaseAuthorityScope(org, steward))
    expect(numbers(rows)).not.toContain('G-10')
    expect(numbers(rows)).toContain('G-11')
    const previousOwner = await db.select({ grievanceNumber: grievances.grievanceNumber }).from(grievances)
      .where(grievanceCaseAuthorityScope(org, other))
    expect(numbers(previousOwner)).toContain('G-10')
  })

  it('revokes access when a collaborator assignment expires or is revoked, immediately and without a cache', async () => {
    await pg.query(`UPDATE ue_authority_resource_relationships SET status='revoked', revoked_at=now() WHERE resource_id=$1`, [gid(3)])
    const rows = await db.select({ grievanceNumber: grievances.grievanceNumber }).from(grievances)
      .where(grievanceCaseAuthorityScope(org, steward))
    expect(numbers(rows)).not.toContain('G-3')
    await pg.query(`UPDATE ue_authority_resource_relationships SET status='active', revoked_at=NULL WHERE resource_id=$1`, [gid(3)])
  })

  it('does not treat a same-user-id record in another organization as authority', async () => {
    const rows = await db.select({ grievanceNumber: grievances.grievanceNumber }).from(grievances)
      .where(grievanceCaseAuthorityScope(org, steward))
    expect(numbers(rows)).not.toContain('G-9')
  })

  it('shows unassigned draft intakes in this organization only, with minimum metadata', async () => {
    const rows = await db.select(GRIEVANCE_TRIAGE_COLUMNS).from(grievances).where(grievanceTriageScope(org))
    expect(numbers(rows)).toEqual(['G-7'])
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['createdAt', 'grievanceNumber', 'id', 'priority', 'status', 'type', 'updatedAt'])
      expect(row).not.toHaveProperty('description')
      expect(row).not.toHaveProperty('grievantName')
      expect(row).not.toHaveProperty('grievantEmail')
    }
  })

  it('composes with a status filter without widening authority', async () => {
    const rows = await db.select({ grievanceNumber: grievances.grievanceNumber }).from(grievances)
      .where(and(grievanceCaseAuthorityScope(org, steward), grievanceTriageScope(org)))
      .orderBy(desc(grievances.createdAt))
    expect(rows).toEqual([])
  })
})

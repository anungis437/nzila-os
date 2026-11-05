import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { claimDetailQuery } from './claim-detail-query'
import type { CaseActor } from './case-authorization'

// Anonymous filing against real SQL: who still sees the member on an anonymous claim (lib/cases/claim-identity.ts).

const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const member = 'member-1'
const anonymousId = randomUUID()
const namedId = randomUUID()
let pg: PGlite
let db: ReturnType<typeof drizzle>

const as = (userId: string): CaseActor => ({ userId, organizationId: org, role: 'steward' })
const identity = async (userId: string, claimId: string) => {
  const rows = await db.execute(claimDetailQuery(as(userId), claimId))
  const row = (rows as unknown as { rows: Record<string, unknown>[] }).rows[0]
  return { memberId: row.memberId, memberName: row.memberName, memberEmail: row.memberEmail, memberPhone: row.memberPhone, isAnonymous: row.isAnonymous }
}
const relate = (userId: string, claimId: string, relation: string, extra: { status?: string; expires?: string; organizationId?: string } = {}) =>
  pg.query(
    `INSERT INTO ue_authority_resource_relationships(organization_id, principal_user_id, resource_type, resource_id, relation, status, revoked_at, expires_at)
     VALUES($1,$2,'case',$3,$4,$5,$6,$7)`,
    [extra.organizationId ?? org, userId, claimId, relation, extra.status ?? 'active', extra.status === 'revoked' ? new Date() : null, extra.expires ?? null],
  )

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(fs.readFileSync(new URL('../../db/queries/__tests__/fixtures/canonical-claim-write.sql', import.meta.url), 'utf8'))
  await pg.exec(`
    CREATE TABLE ue_authority_resource_relationships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, principal_user_id text NOT NULL,
      resource_type text NOT NULL, resource_id uuid NOT NULL, relation text NOT NULL, status text NOT NULL DEFAULT 'active',
      revoked_at timestamptz, effective_at timestamptz NOT NULL DEFAULT now() - interval '1 minute', expires_at timestamptz
    );
    CREATE TABLE ue_authority_recusals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, principal_user_id text NOT NULL,
      resource_type text NOT NULL, resource_id uuid NOT NULL, lifted_at timestamptz
    );
    CREATE TABLE organization_members (
      user_id text NOT NULL, organization_id uuid NOT NULL, name text, email text, phone text
    );
  `)
  db = drizzle(pg)
  await pg.query(`INSERT INTO organization_members VALUES ($1,$2,'Maria Lopez','maria@example.test','555-0100')`, [member, org])
  for (const [claimId, anonymous] of [[anonymousId, true], [namedId, false]] as const) {
    await pg.query(
      `INSERT INTO claims(id,claim_id,claim_number,created_at,updated_at,organization_id,member_id,is_anonymous,previously_reported,witnesses_present,priority,progress,status)
       VALUES($1,$2,$3,now(),now(),$4,$5,$6,false,false,'medium',0,'submitted')`,
      [randomUUID(), claimId, `CASE-${claimId.slice(0, 4)}`, org, member, anonymous],
    )
  }
  await relate('assignee-1', anonymousId, 'assignee')
  await relate('creator-1', anonymousId, 'creator')
  await relate('owner-1', anonymousId, 'owner')
  await relate('collaborator-1', anonymousId, 'collaborator')
  await relate('collaborator-1', namedId, 'collaborator')
  await relate('recused-1', anonymousId, 'assignee')
  await pg.query(`INSERT INTO ue_authority_recusals(organization_id, principal_user_id, resource_type, resource_id) VALUES($1,'recused-1','case',$2)`, [org, anonymousId])
  await relate('revoked-1', anonymousId, 'assignee', { status: 'revoked' })
  await relate('expired-1', anonymousId, 'assignee', { expires: '2000-01-01' })
  await relate('elsewhere-1', anonymousId, 'assignee', { organizationId: foreign })
})
afterAll(async () => { await pg?.close() })

const shown = { memberId: member, memberName: 'Maria Lopez', memberEmail: 'maria@example.test', memberPhone: '555-0100' }
const hidden = { memberId: null, memberName: null, memberEmail: null, memberPhone: null }

describe('who sees the member on an anonymous claim', () => {
  it.each([['the member who filed it', member], ['its assignee', 'assignee-1'], ['its creator', 'creator-1'], ['its owner', 'owner-1']])(
    'shows the member to %s',
    async (_who, userId) => {
      expect(await identity(userId, anonymousId)).toMatchObject({ ...shown, isAnonymous: true })
    },
  )

  it.each([
    ['a collaborator', 'collaborator-1'],
    ['a recused assignee', 'recused-1'],
    ['a revoked assignee', 'revoked-1'],
    ['an expired assignee', 'expired-1'],
    ['an assignee of the same case id in another organization', 'elsewhere-1'],
    ['someone with no relationship (for example a mandate holder)', 'officer-1'],
  ])('hides the member from %s, and says the claim is anonymous', async (_who, userId) => {
    expect(await identity(userId, anonymousId)).toMatchObject({ ...hidden, isAnonymous: true })
  })

  it('shows the member on a claim that was not filed anonymously', async () => {
    expect(await identity('collaborator-1', namedId)).toMatchObject({ ...shown, isAnonymous: false })
  })

  it('binds the reader as a parameter, never as SQL text', () => {
    const { sql } = (db as unknown as { dialect: { sqlToQuery: (q: unknown) => { sql: string } } }).dialect.sqlToQuery(claimDetailQuery(as("o'brien"), anonymousId))
    expect(sql).not.toContain("o'brien")
  })
})

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/pglite'
import { createRewardsBoundaryFixture } from '@/db/__tests__/rewards-boundary-testkit'
import { compileSecurity } from '@/scripts/bootstrap-v2/security'
const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, operation: (tx: unknown) => Promise<unknown>) =>
    operation(state.db),
}))
import { listRecognitionCandidates } from './page-reads'
let fixture: Awaited<ReturnType<typeof createRewardsBoundaryFixture>>
beforeAll(async () => {
  process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
  fixture = await createRewardsBoundaryFixture()
  const table = fixture.sourcePlan.tables.find((table) => table.name === 'organization_members')
  expect(table).toBeDefined()
  const declarations = fixture.sourcePlan.statements.filter((statement) =>
    /^CREATE TABLE (?:public\.)?"organization_members"\s/.test(statement.sql),
  )
  expect(declarations).toHaveLength(1)
  await fixture.db.exec(declarations[0].sql)
  for (const statement of fixture.sourcePlan.statements.filter((statement) =>
    statement.canonicalId.startsWith('DJANGO_CURRENT_SERVER_DEFAULT:organization_members:'),
  ))
    await fixture.db.exec(statement.sql)
  await fixture.db.exec('ALTER TABLE public.organization_members OWNER TO ue_v2_owner')
  await fixture.db.query(
    "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state) VALUES('stale-member-label','stale@example.invalid',true,'active')",
  )
  for (const [userId, name] of [
    [fixture.actor, 'My name'],
    [fixture.recipient, 'Current colleague'],
    ['foreign-recipient', 'Forged local label'],
    ['stale-member-label', 'Former colleague'],
  ])
    await fixture.db.query(
      `INSERT INTO public.organization_members(id,created_at,updated_at,user_id,organization_id,role,status,is_primary,exempt_from_per_capita,name,email)
      VALUES($1,now(),now(),$2,$3,'member','active',false,false,$4,'private-label@example.invalid')`,
      [randomUUID(), userId, fixture.org, name],
    )
  await fixture.db.exec(
    compileSecurity({ ...fixture.sourcePlan, tables: [table!] }).statements.join('\n'),
  )
  state.db = drizzle(fixture.db)
})
afterAll(async () => {
  delete process.env.UE_CANONICAL_BOOTSTRAP_V2
  await fixture?.db.close()
})
describe('peer picker on actual canonical source facts', () => {
  it('filters forged/stale derived labels through current canonical membership and returns names only', async () => {
    const rows = await fixture.runtime(() => listRecognitionCandidates(fixture.org))
    expect(rows).toEqual([
      { userId: fixture.recipient, name: 'Current colleague' },
      { userId: fixture.actor, name: 'My name' },
    ])
    expect(JSON.stringify(rows)).not.toContain('@')
  })
  it('rereads a membership revocation without a cross-request permission cache', async () => {
    await fixture.db.query(
      'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1',
      [fixture.recipient],
    )
    const rows = await fixture.runtime(() => listRecognitionCandidates(fixture.org))
    expect(rows).toEqual([{ userId: fixture.actor, name: 'My name' }])
  })
  it('returns no labels when the SQL caller has no valid canonical bearer', async () => {
    expect(
      await fixture.runtime(
        () => listRecognitionCandidates(fixture.org),
        fixture.org,
        'invalid-component-bearer',
      ),
    ).toEqual([])
  })
})

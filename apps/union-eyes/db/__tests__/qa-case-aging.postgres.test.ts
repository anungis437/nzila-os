/**
 * The QA clock fixture on real PostgreSQL (scripts/runtime/db-inspect ageQaCase) against the real status-clock trigger of platform 0049.
 *
 * The HTTP and browser acceptance journeys age a QA case before they escalate it, because a case must stay in 'investigation' for a minimum
 * time. Platform 0049 made the clock (claims.status_changed_at) tamper-proof: an update that leaves the status as it is never moves it,
 * whatever the statement sets, so the fixture's plain UPDATE became a silent no-op and both journeys answered 422 with 72 hours remaining.
 *
 * The fixture is now privileged data preparation bound to the owned canonical runtime fixture database alone (scripts/runtime/fixture-auth.ts:
 * the loopback /ue_runtime operator, QA_TEST_ENV and an initialized private state namespace) and records each use there. A native clone is
 * not that database, so this proves the boundary instead of the preparation, at the same strength:
 *   - the control holds: a plain write to the clock is still ignored (the clock stays tamper-proof for every caller);
 *   - the fixture refuses to age a case anywhere but the owned fixture namespace, whatever the case, and the clock, the latest transition and
 *     updated_at do not move; it refuses again on a second attempt;
 *   - the trigger is intact: a real change of status stamps the clock, a plain write straight after is ignored, and no session setting leaks;
 *   - a case outside the QA organization, or a case that does not exist, is refused and nothing changes.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ageQaCase } from '../../scripts/runtime/db-inspect'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const QA_ORG = '11111111-1111-4111-8111-111111111111'

describe.skipIf(!URL)('the QA case aging fixture against the real status clock trigger', () => {
  const previousUrl = process.env.DATABASE_URL
  const tag = randomUUID().slice(0, 8)
  const otherOrg = randomUUID()
  const rowIds: string[] = []
  let createdQaOrg = false
  let admin: pg.Client

  const insertOrg = (id: string, name: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local',ARRAY[$1::uuid],0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, name, `qa-${tag}-${id.slice(0, 6)}`],
    )

  const insertClaim = async (organizationId: string, status: string) => {
    const id = randomUUID()
    const claimId = randomUUID()
    await admin.query(
      `INSERT INTO claims (id, claim_id, organization_id, status, priority, progress, is_anonymous, previously_reported, witnesses_present, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'medium',0,false,false,false,now(),now() - interval '1 hour')`,
      [id, claimId, organizationId, status],
    )
    rowIds.push(id)
    return { id, claimId }
  }

  const hoursAgo = async (sql: string, params: unknown[]) =>
    Number((await admin.query(`SELECT extract(epoch FROM now() - (${sql}))/3600 AS h`, params)).rows[0].h)

  beforeAll(async () => {
    process.env.DATABASE_URL = URL
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    if (!(await admin.query('SELECT 1 FROM organizations WHERE id = $1', [QA_ORG])).rowCount) {
      await insertOrg(QA_ORG, `QA organization ${tag}`)
      createdQaOrg = true
    }
    await insertOrg(otherOrg, `Not a QA organization ${tag}`)
  }, 60_000)

  afterAll(async () => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
    await admin?.query('DELETE FROM claims WHERE id = ANY($1::uuid[])', [rowIds]).catch(() => undefined)
    await admin?.query('DELETE FROM organizations WHERE id = $1', [otherOrg]).catch(() => undefined)
    if (createdQaOrg) await admin?.query('DELETE FROM organizations WHERE id = $1', [QA_ORG]).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('control: a plain write to the clock is still ignored, so no caller can move it', async () => {
    const { id } = await insertClaim(QA_ORG, 'investigation')
    await admin.query(`UPDATE claims SET status_changed_at = now() - interval '72 hours' WHERE id = $1`, [id])
    expect(await hoursAgo(`SELECT status_changed_at FROM claims WHERE id = $1`, [id])).toBeLessThan(0.1)
  })

  // The fixture refuses before it opens any connection: no private state namespace is named here, and this clone is not the owned
  // /ue_runtime fixture database it is bound to.
  const refusedAging = async (claimId: string, hours: number) => {
    const refusal = await ageQaCase(claimId, hours).then(() => null, (error: Error) => error.message)
    expect(refusal).toMatch(/Absolute private runtime state directory required|Explicit owned canonical fixture operator required|Owned loopback fixture operator required/)
  }

  it('refuses to move the clock outside the owned fixture namespace: the clock, the latest transition and updated_at stay', async () => {
    const { id, claimId } = await insertClaim(QA_ORG, 'investigation')
    const before = (await admin.query(`SELECT status_changed_at::text AS c, updated_at::text AS u FROM claims WHERE id = $1`, [id])).rows[0]
    const transition = (await admin.query(`SELECT max(changed_at)::text AS t FROM claim_status_transitions WHERE claim_id = $1`, [id])).rows[0].t
    await refusedAging(claimId, 72)
    expect((await admin.query(`SELECT status_changed_at::text AS c, updated_at::text AS u FROM claims WHERE id = $1`, [id])).rows[0]).toEqual(before)
    expect((await admin.query(`SELECT max(changed_at)::text AS t FROM claim_status_transitions WHERE claim_id = $1`, [id])).rows[0].t).toBe(transition)
  })

  it('leaves the trigger intact: a real change of status stamps the clock, and a plain write straight after is ignored', async () => {
    const { id, claimId } = await insertClaim(QA_ORG, 'assigned')
    await refusedAging(claimId, 100)
    await admin.query(`UPDATE claims SET status = 'investigation' WHERE id = $1`, [id])
    expect(await hoursAgo(`SELECT status_changed_at FROM claims WHERE id = $1`, [id])).toBeLessThan(0.1)
    // The canonical journal (ue_claims_record_status_transition) records a change of status by a verified business-session actor only:
    // these operator writes carry none, so they leave no journal row, while the clock trigger still stamps them.
    const transitions = (await admin.query(`SELECT to_status FROM claim_status_transitions WHERE claim_id = $1 ORDER BY changed_at, to_status`, [id])).rows.map((r) => r.to_status)
    expect(transitions).toEqual([])
    await admin.query(`UPDATE claims SET status_changed_at = now() - interval '50 hours' WHERE id = $1`, [id])
    expect(await hoursAgo(`SELECT status_changed_at FROM claims WHERE id = $1`, [id])).toBeLessThan(0.1)
    expect((await admin.query('SHOW session_replication_role')).rows[0].session_replication_role).toBe('origin')
  })

  it('refuses again after the case moved, as a journey would try before each step that needs time in a status', async () => {
    const { id, claimId } = await insertClaim(QA_ORG, 'assigned')
    await refusedAging(claimId, 72)
    await admin.query(`UPDATE claims SET status = 'investigation' WHERE id = $1`, [id])
    await refusedAging(claimId, 72)
    expect(await hoursAgo(`SELECT status_changed_at FROM claims WHERE id = $1`, [id])).toBeLessThan(0.1)
  })

  it('refuses a case outside the QA organization, and a case that does not exist, and changes nothing', async () => {
    const { id, claimId } = await insertClaim(otherOrg, 'investigation')
    await refusedAging(claimId, 72)
    expect(await hoursAgo(`SELECT status_changed_at FROM claims WHERE id = $1`, [id])).toBeLessThan(0.1)
    await refusedAging(randomUUID(), 72)
  })
})

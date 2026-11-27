import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import type { PGlite } from '@electric-sql/pglite'
import { newUuid, ORG, U, seedMembership } from '@/db/__tests__/authority-kernel-harness'
import { appDrizzle, freshDb, kit } from '@/db/__tests__/authority-kernel-testkit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { automaticallyAssignRepresentative, rankMatchingProfiles } from './automatic-assignment'
import { assignPrimaryRepresentative } from '@/lib/services/case-access-service'
import { declareOwnRecusal } from '@/lib/authority/store/lifecycle'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { loadWorkbenchCases } from './workbench-queue'
import { TRIAGE_DESIGNATIONS_DDL, designate } from '@/lib/triage/__tests__/fixture'

let pg: PGlite
let k: ReturnType<typeof kit>
let people: string[]
let cases: string[]
const actor = { userId: U.officer, organizationId: ORG, role: 'officer' as const }
const as = <T>(userId: string, fn: (tx: RLSTx) => Promise<T>) => appDrizzle(pg).transaction(async tx => {
  await tx.execute(sql`SELECT set_config('app.current_org_id',${ORG},true),set_config('app.current_user_id',${userId},true)`)
  return fn(tx as unknown as RLSTx)
})
const assign = (id = cases[0]!) => as(U.officer, tx => automaticallyAssignRepresentative(tx, actor, id, 'workplace_safety'))
beforeAll(async () => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  pg = await freshDb(); k = kit(pg)
  await k.asAdmin(() => pg.exec(`CREATE TABLE public.organization_members(organization_id uuid,user_id text,name text,email text,phone text,role text,status text DEFAULT 'active',deleted_at timestamptz);
    GRANT SELECT ON public.organization_members TO union_eyes_runtime;
    SELECT ue_create_direct_org_rls_policy('organization_members');`))
  await k.asAdmin(() => pg.exec(`${TRIAGE_DESIGNATIONS_DDL} GRANT SELECT ON triage_designations TO union_eyes_runtime;`))
  await k.adoptDefaultRules(ORG, (domain, operation) => ['case_assignment','supervisory'].includes(domain) && ['issue','revoke'].includes(operation))
})
beforeEach(async () => {
  people = [newUuid(), newUuid()].sort(); cases = [newUuid(), newUuid(), newUuid()]
  await k.asAdmin(async () => {
    await pg.exec('UPDATE public.stewards SET active=false')
    for (const userId of people) {
      await seedMembership(pg, userId, ORG, 'steward')
      await pg.query("INSERT INTO public.organization_members(organization_id,user_id,role) VALUES($1,$2,'steward')", [ORG, userId])
      await pg.query("INSERT INTO public.stewards(org_id,user_id,specialization,max_caseload,current_caseload) VALUES($1,$2,'safety',1,99)", [ORG, userId])
    }
    for (const id of cases) await pg.query("INSERT INTO public.claims(claim_id,organization_id,member_id,claim_type) VALUES($1,$2,$3,'workplace_safety')", [id, ORG, U.member])
  })
  await k.grantMandate('supervisory', U.officer, ['read','assign'], { scope: { resourceIds: cases } })
})
afterAll(async () => { await pg?.close(); vi.unstubAllEnvs() })

describe('automatic matching on actual SQL and the real authority kernel', () => {
  it('persists a governed assignment using recorded expertise and live workload instead of a stale display counter', async () => {
    const result = await assign()
    expect(result.assigneeId).toBe(people[0])
    expect(result.matching).toMatchObject({ exactExpertise: true, openCasesBefore: 0, maxCaseload: 1 })
    const { rows } = await as(U.officer, tx => drizzleExecutor(tx).query('SELECT principal_user_id FROM ue_authority_resource_relationships WHERE resource_id=$1::uuid AND relation=\'assignee\' AND revoked_at IS NULL', [cases[0]]))
    expect(rows.map(row => row.principal_user_id)).toEqual([people[0]])
    expect((await as(U.officer, tx => drizzleExecutor(tx).query('SELECT current_caseload FROM stewards WHERE user_id=$1::uuid', [people[0]]))).rows[0]?.current_caseload).toBe(1)
  })
  it('balances successive cases, refuses full capacity and never replaces an already assigned case on retry', async () => {
    expect((await assign(cases[0])).assigneeId).toBe(people[0])
    expect((await assign(cases[1])).assigneeId).toBe(people[1])
    await expect(assign(cases[2])).rejects.toMatchObject({ code: 'NO_ELIGIBLE_MATCH' })
    await expect(assign(cases[0])).rejects.toMatchObject({ code: 'NO_ELIGIBLE_MATCH' })
    await expect(as(U.officer, tx => assignPrimaryRepresentative(tx, { organizationId: ORG, grievanceId: cases[2]!, issuerUserId: U.officer, assigneeUserId: people[0]! }))).rejects.toMatchObject({ code: 'PRECONDITION' })
  })
  it('skips a recused best match and creates no partial grant for the refused candidate', async () => {
    await k.as(people[0]!)((exec) => declareOwnRecusal(exec, { organizationId: ORG, principalUserId: people[0]!, resourceType: 'case', resourceId: cases[0]!, reason: 'Synthetic conflict' }))
    expect((await assign()).assigneeId).toBe(people[1])
    const { rows } = await as(U.officer, tx => drizzleExecutor(tx).query('SELECT principal_user_id FROM ue_authority_resource_relationships WHERE resource_id=$1::uuid AND revoked_at IS NULL', [cases[0]]))
    expect(rows.map(row => row.principal_user_id)).toEqual([people[1]])
  })
  it('refuses an inactive canonical member even when the public directory still says steward', async () => {
    await k.asAdmin(() => pg.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1', [people[0]]))
    expect((await assign()).assigneeId).toBe(people[1])
  })
  it('rolls back the grant and counter when mandatory audit storage fails', async () => {
    await k.asAdmin(() => pg.exec(`CREATE FUNCTION reject_matching_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'matching audit unavailable'; END $$;
      CREATE TRIGGER reject_matching_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_matching_audit();`))
    try {
      await expect(assign()).rejects.toThrow()
      const { rows } = await as(U.officer, tx => drizzleExecutor(tx).query('SELECT id FROM ue_authority_resource_relationships WHERE resource_id=$1::uuid', [cases[0]]))
      expect(rows).toHaveLength(0)
      expect((await as(U.officer, tx => drizzleExecutor(tx).query('SELECT current_caseload FROM stewards WHERE user_id=$1::uuid', [people[0]]))).rows[0]?.current_caseload).toBe(99)
    } finally { await k.asAdmin(() => pg.exec('DROP TRIGGER reject_matching_audit ON audit_logs; DROP FUNCTION reject_matching_audit()')) }
  })
  it('keeps missing expertise, invalid capacity and ambiguous profiles out of the ranking', () => {
    const profile = { id: 'p', userId: 'u', specialization: 'safety', maxCaseload: 5, openCases: 1 }
    expect(rankMatchingProfiles([profile], null)).toEqual([])
    expect(rankMatchingProfiles([{ ...profile, specialization: null }], 'workplace_safety')).toEqual([])
    expect(rankMatchingProfiles([{ ...profile, maxCaseload: 0 }], 'workplace_safety')).toEqual([])
    expect(rankMatchingProfiles([profile, { ...profile, id: 'duplicate' }], 'workplace_safety')).toEqual([])
  })
  it('connects a supervisor’s unassigned queue to matching without treating a stale mirror as authority', async () => {
    await k.asAdmin(() => pg.query('UPDATE claims SET assigned_to=$2,description=$3 WHERE claim_id=$1::uuid', [cases[0], U.chief, 'Synthetic protected casework']))
    const queue = await as(U.officer, tx => loadWorkbenchCases(tx, actor, null))
    expect(queue.find(row => row.claimId === cases[0])).toMatchObject({ access: 'case', canAssign: true, assignedTo: null, description: 'Synthetic protected casework', canAddNote: false, canTransition: false, canClose: false })
    const chief = { userId: U.chief, organizationId: ORG, role: 'chief_steward' as const }
    expect(await as(U.chief, tx => loadWorkbenchCases(tx, chief, null))).toEqual([])
    await assign()
    const after = await as(U.officer, tx => loadWorkbenchCases(tx, actor, null))
    expect(after.find(row => row.claimId === cases[0])).toMatchObject({ assignedTo: people[0], canAssign: false })
  })
  it('returns only triage metadata to a designated steward who lacks case content and assignment authority', async () => {
    await k.asAdmin(async () => {
      await pg.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'steward')", [ORG,U.steward])
      await designate(pg, { organizationId: ORG, userId: U.steward, scope: 'cases' })
    })
    const rows = await as(U.steward, tx => loadWorkbenchCases(tx, { userId: U.steward, organizationId: ORG, role: 'steward' }, null))
    const row = rows.find(item => item.claimId === cases[0])
    expect(row).toMatchObject({ access: 'triage', canAssign: false })
    for (const field of ['description','memberId','memberName','memberEmail','memberPhone']) expect(row).not.toHaveProperty(field)
  })

  it('never automatically assigns a closed case', async () => {
    await k.asAdmin(() => pg.query("UPDATE claims SET status='closed' WHERE claim_id=$1::uuid", [cases[0]]))
    await expect(assign()).rejects.toMatchObject({ code: 'NO_ELIGIBLE_MATCH' })
    expect((await k.asAdmin(() => pg.query('SELECT id FROM ue_authority_resource_relationships WHERE resource_id=$1::uuid', [cases[0]]))).rows).toHaveLength(0)
  })

})

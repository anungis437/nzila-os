import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import type { PGlite } from '@electric-sql/pglite'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { auditLogs } from '@/db/schema/domains/infrastructure/audit'
import { newUuid, ORG, ORG_B, seedMembership, U } from '@/db/__tests__/authority-kernel-harness'
import { appDrizzle, freshDb, kit } from '@/db/__tests__/authority-kernel-testkit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { saveAssignmentProfile } from './assignment-profiles'
import { automaticallyAssignRepresentative } from './automatic-assignment'

let pg: PGlite
let k: ReturnType<typeof kit>
let person: string
let caseId: string
const admin = 'synthetic-profile-admin'
const as = <T>(userId: string, fn: (tx: RLSTx) => Promise<T>, organizationId = ORG) => appDrizzle(pg).transaction(async tx => {
  await tx.execute(sql`SELECT set_config('app.current_org_id',${organizationId},true),set_config('app.current_user_id',${userId},true)`)
  return fn(tx as unknown as RLSTx)
})
const save = (extra = {}, userId = admin, org = ORG) => as(userId, tx => saveAssignmentProfile(tx, { userId, organizationId: org }, {
  userId: person, specialization: 'safety', maxCaseload: 5, active: true, ...extra,
}), org)
beforeAll(async () => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  pg = await freshDb(); k = kit(pg)
  await k.asAdmin(async () => {
    await seedMembership(pg, admin, ORG, 'admin')
    await pg.exec(`CREATE TABLE public.organization_members(organization_id uuid,user_id text,role text,status text DEFAULT 'active',deleted_at timestamptz);
      GRANT SELECT ON public.organization_members TO union_eyes_runtime;
      SELECT ue_create_direct_org_rls_policy('organization_members'); CREATE SCHEMA audit_security;`)
    for (const ddl of await generateMigration(generateDrizzleJson({}), generateDrizzleJson({ auditLogs }))) await pg.exec(ddl)
    await pg.exec(`GRANT USAGE ON SCHEMA audit_security TO union_eyes_runtime;
      GRANT INSERT,SELECT ON audit_security.audit_logs TO union_eyes_runtime;`)
  })
  await k.adoptDefaultRules(ORG, (domain, operation) => ['case_assignment','supervisory'].includes(domain) && ['issue','revoke'].includes(operation))
})
beforeEach(async () => {
  person = newUuid(); caseId = newUuid()
  await k.asAdmin(async () => {
    await pg.exec('UPDATE public.stewards SET active=false')
    await seedMembership(pg, person, ORG, 'steward')
    await pg.query("INSERT INTO public.organization_members(organization_id,user_id,role) VALUES($1,$2,'steward')", [ORG,person])
    await pg.query("INSERT INTO public.claims(claim_id,organization_id,member_id,claim_type) VALUES($1,$2,$3,'workplace_safety')", [caseId,ORG,U.member])
  })
  await k.grantMandate('supervisory', U.officer, ['read','assign'], { scope: { resourceIds: [caseId] } })
})
afterAll(async () => { await pg?.close(); vi.unstubAllEnvs() })

describe('matching profile persistence and limits on real SQL', () => {
  it('persists a profile and its mandatory audit, then uses it for an actual governed match', async () => {
    const profile = await save()
    expect(profile).toMatchObject({ userId: person, specialization: 'safety', maxCaseload: 5, openCases: 0 })
    const audit = await k.asAdmin(() => pg.query('SELECT metadata FROM audit_security.audit_logs WHERE resource_id=$1::uuid', [profile.id]))
    expect(audit.rows[0]?.metadata).toMatchObject({ representativeUserId: person, specialization: 'safety', active: true })
    const matched = await as(U.officer, tx => automaticallyAssignRepresentative(tx, { userId: U.officer, organizationId: ORG }, caseId, 'workplace_safety'))
    expect(matched.assigneeId).toBe(person)
    const updated = await save({ maxCaseload: 3 })
    expect(updated.id).toBe(profile.id); expect(updated.openCases).toBe(1)
  })
  it('refuses non-admin and foreign administration, without creating a profile', async () => {
    await expect(save({}, U.officer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(save({}, admin, ORG_B)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await k.asAdmin(() => pg.query('SELECT id FROM stewards WHERE user_id=$1::uuid', [person]))).rows).toHaveLength(0)
  })
  it('refuses an ineligible recipient, then permits retiring an existing profile after membership removal', async () => {
    await save()
    await k.asAdmin(() => pg.query("UPDATE public.organization_members SET status='inactive' WHERE user_id=$1", [person]))
    await expect(save()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await save({ active: false })).toMatchObject({ active: false })
    await expect(as(U.officer, tx => automaticallyAssignRepresentative(tx, { userId: U.officer, organizationId: ORG }, caseId, 'workplace_safety'))).rejects.toMatchObject({ code: 'NO_ELIGIBLE_MATCH' })
  })
  it('rolls back a profile change if mandatory audit storage refuses the write', async () => {
    const profile = await save()
    await k.asAdmin(() => pg.exec(`CREATE FUNCTION refuse_profile_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit storage unavailable'; END $$;
      CREATE TRIGGER refuse_profile_audit BEFORE INSERT ON audit_security.audit_logs FOR EACH ROW EXECUTE FUNCTION refuse_profile_audit();`))
    try {
      await expect(save({ maxCaseload: 2 })).rejects.toThrow()
      expect((await k.asAdmin(() => pg.query('SELECT max_caseload FROM stewards WHERE id=$1::uuid', [profile.id]))).rows[0]?.max_caseload).toBe(5)
    } finally { await k.asAdmin(() => pg.exec('DROP TRIGGER refuse_profile_audit ON audit_security.audit_logs; DROP FUNCTION refuse_profile_audit()')) }
  })
})

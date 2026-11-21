/** Disposable SQL-engine guard isolation only. The test org policy supplies
 * positive RLS prerequisites; this is not canonical bearer/native proof and
 * never activates a WorkAid institutional capability or provider. */
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema/domains/ml/authority-kernel'
import { storageAuthorityManifest } from '../rls-storage-authority'
import { AUTHORITY_PHYSICAL_GUARDS as contract } from './authority-physical-guards'
import { inspectPhysicalGuards, planPhysicalGuards } from './physical-guard-catalog'
import { reconcileCurrentDeclarationAuthority } from '../../scripts/bootstrap-v2/current-authority'
import { auditAuthorityMutation } from '../../lib/authority/store/audit'

async function fixture() {
  const pg = new PGlite(), org = randomUUID()
  await pg.exec('CREATE ROLE ue_v2_owner;CREATE ROLE union_eyes_runtime;CREATE ROLE union_eyes_system;GRANT CREATE ON SCHEMA public TO ue_v2_owner;SET ROLE ue_v2_owner;')
  const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
  for (const sql of [...ddl.filter(s => !s.startsWith('ALTER TABLE')), ...ddl.filter(s => s.startsWith('ALTER TABLE'))]) await pg.exec(sql)
  for (const table of contract.tables) {
    await pg.exec(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`)
    const original = storageAuthorityManifest.find(row => row.table === table)!
    const authority = reconcileCurrentDeclarationAuthority({ name: table, source: 'apps/union-eyes/db/schema/domains/ml/authority-kernel.ts' }, original)!
    const operations = authority.requiredRuntimePrivileges
    if (operations === 'TBD') throw new Error('Unresolved current authority cannot qualify a fixture')
    if (operations.length) await pg.exec(`GRANT ${operations.join(',')} ON public.${table} TO union_eyes_runtime;`)
    await pg.exec(`CREATE POLICY test_component_org ON public.${table} FOR ALL TO union_eyes_runtime USING(organization_id::text=current_setting('app.current_org_id',true)) WITH CHECK(organization_id::text=current_setting('app.current_org_id',true));`)
  }
  await pg.exec('RESET ROLE;CREATE TABLE audit_logs(id uuid PRIMARY KEY,audit_id uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,organization_id uuid,action varchar(100),resource_type varchar(255),resource_id varchar(255),user_id varchar(255),ip_address inet,user_agent text,correlation_id uuid,details jsonb DEFAULT \'{}\'::jsonb,changes jsonb DEFAULT \'{}\'::jsonb,content_hash varchar(64),previous_hash varchar(64));GRANT SELECT ON audit_logs TO union_eyes_runtime;SET ROLE ue_v2_owner;')
  const execute = async (sql: string) => (await pg.query(sql)).rows as Record<string, unknown>[]
  for (const sql of planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute)).statements) await pg.exec(sql)
  expect(planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute)).statements).toEqual([])
  await pg.exec('RESET ROLE')
  const act = async (sql: string, params: unknown[] = []) => {
    await pg.exec('BEGIN;SET LOCAL ROLE union_eyes_runtime;')
    try {
      await pg.query("SELECT set_config('app.current_org_id',$1,true),set_config('app.current_user_id','actor',true)", [org])
      const result = await pg.query(sql, params)
      await pg.exec('COMMIT')
      return result.rows
    } catch (error) { await pg.exec('ROLLBACK'); throw error }
  }
  // Trusted historical prerequisites, recorded through the real audit helper.
  // These rows do not issue an institutional rule, member consent or grant.
  const seedHistory = async (sql: string, params: unknown[]) => {
    await pg.exec('BEGIN')
    try {
      await pg.query("SELECT set_config('app.current_org_id',$1,true),set_config('app.current_user_id','actor',true)", [org])
      await pg.query(sql, params)
      await auditAuthorityMutation(pg, { organizationId: org, action: 'qa.retained_history_fixture', resourceType: 'authority-qa' })
      await pg.exec('COMMIT')
    } catch (error) { await pg.exec('ROLLBACK'); throw error }
  }
  return { pg, org, act, execute, seedHistory }
}

describe('complete retained authority physical guard family', () => {
  it('rejects invalid or forged writes across every formerly omitted writable family', async () => {
    const f = await fixture()
    try {
      const bad = randomUUID()
      const cases: [string, string, RegExp][] = [
        ["INSERT INTO ue_authority_counsel_engagements(organization_id,matter_id,counsel_user_id,capacity,recorded_by,effective_at) VALUES($1,$2,'counsel','external_counsel','actor',now())", bad, /ENGAGEMENT_MATTER_INVALID/],
        ["INSERT INTO ue_authority_counsel_nonces(organization_id,matter_id,nonce_hash,consumed_by,expires_at) VALUES($1,$2,repeat('a',64),'forged',now()+interval '1 hour')", bad, /ACTOR_NOT_SESSION/],
        ["INSERT INTO ue_authority_workaid_consent_grants(organization_id,consent_id,matter_id,member_user_id,text_id,text_version,text_sha256) VALUES($1,$2,$2,'actor',$2,'v1',repeat('a',64))", bad, /WORKAID_GRANT_INVALID/],
        ["INSERT INTO ue_authority_workaid_document_auths(organization_id,matter_id,consent_id,document_id,classification,authorised_by,expires_at) VALUES($1,$2,$2,$2,'standard','actor',now()+interval '1 hour')", bad, /WORKAID_DOCAUTH_INVALID/],
        ["INSERT INTO ue_authority_workaid_shares(organization_id,matter_id,consent_id,kind,categories,created_by) VALUES($1,$2,$2,'categories',ARRAY['case_summary'],'actor')", bad, /WORKAID_SHARE_INVALID/],
        ["INSERT INTO ue_authority_workaid_matters(organization_id,member_user_id,case_id,referred_by,referred_categories) VALUES($1,'member',$2,'actor',ARRAY['*'])", bad, /REFERRAL_SCOPE_REQUIRED/],
        ["INSERT INTO ue_authority_workaid_counsel_access(organization_id,matter_id,counsel_user_id,shares_served) VALUES($1,$2,'forged',1)", bad, /ACTOR_NOT_SESSION/],
        // Finance persistence is excluded from the base release: no application role holds a privilege on financial steps, so a forged
        // step is refused by the privilege check before its STATE_NOT_ELIGIBLE guard is reached.
        ["INSERT INTO ue_authority_financial_steps(organization_id,subject_id,step,actor) VALUES($1,$2,'executed','actor')", bad, /permission denied for table ue_authority_financial_steps/],
      ]
      for (const [sql, id, expected] of cases) await expect(f.act(sql, [f.org, id])).rejects.toThrow(expected)
      await expect(f.act("INSERT INTO ue_authority_workaid_consent_texts(organization_id,version,body,body_sha256,recorded_by,effective_at) VALUES($1,'v1','unverified source',repeat('0',64),'actor',now())", [f.org])).rejects.toThrow(/ue_authority_wa_text_hash_chk/)
      expect((await f.pg.query('SELECT count(*)::int n FROM ue_authority_events')).rows[0]).toEqual({ n: 0 })
    } finally { await f.pg.close() }
  })

  it('preserves legitimate case idempotency but refuses actor forgery and a second result write', async () => {
    const f = await fixture()
    try {
      const id = randomUUID()
      await expect(f.act("INSERT INTO ue_authority_requests(organization_id,idempotency_key,operation,request_hash,actor) VALUES($1,'forged','case.read',repeat('a',64),'other')", [f.org])).rejects.toThrow(/ACTOR_NOT_SESSION/)
      await f.act("INSERT INTO ue_authority_requests(id,organization_id,idempotency_key,operation,request_hash,actor) VALUES($1,$2,'case-read','case.read',repeat('a',64),'actor')", [id, f.org])
      await f.act("UPDATE ue_authority_requests SET result='{}'::jsonb WHERE id=$1", [id])
      await expect(f.act("UPDATE ue_authority_requests SET result='{\"forged\":true}'::jsonb WHERE id=$1", [id])).rejects.toThrow(/result once/)
      expect((await f.pg.query('SELECT result FROM ue_authority_requests WHERE id=$1', [id])).rows[0]).toEqual({ result: {} })
    } finally { await f.pg.close() }
  })

  it('rolls back a retained nonce write and its event when canonical audit is absent', async () => {
    const f = await fixture()
    try {
      await expect(f.act("INSERT INTO ue_authority_counsel_nonces(organization_id,matter_id,nonce_hash,consumed_by,expires_at) VALUES($1,$2,repeat('b',64),'actor',now()+interval '1 hour')", [f.org, randomUUID()])).rejects.toThrow(/AUDIT_LINK_MISSING/)
      expect((await f.pg.query('SELECT count(*)::int n FROM ue_authority_counsel_nonces')).rows[0]).toEqual({ n: 0 })
      expect((await f.pg.query('SELECT count(*)::int n FROM ue_authority_events')).rows[0]).toEqual({ n: 0 })
    } finally { await f.pg.close() }
  })

  it('retains proposal storage and all five guards while denying every runtime operation', async () => {
    const f = await fixture()
    try {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
        expect((await f.pg.query("SELECT has_table_privilege('union_eyes_runtime','ue_authority_workaid_consent_text_proposals',$1) allowed", [privilege])).rows[0]).toEqual({ allowed: false })
      }
      await expect(f.act('SELECT * FROM ue_authority_workaid_consent_text_proposals')).rejects.toThrow(/permission denied/)
      await expect(f.act("INSERT INTO ue_authority_workaid_consent_text_proposals(organization_id,version,body,body_sha256,proposed_by) VALUES($1,'v1','not adopted',repeat('a',64),'actor')", [f.org])).rejects.toThrow(/permission denied/)
      expect(contract.triggers.filter(row => row.table_name === 'ue_authority_workaid_consent_text_proposals')).toHaveLength(5)
    } finally { await f.pg.close() }
  })

  it('preserves terminal historical withdrawal and retirement without reviving or rewriting them', async () => {
    const f = await fixture()
    try {
      const matter = randomUUID(), wording = randomUUID()
      await f.seedHistory("INSERT INTO ue_authority_workaid_matters(id,organization_id,member_user_id,case_id,referred_by,referred_categories,withdrawn_at) VALUES($1,$2,'member',$3,'actor',ARRAY['case_summary'],now())", [matter, f.org, randomUUID()])
      await f.seedHistory("INSERT INTO ue_authority_workaid_consent_texts(id,organization_id,version,body,body_sha256,recorded_by,effective_at,retired_at,retired_by) VALUES($1,$2,'retained-fixture','SYNTHETIC HISTORICAL FIXTURE',encode(sha256(convert_to('SYNTHETIC HISTORICAL FIXTURE','UTF8')),'hex'),'actor',now(),now(),'actor')", [wording, f.org])
      await expect(f.act('UPDATE ue_authority_workaid_matters SET withdrawn_at=NULL WHERE id=$1', [matter])).rejects.toThrow(/terminal/)
      await expect(f.act('UPDATE ue_authority_workaid_matters SET referred_categories=ARRAY[\'documents\'] WHERE id=$1', [matter])).rejects.toThrow(/terminal/)
      await expect(f.act('UPDATE ue_authority_workaid_consent_texts SET retired_at=NULL,retired_by=NULL WHERE id=$1', [wording])).rejects.toThrow(/terminal/)
      expect((await f.pg.query('SELECT withdrawn_at IS NOT NULL terminal FROM ue_authority_workaid_matters WHERE id=$1', [matter])).rows[0]).toEqual({ terminal: true })
      expect((await f.pg.query('SELECT retired_at IS NOT NULL terminal FROM ue_authority_workaid_consent_texts WHERE id=$1', [wording])).rows[0]).toEqual({ terminal: true })
    } finally { await f.pg.close() }
  })
})

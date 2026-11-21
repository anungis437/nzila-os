/** Actual source guard/session/audit component proof; not native sockets or real institutional adoption. */
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../../packages/db/src/client'
import { authContextSettings, authExecutionRole, type AuthExecutionContext } from '../../../../packages/db/src/auth-storage-authority/execution-boundary'
import { compileAuthBootstrapSql } from '../../../../packages/db/src/auth-storage-authority/bootstrap-sql'
import { compileSyntheticAuthFixtureSql } from '../../scripts/bootstrap-v2/auth-fixture'
import * as schema from '../schema/domains/ml/authority-kernel'
import { AUTHORITY_PHYSICAL_GUARDS } from './authority-physical-guards'
import { AUTHORITY_ISSUER_GUARDS } from './authority-issuer-guards'
import { applyPhysicalGuards, inspectPhysicalGuards, planPhysicalGuards, type PhysicalGuardContract } from './physical-guard-catalog'
import { compileBusinessSessionPolicy } from './business-session-policy'
import { auditAuthorityMutation } from '../../lib/authority/store/audit'
import { compileAuthorityMembershipReaderSql } from '../../lib/authority/store/platform-identity'
import { activeMembershipSource } from '../../lib/authority/store/active-membership-source'
import { draftIssuanceRule, requestRuleAdoption, activateIssuanceRule } from '../../lib/authority/store/lifecycle'
import { recordApprovalDecision } from '../../lib/authority/store/mutations'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
const transport = vi.hoisted(() => ({ execute: vi.fn(), close: vi.fn(async () => undefined) }))
// Adapt only the socket transport. Production auth context/session issuance,
// bearer resolution, canonical predicates, actor/office policy and audit run.
vi.mock('@nzila/db/auth-client', () => ({ executeAuthContext: transport.execute, closeAuthClients: transport.close,
  lockInviterAuthority: () => { throw new Error('Unexpected inviter operation') } }))
import { closeNativeCanonicalSessions, createNativeCanonicalSession, nativeCloneConfiguration, nativeCloneLoginSql } from '../../scripts/runtime/native-canonical-fixture'

let engine: PGlite | undefined
afterEach(async () => { await closeNativeCanonicalSessions(); await engine?.close(); engine = undefined; vi.unstubAllEnvs() })
const sourcePath = new URL('./authority-physical-guards.ts', import.meta.url)
const deps = { memberships: activeMembershipSource }

async function fixture(physicalContract: PhysicalGuardContract = AUTHORITY_PHYSICAL_GUARDS) {
  const pg = engine = new PGlite(), org = randomUUID()
  // URLs are never connected or emitted: only the PGlite transport adapter is
  // substituted. These four LOGIN roles are real SQL roles inside this engine.
  const configuration = nativeCloneConfiguration('postgresql://fixture_owner:synthetic-only@127.0.0.1:54321/pristine_template')
  await pg.exec(`CREATE ROLE ue_v2_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE union_eyes_system NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    GRANT CREATE ON SCHEMA public TO ue_v2_owner;`)
  await pg.exec(compileSyntheticAuthFixtureSql())
  await pg.exec(compileAuthBootstrapSql())
  await pg.exec(compileAuthorityMembershipReaderSql())
  await pg.exec(nativeCloneLoginSql({ ...configuration, database: 'postgres' }, 16))
  await pg.exec('SET ROLE ue_v2_owner')
  const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
  for (const sql of [...ddl.filter(statement => !statement.startsWith('ALTER TABLE')), ...ddl.filter(statement => statement.startsWith('ALTER TABLE'))]) await pg.exec(sql)
  await pg.exec(`RESET ROLE; CREATE TABLE public.audit_logs(id uuid PRIMARY KEY,audit_id uuid UNIQUE NOT NULL,
    created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,organization_id uuid,
    action varchar(100),resource_type varchar(255),resource_id varchar(255),user_id varchar(255),
    ip_address inet,user_agent text,correlation_id uuid,details jsonb DEFAULT '{}',changes jsonb DEFAULT '{}',
    content_hash varchar(64),previous_hash varchar(64));ALTER TABLE public.audit_logs OWNER TO ue_v2_owner;`)
  for (const [actor, role] of [['drafter', 'president'], ['approver-one', 'vice_president'], ['approver-two', 'secretary_treasurer'], ['member', 'member']]) {
    await pg.query('INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state) VALUES($1,$2,true,\'active\')', [actor, actor + '@example.invalid'])
    await pg.query('INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,$3,true)', [actor, org, role])
  }
  for (const table of [...AUTHORITY_PHYSICAL_GUARDS.tables, 'audit_logs'])
    await pg.exec(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;ALTER TABLE public."${table}" FORCE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE ON public."${table}" TO union_eyes_runtime;
      CREATE POLICY fixture_organization ON public."${table}" TO union_eyes_runtime
        USING(organization_id::text=current_setting('app.current_org_id',true))
        WITH CHECK(organization_id::text=current_setting('app.current_org_id',true));${compileBusinessSessionPolicy(table)}`)
  await pg.exec('SET ROLE ue_v2_owner')
  const execute = async (statement: string) => (await pg.query(statement)).rows as Record<string, unknown>[]
  for (const contract of [physicalContract, AUTHORITY_ISSUER_GUARDS]) {
    const plan = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute))
    await pg.exec('BEGIN'); await applyPhysicalGuards(contract, execute, plan.fingerprint); await pg.exec('COMMIT')
  }
  const restoreOwner = () => pg.exec('RESET ROLE; SET SESSION AUTHORIZATION postgres; RESET ROLE')
  await restoreOwner()
  const dialect = new PgDialect(), driver = drizzle(pg)
  const adapter = new Proxy(driver, { get(target, property) {
    if (property === 'execute') return async (statement: SQL) => {
      const compiled = dialect.sqlToQuery(statement)
      return (await pg.query(compiled.sql, compiled.params)).rows
    }
    const value = Reflect.get(target, property)
    return typeof value === 'function' ? value.bind(target) : value
  } }) as unknown as Database
  transport.execute.mockImplementation(async (context: AuthExecutionContext, callback: (db: Database) => Promise<unknown>) => {
    const login = ['system', 'lifecycle', 'cleanup', 'mfa-admin'].includes(context.phase) ? configuration.logins.authSystem : configuration.logins.auth
    await pg.exec(`SET SESSION AUTHORIZATION "${login.username}";BEGIN;SET LOCAL ROLE "${authExecutionRole(context)}"`)
    try {
      for (const [key, value] of Object.entries(authContextSettings(context))) await pg.query('SELECT set_config($1,$2,true)', [key, value])
      const result = await callback(adapter); await pg.exec('COMMIT'); return result
    } catch (error) { await pg.exec('ROLLBACK'); throw error }
    finally { await restoreOwner() }
  })
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
  vi.stubEnv('UE_AUTHORITY_COMBINED_URL', configuration.operatorUrl)
  vi.stubEnv('AUTH_DATABASE_URL', configuration.logins.auth.url)
  vi.stubEnv('AUTH_SYSTEM_DATABASE_URL', configuration.logins.authSystem.url)
  const sessions = new Map<string, Awaited<ReturnType<typeof createNativeCanonicalSession>>>()
  for (const actor of ['drafter', 'approver-one', 'approver-two', 'member']) sessions.set(actor, await createNativeCanonicalSession(actor, org))
  const as = <T>(actor: string, work: (tx: SqlExecutor) => Promise<T>) => sessions.get(actor)!.withBinding(async binding => {
    await pg.exec(`SET SESSION AUTHORIZATION "${configuration.logins.runtime.username}";SET ROLE union_eyes_runtime`)
    try { return await runAuthorityTransaction(pg, { organizationId: binding.organizationId, userId: binding.userId, sessionToken: binding.sessionToken }, work) }
    finally { await restoreOwner() }
  })
  const raw = (actor: string, statement: string, parameters: unknown[] = [], audit = true) => as(actor, async tx => {
    const result = await tx.query(statement, parameters)
    if (audit) await auditAuthorityMutation(tx, { organizationId: org, action: 'qa.rule-adoption', resourceType: 'authority-component' })
    return result.rows
  })
  const draft = () => as('drafter', tx => draftIssuanceRule(tx, deps, { organizationId: org, domain: 'case_assignment', operation: 'issue',
    issuerCapacities: ['officer'], allowedPowers: ['read'], maxTermDays: null, requiresAcceptance: false, requiredIndependentApprovals: 0,
    draftedBy: 'drafter', sourceInstrument: 'Synthetic component source; no live adoption' }))
  const status = async (id: string) => (await pg.query('SELECT status FROM public.ue_authority_issuance_rules WHERE id=$1', [id])).rows
  return { pg, org, as, raw, draft, status, execute }
}

describe('institutional rule adoption at actual SQL write boundaries', () => {
  it('retains the production draft/request/vote/activate path with two genuinely bound synthetic authority lines', async () => {
    const f = await fixture(), id = await f.draft()
    const request = await f.as('drafter', tx => requestRuleAdoption(tx, deps, { organizationId: f.org, ruleId: id,
      actorUserId: 'drafter', sourceInstrument: 'Synthetic component adoption citation', namedApproverIds: ['approver-one', 'approver-two'] }))
    await f.as('approver-one', tx => recordApprovalDecision(tx, deps, { organizationId: f.org, approvalRequestId: request, approverUserId: 'approver-one', decision: 'approved' }))
    await expect(f.as('drafter', tx => activateIssuanceRule(tx, deps, { organizationId: f.org, ruleId: id, actorUserId: 'drafter', approvalRequestId: request })))
      .rejects.toThrow('satisfied rule_adoption')
    await f.as('approver-two', tx => recordApprovalDecision(tx, deps, { organizationId: f.org, approvalRequestId: request, approverUserId: 'approver-two', decision: 'approved' }))
    await f.as('drafter', tx => activateIssuanceRule(tx, deps, { organizationId: f.org, ruleId: id, actorUserId: 'drafter', approvalRequestId: request }))
    expect(await f.status(id)).toEqual([{ status: 'active' }])
    expect((await f.pg.query(`SELECT count(*)::int AS uncovered FROM public.ue_authority_events e WHERE NOT EXISTS(
      SELECT FROM public.audit_logs a WHERE a.organization_id=e.organization_id AND a.created_at>=e.occurred_at AND (a.details->'authorityEventIds')?e.id::text)`)).rows)
      .toEqual([{ uncovered: 0 }])
  }, 30000)

  it('rejects forged draft activation even with a valid canonical actor and audit linkage', async () => {
    const f = await fixture(), id = await f.draft()
    await expect(f.raw('drafter', `UPDATE public.ue_authority_issuance_rules SET status='active',approved_by=ARRAY['approver-one','approver-two'],activated_at=now() WHERE id=$1`, [id]))
      .rejects.toThrow('RULE_ADOPTION_NOT_APPROVED')
    expect(await f.status(id)).toEqual([{ status: 'draft' }])
  }, 30000)

  it('refuses an already-active INSERT with claimed approvers rather than recorded adoption, even when audit can commit', async () => {
    const f = await fixture(), id = randomUUID()
    const context = await f.as('member', async tx => (await tx.query(`SELECT current_user AS execution_role,session_user AS login,
      current_setting('app.current_user_id',true) AS actor,user_management.auth_business_org_authorized($1::uuid,NULL::text[]) AS live_context`, [f.org])).rows[0])
    let code: string | null = null
    try {
      await f.raw('member', `INSERT INTO public.ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,version,status,source_instrument,drafted_by,approved_by,activated_at)
        VALUES($1,$2,'case_assignment','issue',ARRAY['officer'],ARRAY['read'],1,'active','Synthetic forged adoption input','member',ARRAY['approver-one','approver-two'],now())`, [id, f.org])
    } catch (error) { code = (error as { code?: string }).code ?? 'UNKNOWN' }
    const persisted = await f.status(id)
    const records = (await f.pg.query(`SELECT (SELECT count(*)::int FROM public.ue_authority_approval_requests WHERE subject_id=$1) AS requests,
      (SELECT count(*)::int FROM public.ue_authority_events WHERE source_id=$1) AS events,
      (SELECT count(*)::int FROM public.audit_logs WHERE details->'authorityEventIds' ?| ARRAY(SELECT id::text FROM public.ue_authority_events WHERE source_id=$1)) AS linked_audits`, [id])).rows[0]
    process.stdout.write(JSON.stringify({ proof: 'AUTHORITY_ACTIVE_RULE_INSERT_ADOPTION_BOUNDARY', engine: 'PGlite', nativeVerdict: 'UNEXECUTED',
      guardSource: { path: 'apps/union-eyes/db/auth/authority-physical-guards.ts', sha256: createHash('sha256').update(readFileSync(sourcePath)).digest('hex') },
      context, code, persisted, records, fixtureBoundary: 'Actual canonical session/bearer and guards; socket transport adapted; no live adoption evidence' }) + '\n')
    expect(context).toMatchObject({ execution_role: 'union_eyes_runtime', actor: 'member', live_context: true })
    expect({ code, persisted }).toEqual({ code: '42501', persisted: [] })
  }, 30000)

  it('keeps the independent actor and missing-audit rejection meaningful', async () => {
    const f = await fixture(), forged = randomUUID()
    const statement = `INSERT INTO public.ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,version,source_instrument,drafted_by)
      VALUES($1,$2,'case_assignment','issue',ARRAY['officer'],ARRAY['read'],1,'Synthetic source',$3)`
    await expect(f.raw('member', statement, [forged, f.org, 'drafter'])).rejects.toThrow('ACTOR_NOT_SESSION')
    await expect(f.raw('drafter', statement, [forged, f.org, 'drafter'], false)).rejects.toThrow('AUDIT_LINK_MISSING')
    expect(await f.status(forged)).toEqual([])
  }, 30000)

  it.each([
    { status: 'retired', approved: [] as string[], activated: null, retired: new Date() },
    { status: 'draft', approved: ['approver-one', 'approver-two'], activated: null, retired: null },
    { status: 'draft', approved: [] as string[], activated: new Date(), retired: null },
  ])('requires a clean draft rather than importing lifecycle claims %j', async state => {
    const f = await fixture(), id = randomUUID()
    await expect(f.raw('drafter', `INSERT INTO public.ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,version,status,source_instrument,drafted_by,approved_by,activated_at,retired_at)
      VALUES($1,$2,'case_assignment','issue',ARRAY['officer'],ARRAY['read'],1,$3,'Synthetic lifecycle claim','drafter',$4::text[],$5,$6)`,
    [id, f.org, state.status, state.approved, state.activated, state.retired])).rejects.toMatchObject({ code: '42501' })
    expect(await f.status(id)).toEqual([])
  }, 30000)

  it.each(['satisfied', 'rejected', 'withdrawn'])('refuses an initially %s approval request without decision history', async status => {
    const f = await fixture(), rule = await f.draft(), id = randomUUID()
    await expect(f.raw('drafter', `INSERT INTO public.ue_authority_approval_requests(id,organization_id,subject_type,subject_id,proposed_by,
      required_approvals,risk_class,named_approver_ids,eligible_capacities,status,decided_at)
      VALUES($1,$2,'rule_adoption',$3,'drafter',2,'high',ARRAY['approver-one','approver-two'],ARRAY['executive'],$4,now())`,
    [id, f.org, rule, status])).rejects.toMatchObject({ code: '42501' })
    expect((await f.pg.query('SELECT status FROM public.ue_authority_approval_requests WHERE id=$1', [id])).rows).toEqual([])
  }, 30000)

  it.each(['rejected', 'withdrawn'])('preserves the legitimate open-to-%s lifecycle', async status => {
    const f = await fixture(), rule = await f.draft()
    const request = await f.as('drafter', tx => requestRuleAdoption(tx, deps, { organizationId: f.org, ruleId: rule,
      actorUserId: 'drafter', sourceInstrument: 'Synthetic component adoption citation', namedApproverIds: ['approver-one', 'approver-two'] }))
    if (status === 'rejected') {
      await f.as('approver-one', tx => recordApprovalDecision(tx, deps, { organizationId: f.org, approvalRequestId: request,
        approverUserId: 'approver-one', decision: 'rejected' }))
    } else {
      await f.raw('drafter', "UPDATE public.ue_authority_approval_requests SET status='withdrawn',decided_at=now() WHERE id=$1", [request])
    }
    expect((await f.pg.query('SELECT status FROM public.ue_authority_approval_requests WHERE id=$1', [request])).rows).toEqual([{ status }])
    await expect(f.raw('drafter', "UPDATE public.ue_authority_approval_requests SET status='open',decided_at=NULL WHERE id=$1", [request]))
      .rejects.toMatchObject({ code: '42501' })
    expect(await f.status(rule)).toEqual([{ status: 'draft' }])
  }, 30000)

  it('adds the guard without rewriting pre-existing lifecycle history or released function bodies/OIDs, then refuses a new replay', async () => {
    const priorContract: PhysicalGuardContract = { ...AUTHORITY_PHYSICAL_GUARDS,
      functions: AUTHORITY_PHYSICAL_GUARDS.functions.filter(fn => fn.name !== 'ue_authority_guard_initial_state'),
      triggers: AUTHORITY_PHYSICAL_GUARDS.triggers.filter(trigger => trigger.name !== 'ue_authority_guard_initial_state') }
    const f = await fixture(priorContract), rule = randomUUID(), request = randomUUID()
    // Exercise the reproduced pre-fix behavior only before installing the new
    // protection. This historical row is not asserted to be valid adoption.
    const insert = `INSERT INTO public.ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,
      version,status,source_instrument,drafted_by,approved_by,activated_at)
      VALUES($1,$2,'case_assignment','issue',ARRAY['officer'],ARRAY['read'],1,'active','Synthetic pre-existing history','member',
      ARRAY['approver-one','approver-two'],now())`
    await f.raw('member', insert, [rule, f.org])
    await f.raw('drafter', `INSERT INTO public.ue_authority_approval_requests(id,organization_id,subject_type,subject_id,proposed_by,
      required_approvals,risk_class,named_approver_ids,eligible_capacities,status,decided_at)
      VALUES($1,$2,'rule_adoption',$3,'drafter',2,'high',ARRAY['approver-one','approver-two'],ARRAY['executive'],'satisfied',now())`,
    [request, f.org, rule])
    const history = () => f.pg.query(`SELECT 'rule' AS kind,to_jsonb(r) AS record FROM public.ue_authority_issuance_rules r WHERE id=$1
      UNION ALL SELECT 'request',to_jsonb(r) FROM public.ue_authority_approval_requests r WHERE id=$2 ORDER BY kind`, [rule, request])
    const functions = () => f.pg.query(`SELECT p.oid::text,p.proname,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'ue_authority_%' AND p.proname<>'ue_authority_guard_initial_state' ORDER BY p.oid`)
    const before = (await history()).rows, beforeFunctions = (await functions()).rows
    const plan = planPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS, await inspectPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS, f.execute))
    expect(plan.statements.some(sql => sql.includes('CREATE OR REPLACE'))).toBe(false)
    await f.pg.exec('BEGIN; SET LOCAL ROLE ue_v2_owner')
    try { await applyPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS, f.execute, plan.fingerprint); await f.pg.exec('COMMIT') }
    catch (error) { await f.pg.exec('ROLLBACK'); throw error }
    expect((await history()).rows).toEqual(before)
    expect((await functions()).rows).toEqual(beforeFunctions)
    expect(planPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS, await inspectPhysicalGuards(AUTHORITY_PHYSICAL_GUARDS, f.execute)).statements).toEqual([])
    const replay = randomUUID()
    await expect(f.raw('member', insert, [replay, f.org])).rejects.toMatchObject({ code: '42501' })
    expect(await f.status(replay)).toEqual([])
    expect((await history()).rows).toEqual(before)
  }, 30000)
})

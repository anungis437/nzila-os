/** Physical source regressions on PostgreSQL semantics; these are not staging or real-institution approval evidence. */
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { describe, expect, it } from 'vitest'
import * as schema from '../schema/domains/ml/authority-kernel'
import { AUTHORITY_PHYSICAL_GUARDS as contract } from './authority-physical-guards'
import {
  inspectPhysicalGuards,
  planPhysicalGuards,
  applyPhysicalGuards,
  physicalGuardViolations,
} from './physical-guard-catalog'
import { auditAuthorityMutation } from '@/lib/authority/store/audit'
import { ACTIVE_RECUSAL_SQL } from '@/lib/authority/common'
import type { PhysicalGuardContract } from './physical-guard-catalog'

async function fixture(guardContract: PhysicalGuardContract = contract) {
  const pg = new PGlite()
  await pg.exec(`CREATE ROLE ue_v2_owner;CREATE ROLE union_eyes_runtime;CREATE ROLE union_eyes_system;
 GRANT CREATE ON SCHEMA public TO ue_v2_owner;SET ROLE ue_v2_owner;`)
  const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
  for (const sql of [
    ...ddl.filter((s) => !s.startsWith('ALTER TABLE')),
    ...ddl.filter((s) => s.startsWith('ALTER TABLE')),
  ])
    await pg.exec(sql)
  for (const name of guardContract.tables)
    await pg.exec(
      `ALTER TABLE public."${name}" ENABLE ROW LEVEL SECURITY;ALTER TABLE public."${name}" FORCE ROW LEVEL SECURITY;`,
    )
  await pg.exec(
    `RESET ROLE;CREATE TABLE audit_logs(id uuid PRIMARY KEY,audit_id uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,organization_id uuid,action varchar(100),resource_type varchar(255),resource_id varchar(255),user_id varchar(255),ip_address inet,user_agent text,correlation_id uuid,details jsonb DEFAULT '{}'::jsonb,changes jsonb DEFAULT '{}'::jsonb,content_hash varchar(64),previous_hash varchar(64));SET ROLE ue_v2_owner;`,
  )
  const execute = async (sql: string) => (await pg.query(sql)).rows as Record<string, unknown>[]
  const plan = planPhysicalGuards(guardContract, await inspectPhysicalGuards(guardContract, execute))
  await pg.exec('BEGIN')
  await applyPhysicalGuards(guardContract, execute, plan.fingerprint)
  await pg.exec('COMMIT')
  await pg.exec('RESET ROLE')
  const org = randomUUID()
  const audited = async (actor: string, sql: string, params: unknown[] = []) => {
    await pg.exec('BEGIN')
    try {
      await pg.query(
        "SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true)",
        [actor, org],
      )
      const result = await pg.query(sql, params)
      await auditAuthorityMutation(pg, {
        organizationId: org,
        action: 'qa.physical_guard',
        resourceType: 'authority-qa',
      })
      await pg.exec('COMMIT')
      return result.rows
    } catch (e) {
      await pg.exec('ROLLBACK')
      throw e
    }
  }
  const draft = async () => {
    const id = randomUUID()
    await audited(
      'drafter',
      `INSERT INTO ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,version,source_instrument,drafted_by) VALUES($1,$2,'case_assignment','issue',ARRAY['officer'],ARRAY['read'],1,'QA fixture; no real adoption','drafter')`,
      [id, org],
    )
    return id
  }
  return { pg, org, execute, audited, draft }
}

describe('base authority physical source contract', () => {
  it('pins immutable reference bytes while declaring only base case/governance tables', () => {
    const root = path.resolve(__dirname, '../../../..')
    for (const ref of contract.references)
      expect(
        createHash('sha256')
          .update(readFileSync(path.join(root, ref.path)))
          .digest('hex'),
      ).toBe(ref.sha256)
    expect(contract.tables).not.toContain('ue_authority_financial_steps')
    expect(contract.tables).not.toContain('ue_authority_workaid_matters')
    expect(contract.functions.every((fn) => fn.path.endsWith('pg_temp'))).toBe(true)
  })
  it('records actual distinct votes, satisfies only after the threshold, rejects direct resolution/self-approval/forgery, and retains audit coverage', async () => {
    const f = await fixture()
    try {
      const ruleId = await f.draft(),
        requestId = randomUUID()
      await f.audited(
        'drafter',
        `INSERT INTO ue_authority_approval_requests(id,organization_id,subject_type,subject_id,proposed_by,required_approvals,risk_class,named_approver_ids,eligible_capacities) VALUES($1,$2,'rule_adoption',$3,'drafter',2,'high',ARRAY['approver-one','approver-two'],ARRAY['executive'])`,
        [requestId, f.org, ruleId],
      )
      const status = async () =>
        (
          await f.pg.query('SELECT status FROM ue_authority_approval_requests WHERE id=$1', [
            requestId,
          ])
        ).rows[0].status
      const vote = (actor: string, claimed = actor) =>
        f.audited(
          actor,
          `INSERT INTO ue_authority_approval_decisions(organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$3,'approved')`,
          [f.org, requestId, claimed],
        )
      await expect(
        f.audited(
          'drafter',
          "UPDATE ue_authority_approval_requests SET status='satisfied',decided_at=now() WHERE id=$1",
          [requestId],
        ),
      ).rejects.toThrow('recording a decision')
      await expect(vote('drafter')).rejects.toThrow('SELF_APPROVAL')
      await expect(vote('approver-one', 'approver-two')).rejects.toThrow('ACTOR_NOT_SESSION')
      await vote('approver-one')
      expect(await status()).toBe('open')
      await expect(vote('approver-one')).rejects.toThrow()
      expect(await status()).toBe('open')
      await vote('approver-two')
      expect(await status()).toBe('satisfied')
      await f.audited(
        'drafter',
        "UPDATE ue_authority_issuance_rules SET status='active',approved_by=ARRAY['approver-one','approver-two'],activated_at=now() WHERE id=$1",
        [ruleId],
      )
      expect(
        (await f.pg.query('SELECT status FROM ue_authority_issuance_rules WHERE id=$1', [ruleId]))
          .rows,
      ).toEqual([{ status: 'active' }])
      expect(
        (
          await f.pg.query(
            "SELECT count(*)::int n FROM ue_authority_events e WHERE NOT EXISTS(SELECT FROM audit_logs a WHERE a.organization_id=e.organization_id AND a.created_at>=e.occurred_at AND (a.details->'authorityEventIds')?e.id::text)",
          )
        ).rows,
      ).toEqual([{ n: 0 }])
      await expect(f.pg.exec('DELETE FROM ue_authority_approval_decisions')).rejects.toThrow(
        'append-only',
      )
      expect(
        (await planPhysicalGuards(contract, await inspectPhysicalGuards(contract, f.execute)))
          .statements,
      ).toEqual([])
    } finally {
      await f.pg.close()
    }
  }, 30000)
  it('blocks primary-handler overpowers at the physical supervisory rule and mandate boundaries without erasing historical drafts', async () => {
    const f = await fixture()
    const forbidden = [
      'disclose_to_member', 'export_sealed_evidence', 'close',
      'case:disclose_to_member', 'case:export_sealed_evidence', 'case:close',
    ]
    try {
      // Use real threshold resolution and adoption rather than assuming approvals from a status flag.
      for (const operation of ['issue', 'amend']) {
        const createAndApprove = async (powers: string[], version: number) => {
          const ruleId = randomUUID()
          const requestId = randomUUID()
          await f.audited(
            'drafter',
            `INSERT INTO ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,allowed_powers,max_term_days,version,source_instrument,drafted_by) VALUES($1,$2,'supervisory',$3,ARRAY['officer'],$4::text[],30,$5,'Synthetic ceiling fixture','drafter')`,
            [ruleId, f.org, operation, powers, version],
          )
          await f.audited(
            'drafter',
            `INSERT INTO ue_authority_approval_requests(id,organization_id,subject_type,subject_id,proposed_by,required_approvals,risk_class,named_approver_ids,eligible_capacities) VALUES($1,$2,'rule_adoption',$3,'drafter',2,'high',ARRAY['approver-one','approver-two'],ARRAY['executive'])`,
            [requestId, f.org, ruleId],
          )
          for (const actor of ['approver-one', 'approver-two']) {
            await f.audited(
              actor,
              `INSERT INTO ue_authority_approval_decisions(organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$3,'approved')`,
              [f.org, requestId, actor],
            )
          }
          return ruleId
        }
        const activate = (ruleId: string) =>
          f.audited(
            'drafter',
            "UPDATE ue_authority_issuance_rules SET status='active',approved_by=ARRAY['approver-one','approver-two'],activated_at=now() WHERE id=$1",
            [ruleId],
          )
        for (const [i, power] of forbidden.entries()) {
          const ruleId = await createAndApprove(['read', power], i + 1)
          await expect(activate(ruleId)).rejects.toThrow('ue_authority_rule_primary_handler_ceiling_chk')
          expect((await f.pg.query('SELECT status FROM ue_authority_issuance_rules WHERE id=$1', [ruleId])).rows)
            .toEqual([{ status: 'draft' }])
          await f.audited(
            'drafter',
            "UPDATE ue_authority_issuance_rules SET status='retired',retired_at=now() WHERE id=$1",
            [ruleId],
          )
        }
        const valid = await createAndApprove(['read', 'assign'], forbidden.length + 1)
        await activate(valid)
        expect((await f.pg.query('SELECT status FROM ue_authority_issuance_rules WHERE id=$1', [valid])).rows)
          .toEqual([{ status: 'active' }])
      }

      // Dedicated disposable fixture only: bypass the issuance trigger to test the independent CHECK itself.
      await f.pg.exec('ALTER TABLE ue_authority_mandates DISABLE TRIGGER ue_authority_guard_issuance')
      try {
        const insert = (powers: string[], holder: string) =>
          f.audited(
            'issuer',
            `INSERT INTO ue_authority_mandates(organization_id,principal_user_id,kind,powers,scope,source_instrument,granted_by,effective_at,expires_at) VALUES($1,$2,'supervisory',$3::text[], '{"resourceIds":["00000000-0000-4000-8000-000000000123"]}'::jsonb,'Synthetic ceiling fixture','issuer',now(),now()+interval '1 day')`,
            [f.org, holder, powers],
          )
        for (const [i, power] of forbidden.entries())
          await expect(insert(['read', power], 'denied-holder-' + i)).rejects.toThrow('ue_authority_mandates_primary_handler_ceiling_chk')
        await insert(['read', 'assign'], 'allowed-holder')
        expect((await f.pg.query('SELECT principal_user_id FROM ue_authority_mandates WHERE organization_id=$1', [f.org])).rows)
          .toEqual([{ principal_user_id: 'allowed-holder' }])
      } finally {
        await f.pg.exec('ALTER TABLE ue_authority_mandates ENABLE TRIGGER ue_authority_guard_issuance')
      }
      expect(planPhysicalGuards(contract, await inspectPhysicalGuards(contract, f.execute)).statements).toEqual([])
    } finally {
      await f.pg.close()
    }
  }, 60000)
  it('refuses nonfinite relationships and incoherent recusal lifts while preserving an effective independent lift', async () => {
    const f = await fixture()
    try {
      const resource = randomUUID(), recusal = randomUUID()
      for (const [effective, expires] of [["'-infinity'", 'NULL'], ['now()', "'infinity'"]]) {
        await expect(f.audited('holder', `INSERT INTO ue_authority_resource_relationships
          (organization_id,principal_user_id,resource_type,resource_id,relation,origin,effective_at,expires_at)
          VALUES($1,'holder','case',$2,'owner','derived',${effective},${expires})`, [f.org, resource])).rejects.toThrow('ue_authority_rel_finite_time_chk')
      }
      await f.audited('holder', `INSERT INTO ue_authority_recusals(id,organization_id,principal_user_id,resource_type,resource_id,reason)
        VALUES($1,$2,'holder','case',$3,'Synthetic conflict')`, [recusal, f.org, resource])
      for (const instant of ["'infinity'", "now()+interval '1 day'", "now()-interval '1 day'"]) {
        await expect(f.audited('independent', `UPDATE ue_authority_recusals SET lifted_at=${instant},lifted_by='independent' WHERE id=$1`, [recusal])).rejects.toThrow('ue_authority_recusal_finite_time_chk')
      }
      expect((await f.pg.query(`SELECT id FROM ue_authority_recusals WHERE ${ACTIVE_RECUSAL_SQL}`)).rows).toHaveLength(1)
      await f.audited('independent', "UPDATE ue_authority_recusals SET lifted_at=now(),lifted_by='independent' WHERE id=$1", [recusal])
      expect((await f.pg.query(`SELECT id FROM ue_authority_recusals WHERE ${ACTIVE_RECUSAL_SQL}`)).rows).toHaveLength(0)
    } finally { await f.pg.close() }
  }, 30000)

  it('upgrades additively and refuses conflicting stored lift evidence without rewriting historical rows or functions', async () => {
    const legacy: PhysicalGuardContract = { ...contract,
      functions: contract.functions.filter(fn => fn.name !== 'ue_authority_guard_lifecycle_decision'),
      triggers: contract.triggers.filter(trigger => trigger.name !== 'ue_authority_guard_lifecycle_decision'),
      constraints: contract.constraints.filter(constraint => !constraint.name.includes('finite_time')) }
    const f = await fixture(legacy)
    try {
      const recusal = randomUUID()
      await f.audited('holder', `INSERT INTO ue_authority_recusals(id,organization_id,principal_user_id,resource_type,resource_id,reason)
        VALUES($1,$2,'holder','case',$3,'Synthetic legacy conflict')`, [recusal, f.org, randomUUID()])
      await f.audited('independent', "UPDATE ue_authority_recusals SET lifted_at=now()+interval '1 day',lifted_by='independent' WHERE id=$1", [recusal])
      const before = (await f.pg.query('SELECT * FROM ue_authority_recusals WHERE id=$1', [recusal])).rows
      const plan = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, f.execute))
      expect(plan.statements.some(sql => sql.includes('CREATE OR REPLACE'))).toBe(false)
      await f.pg.exec('BEGIN; SET LOCAL ROLE ue_v2_owner')
      try { await expect(applyPhysicalGuards(contract, f.execute, plan.fingerprint)).rejects.toThrow('ue_authority_recusal_finite_time_chk') }
      finally { await f.pg.exec('ROLLBACK') }
      expect((await f.pg.query('SELECT * FROM ue_authority_recusals WHERE id=$1', [recusal])).rows).toEqual(before)
      expect((await f.pg.query(`SELECT id FROM ue_authority_recusals WHERE ${ACTIVE_RECUSAL_SQL}`)).rows).toHaveLength(1)
    } finally { await f.pg.close() }
    const clean = await fixture(legacy)
    try {
      const plan = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, clean.execute))
      await clean.pg.exec('BEGIN; SET LOCAL ROLE ue_v2_owner')
      await applyPhysicalGuards(contract, clean.execute, plan.fingerprint)
      await clean.pg.exec('COMMIT')
      expect(planPhysicalGuards(contract, await inspectPhysicalGuards(contract, clean.execute)).statements).toEqual([])
    } finally { await clean.pg.close() }
  }, 30000)

  it('rechecks required delegation and office acceptance at the physical approval boundary', async () => {
    const f = await fixture()
    try {
      const adopt = async (domain: string, powers: string[]) => {
        const rule = randomUUID(), request = randomUUID()
        await f.audited('drafter', `INSERT INTO ue_authority_issuance_rules(id,organization_id,domain,operation,issuer_capacities,
          allowed_powers,max_term_days,requires_acceptance,version,source_instrument,drafted_by)
          VALUES($1,$2,$3,'issue',ARRAY['executive'],$4::text[],30,true,1,'Synthetic test bylaw','drafter')`, [rule,f.org,domain,powers])
        await f.audited('drafter', `INSERT INTO ue_authority_approval_requests(id,organization_id,subject_type,subject_id,
          proposed_by,required_approvals,risk_class,named_approver_ids,eligible_capacities)
          VALUES($1,$2,'rule_adoption',$3,'drafter',2,'high',ARRAY['reviewer-one','reviewer-two'],ARRAY['executive'])`, [request,f.org,rule])
        for(const actor of ['reviewer-one','reviewer-two']) await f.audited(actor, `INSERT INTO ue_authority_approval_decisions
          (organization_id,approval_request_id,approver_user_id,authority_line_user_id,decision) VALUES($1,$2,$3,$3,'approved')`, [f.org,request,actor])
        await f.audited('drafter', "UPDATE ue_authority_issuance_rules SET status='active',approved_by=ARRAY['reviewer-one','reviewer-two'],activated_at=now() WHERE id=$1", [rule])
        return rule
      }
      const officeRule = await adopt('executive_office',['approve'])
      const delegationRule = await adopt('delegation',['governance:approve'])
      const office = randomUUID(), delegation = randomUUID(), request = randomUUID()
      await f.audited('issuer', `INSERT INTO ue_authority_mandates(id,organization_id,principal_user_id,kind,powers,source_instrument,
        granted_by,effective_at,expires_at,issuance_rule_id) VALUES($1,$2,'president','executive_office',ARRAY['approve'],'Synthetic office','issuer',now()-interval '1 hour',now()+interval '1 day',$3)`, [office,f.org,officeRule])
      await f.audited('president', `INSERT INTO ue_authority_delegations(id,organization_id,delegator_user_id,delegate_user_id,office,
        actions,resource_types,effective_at,expires_at,issuance_rule_id) VALUES($1,$2,'president','delegate','President',ARRAY['governance:approve'],ARRAY['approval_request'],now()-interval '1 hour',now()+interval '1 day',$3)`, [delegation,f.org,delegationRule])
      await f.audited('proposer', `INSERT INTO ue_authority_approval_requests(id,organization_id,subject_type,subject_id,
        proposed_by,required_approvals,risk_class,named_approver_ids) VALUES($1,$2,'synthetic-subject',$3,'proposer',1,'low',ARRAY['president'])`, [request,f.org,randomUUID()])
      const vote = () => f.audited('delegate', `INSERT INTO ue_authority_approval_decisions(organization_id,approval_request_id,
        approver_user_id,authority_line_user_id,decision,delegation_id) VALUES($1,$2,'delegate','president','approved',$3)`, [f.org,request,delegation])
      await expect(vote()).rejects.toThrow('live accepted delegation and executive office')
      await expect(f.audited('delegate', `INSERT INTO ue_authority_acceptances(organization_id,instrument_type,instrument_id,accepted_by,accepted_at)
        VALUES($1,'delegation',$2,'delegate',now()+interval '1 hour')`, [f.org,delegation])).rejects.toThrow('ue_authority_acceptance_finite_time_chk')
      await f.audited('delegate', "INSERT INTO ue_authority_acceptances(organization_id,instrument_type,instrument_id,accepted_by) VALUES($1,'delegation',$2,'delegate')", [f.org,delegation])
      await expect(vote()).rejects.toThrow('live accepted delegation and executive office')
      expect((await f.pg.query('SELECT status FROM ue_authority_approval_requests WHERE id=$1',[request])).rows[0].status).toBe('open')
      await f.audited('president', "INSERT INTO ue_authority_acceptances(organization_id,instrument_type,instrument_id,accepted_by) VALUES($1,'mandate',$2,'president')", [f.org,office])
      await vote()
      expect((await f.pg.query('SELECT status FROM ue_authority_approval_requests WHERE id=$1',[request])).rows[0].status).toBe('satisfied')
    } finally { await f.pg.close() }
  }, 30000)

  it('refuses unaudited commits, direct event forgery and fabricated active rules, while retiring an inactive draft grants nothing', async () => {
    const f = await fixture()
    try {
      const ruleId = await f.draft()
      await expect(
        f.audited(
          'drafter',
          "UPDATE ue_authority_issuance_rules SET status='active',approved_by=ARRAY['approver-one','approver-two'],activated_at=now() WHERE id=$1",
          [ruleId],
        ),
      ).rejects.toThrow('RULE_ADOPTION_NOT_APPROVED')
      await f.audited(
        'drafter',
        "UPDATE ue_authority_issuance_rules SET status='retired',retired_at=now() WHERE id=$1",
        [ruleId],
      )
      expect(
        (
          await f.pg.query(
            'SELECT status,activated_at FROM ue_authority_issuance_rules WHERE id=$1',
            [ruleId],
          )
        ).rows,
      ).toEqual([{ status: 'retired', activated_at: null }])
      await f.pg.exec('BEGIN')
      await f.pg.query("SELECT set_config('app.current_user_id','drafter',true)")
      await f.pg.query(
        `INSERT INTO ue_authority_issuance_rules(organization_id,domain,operation,issuer_capacities,allowed_powers,version,source_instrument,drafted_by) VALUES($1,'case_assignment','issue',ARRAY['officer'],ARRAY['read'],2,'QA fixture','drafter')`,
        [f.org],
      )
      await expect(f.pg.exec('COMMIT')).rejects.toThrow('AUDIT_LINK_MISSING')
      await f.pg.exec('ROLLBACK')
      await expect(
        f.pg.query(
          "INSERT INTO ue_authority_events(organization_id,source_table,source_id,operation,row_after) VALUES($1,'ue_authority_mandates',$2,'INSERT','{}')",
          [f.org, randomUUID()],
        ),
      ).rejects.toThrow('recording trigger')
      const reviewed = planPhysicalGuards(
        contract,
        await inspectPhysicalGuards(contract, f.execute),
      )
      await f.pg.exec(
        'CREATE ROLE qa_guard_drift;GRANT SELECT ON ue_authority_issuance_rules TO qa_guard_drift',
      )
      await expect(applyPhysicalGuards(contract, f.execute, reviewed.fingerprint)).rejects.toThrow(
        'metadata drift',
      )
      await f.pg.exec('REVOKE SELECT ON ue_authority_issuance_rules FROM qa_guard_drift')
      await f.pg.exec(
        'ALTER TABLE ue_authority_approval_decisions DISABLE TRIGGER ue_authority_guard_decision',
      )
      expect((await physicalGuardViolations(contract, f.execute)).join()).toContain(
        'replacement refused',
      )
    } finally {
      await f.pg.close()
    }
  }, 30000)
})

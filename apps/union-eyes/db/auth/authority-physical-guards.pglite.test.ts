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

async function fixture() {
  const pg = new PGlite()
  await pg.exec(`CREATE ROLE ue_v2_owner;CREATE ROLE union_eyes_runtime;CREATE ROLE union_eyes_system;
 GRANT CREATE ON SCHEMA public TO ue_v2_owner;SET ROLE ue_v2_owner;`)
  const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
  for (const sql of [
    ...ddl.filter((s) => !s.startsWith('ALTER TABLE')),
    ...ddl.filter((s) => s.startsWith('ALTER TABLE')),
  ])
    await pg.exec(sql)
  for (const name of contract.tables)
    await pg.exec(
      `ALTER TABLE public."${name}" ENABLE ROW LEVEL SECURITY;ALTER TABLE public."${name}" FORCE ROW LEVEL SECURITY;`,
    )
  await pg.exec(
    `RESET ROLE;CREATE TABLE audit_logs(id uuid PRIMARY KEY,audit_id uuid UNIQUE NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,organization_id uuid,action varchar(100),resource_type varchar(255),resource_id varchar(255),user_id varchar(255),ip_address inet,user_agent text,correlation_id uuid,details jsonb DEFAULT '{}'::jsonb,changes jsonb DEFAULT '{}'::jsonb,content_hash varchar(64),previous_hash varchar(64));SET ROLE ue_v2_owner;`,
  )
  const execute = async (sql: string) => (await pg.query(sql)).rows as Record<string, unknown>[]
  const plan = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute))
  await pg.exec('BEGIN')
  await applyPhysicalGuards(contract, execute, plan.fingerprint)
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

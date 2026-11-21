/** Test-only actual canonical-auth and prospective reward source fixture.
 * PGlite security-context proof; no TCP LOGIN, native server or deployment claim. */
import { PGlite } from '@electric-sql/pglite'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { compileSyntheticAuthFixtureSql } from '../../scripts/bootstrap-v2/auth-fixture'
import { compileAuthBootstrapSql } from '../../scripts/bootstrap-v2/auth-sql'
import { compileMinimumRoleProvisioningSql } from '../../scripts/bootstrap-v2/minimum-installer'
import {
  reconcileCurrentAuthority,
  reconcileCurrentDeclarationAuthority,
} from '../../scripts/bootstrap-v2/current-authority'
import { compileSecurity } from '../../scripts/bootstrap-v2/security'
import type { V2Plan } from '../../scripts/bootstrap-v2/source'
import { REWARD_NOMINATION_GUARDS } from '../auth/reward-nomination-guards'
import { inspectPhysicalGuards, planPhysicalGuards } from '../auth/physical-guard-catalog'
import { compileAuthorityMembershipReaderSql } from '../../lib/authority/store/platform-identity'

export function createRewardsFixtureIds() {
  const org = randomUUID()
  const foreignOrg = randomUUID()
  const actor = 'rewards-canonical-nominator'
  const recipient = 'rewards-canonical-recipient'
  const bearer = 'synthetic-rewards-only-bearer'
  const program = randomUUID()
  const peerType = randomUUID()
  const adminType = randomUUID()
  const historyAward = randomUUID()
  const historyWallet = randomUUID()
  return {
    org,
    foreignOrg,
    actor,
    recipient,
    bearer,
    program,
    peerType,
    adminType,
    historyAward,
    historyWallet,
  }
}

export async function createRewardsBoundaryFixture(
  ids = createRewardsFixtureIds(),
  options: { withAudit?: boolean } = {},
) {
  const {
    org,
    foreignOrg,
    actor,
    recipient,
    bearer,
    program,
    peerType,
    adminType,
    historyAward,
    historyWallet,
  } = ids
  const sourcePlan = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as V2Plan
  const names = [
    'recognition_programs',
    'recognition_award_types',
    'recognition_awards',
    'reward_wallet_ledger',
    'reward_budget_envelopes',
    'reward_redemptions',
    'budget_reservations',
    'automation_rules',
    'shopify_config',
    'budget_pool',
    'award_templates',
    'award_history',
    'shopify_webhook_secret_versions',
    'webhook_receipts',
    'automation_execution_log',
  ]
  const history: Record<string, unknown> = {}
  const db = new PGlite()
  const installedNames = options.withAudit ? [...names, 'audit_logs'] : names

  function currentPlan(): V2Plan {
    return {
      ...sourcePlan,
      tables: sourcePlan.tables
        .filter((table) => installedNames.includes(table.name))
        .map((table) => {
          const model = sourcePlan.currentModels.models.find((model) => model.table === table.name)
          const inherited = model
            ? reconcileCurrentAuthority(model, table.authority)
            : table.authority
          return { ...table, authority: reconcileCurrentDeclarationAuthority(table, inherited) }
        }),
    }
  }

  async function runtime<T>(
    operation: () => Promise<T>,
    selected: string = org,
    token: string = bearer,
  ) {
    await db.exec(
      'SET SESSION AUTHORIZATION ue_rewards_fixture; BEGIN; SET LOCAL ROLE union_eyes_runtime',
    )
    try {
      await db.query(
        "SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true)",
        [actor, selected, token],
      )
      expect(
        (
          await db.query(
            'SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
          )
        ).rows,
      ).toEqual([
        {
          current_user: 'union_eyes_runtime',
          session_user: 'ue_rewards_fixture',
          rolsuper: false,
          rolbypassrls: false,
        },
      ])
      expect(
        (
          await db.query(
            'SELECT user_management.auth_business_org_authorized($1,NULL::text[]) AS authorized',
            [org],
          )
        ).rows,
      ).toEqual([{ authorized: selected === org && token === bearer }])
      const result = await operation()
      await db.exec('COMMIT')
      return result
    } catch (error) {
      await db.exec('ROLLBACK')
      throw error
    } finally {
      await db.exec('RESET ROLE; SET SESSION AUTHORIZATION postgres; RESET ROLE')
    }
  }
  async function system<T>(operation: () => Promise<T>) {
    // Effective restricted SQL role, not a TCP LOGIN/native application proof.
    await db.exec('BEGIN;SET LOCAL ROLE union_eyes_system')
    try {
      const result = await operation()
      await db.exec('COMMIT')
      return result
    } catch (error) {
      await db.exec('ROLLBACK')
      throw error
    } finally {
      await db.exec('RESET ROLE')
    }
  }
  const execute = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[]
  const preserved = async () => ({
    awards: (
      await db.query('SELECT to_jsonb(a) AS row FROM public.recognition_awards a WHERE id=$1', [
        historyAward,
      ])
    ).rows,
    wallet: (
      await db.query('SELECT to_jsonb(a) AS row FROM public.reward_wallet_ledger a WHERE id=$1', [
        historyWallet,
      ])
    ).rows,
  })
  async function nomination(overrides: Record<string, unknown> = {}) {
    const row = {
      id: randomUUID(),
      org_id: org,
      program_id: program,
      award_type_id: peerType,
      recipient_user_id: recipient,
      issuer_user_id: actor,
      reason: 'Thanks for helping a colleague',
      status: 'pending',
      metadata_json: { nomination: true },
      ...overrides,
    }
    const entries = Object.entries(row)
    return db.query(
      `INSERT INTO public.recognition_awards (${entries.map(([key]) => `"${key}"`).join(',')},created_at,updated_at)
    VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')},now(),now()) RETURNING id,status`,
      entries.map(([, value]) => value),
    )
  }

  try {
    await db.exec(compileMinimumRoleProvisioningSql({ postgresMajor: 16 }))
    await db.exec(compileSyntheticAuthFixtureSql())
    await db.exec(compileAuthBootstrapSql({ rolesPreprovisioned: true, postgresMajor: 16 }))
    await db.exec(compileAuthorityMembershipReaderSql())
    await db.exec(
      'CREATE ROLE ue_rewards_fixture LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; GRANT union_eyes_runtime TO ue_rewards_fixture WITH ADMIN FALSE,INHERIT FALSE,SET TRUE;',
    )
    for (const name of installedNames) {
      const declaration = sourcePlan.statements.filter((statement) =>
        new RegExp(`^CREATE TABLE (?:public\\.)?"${name}"(?:\\s|\\()`).test(statement.sql),
      )
      expect(declaration).toHaveLength(1)
      await db.exec(declaration[0].sql)
      for (const statement of sourcePlan.statements.filter((item) =>
        item.canonicalId.startsWith(`DJANGO_CURRENT_SERVER_DEFAULT:${name}:`),
      ))
        await db.exec(statement.sql)
      await db.exec(`ALTER TABLE public."${name}" OWNER TO ue_v2_owner`)
    }
    await db.query(
      `INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state) VALUES
    ($1,'nomination-actor@example.invalid',true,'active'),($2,'nomination-recipient@example.invalid',true,'active'),
    ('foreign-recipient','nomination-foreign@example.invalid',true,'active')`,
      [actor, recipient],
    )
    await db.query(
      `INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$3,'member',true),($2,$3,'member',true)`,
      [actor, recipient, org],
    )
    await db.query(
      `INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,expires_at,is_active)
    VALUES($1,$2,'synthetic-unusable-legacy-field',$3,now()+interval '1 hour',true)`,
      [actor, org, createHash('sha256').update(bearer).digest('hex')],
    )
    await db.query(
      "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES('foreign-recipient',$1,'member',true)",
      [foreignOrg],
    )
    await db.query(
      `INSERT INTO public.recognition_programs VALUES($1,now(),now(),$2,'Peer appreciation','Nonfinancial text selector','active','CAD')`,
      [program, org],
    )
    await db.query(
      `INSERT INTO public.recognition_award_types VALUES
    ($1,now(),now(),$3,$4,'Peer thanks','peer',500,true,'{"retainedFinancialRules":true}'),
    ($2,now(),now(),$3,$4,'Retained admin type','admin',999,true,NULL)`,
      [peerType, adminType, org, program],
    )
    await db.query(
      `INSERT INTO public.recognition_awards(id,created_at,updated_at,org_id,program_id,award_type_id,recipient_user_id,issuer_user_id,reason,status,approved_by_user_id,approved_at,issued_at,metadata_json)
    VALUES($1,now(),now(),$2,$3,$4,$5,'historical-issuer','Retained historical award','issued','historical-approver',now(),now(),'{"retainedCredits":42}')`,
      [historyAward, org, program, peerType, recipient],
    )
    await db.query(
      `INSERT INTO public.reward_wallet_ledger(id,created_at,updated_at,org_id,user_id,event_type,amount_credits,balance_after,source_type)
    VALUES($1,now(),now(),$2,$3,'earn',42,42,'award')`,
      [historyWallet, org, recipient],
    )
    await db.query(
      `INSERT INTO public.shopify_config(id,created_at,updated_at,org_id,shop_domain,storefront_token_secret_ref,webhook_secret_ref,allowed_collections)
    VALUES($1,now(),now(),$2,'synthetic-shop.example.invalid','env://SYNTHETIC_STOREFRONT_REF','env://SYNTHETIC_WEBHOOK_REF','[]')`,
      [randomUUID(), org],
    )
    await db.query(
      `INSERT INTO public.shopify_webhook_secret_versions(id,org_id,version,secret_ref,status,valid_from,created_by)
    VALUES($1,$2,1,'env://SYNTHETIC_VERSION_REF','active',now()-interval '1 hour','synthetic-admin')`,
      [randomUUID(), org],
    )
    // Retain an older permissive resource predicate. The additive trigger must
    // constrain forged rows even when this policy remains in an upgraded DB.
    await db.exec(`CREATE POLICY retained_legacy_reward_resource ON public.recognition_awards TO union_eyes_runtime
    USING(org_id::text=current_setting('app.current_org_id',true)) WITH CHECK(org_id::text=current_setting('app.current_org_id',true));
    GRANT SELECT(currency) ON public.recognition_programs TO union_eyes_runtime;
    GRANT UPDATE(approved_by_user_id) ON public.recognition_awards TO union_eyes_runtime;`)
    Object.assign(history, await preserved())
    await db.exec(compileSecurity(currentPlan()).statements.join('\n'))
    await db.exec('ALTER SCHEMA public OWNER TO ue_v2_owner;SET ROLE ue_v2_owner')
    try {
      const guards = planPhysicalGuards(
        REWARD_NOMINATION_GUARDS,
        await inspectPhysicalGuards(REWARD_NOMINATION_GUARDS, execute),
      )
      await db.exec(guards.statements.join('\n'))
    } finally {
      await db.exec('RESET ROLE')
    }

    return {
      db,
      sourcePlan,
      names,
      ...ids,
      history,
      currentPlan,
      runtime,
      system,
      execute,
      preserved,
      nomination,
    }
  } catch (error) {
    await db.close()
    throw error
  }
}

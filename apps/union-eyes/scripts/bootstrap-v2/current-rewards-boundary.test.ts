import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  reconcileCurrentAuthority,
  reconcileCurrentDeclarationAuthority,
} from './current-authority'
import { compileSecurity } from './security'
import {
  CURRENT_REWARDS_DECLARATION_OWNERS,
  CURRENT_REWARDS_MODEL_OWNERS,
  CURRENT_REWARDS_TABLES,
  REWARD_RUNTIME_COLUMN_CONTRACTS,
  REWARD_SIGNATURE_COLUMN_CONTRACTS,
} from './rewards-storage-contract'
import { REWARD_NOMINATION_GUARDS } from '../../db/auth/reward-nomination-guards'
import {
  inspectPhysicalGuards,
  physicalGuardViolations,
  planPhysicalGuards,
} from '../../db/auth/physical-guard-catalog'
import {
  createRewardsBoundaryFixture,
  createRewardsFixtureIds,
} from '../../db/__tests__/rewards-boundary-testkit'

type Fixture = Awaited<ReturnType<typeof createRewardsBoundaryFixture>>
const ids = createRewardsFixtureIds()
const { org, foreignOrg, actor, recipient, bearer, adminType, historyAward } = ids
let fixture: Fixture
let db: Fixture['db']
let sourcePlan: Fixture['sourcePlan']
let names: Fixture['names']
let history: Fixture['history']
let currentPlan: Fixture['currentPlan']
let runtime: Fixture['runtime']
let system: Fixture['system']
let execute: Fixture['execute']
let preserved: Fixture['preserved']
let nomination: Fixture['nomination']
beforeAll(async () => {
  fixture = await createRewardsBoundaryFixture(ids)
  ;({
    db,
    sourcePlan,
    names,
    history,
    currentPlan,
    runtime,
    system,
    execute,
    preserved,
    nomination,
  } = fixture)
}, 30000)
afterAll(async () => {
  await fixture?.db.close()
})

describe('prospective credit persistence boundary with actual canonical-session SQL', () => {
  it('denies a raw member credit mint rather than relying on a deferred HTTP/service surface', async () => {
    await expect(
      runtime(() =>
        db.query(
          `INSERT INTO public.reward_wallet_ledger
      (id,created_at,updated_at,org_id,user_id,event_type,amount_credits,balance_after,source_type)
      VALUES($1,now(),now(),$2,$3,'earn',999,999,'admin_adjustment')`,
          [randomUUID(), org, recipient],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    expect(
      (await db.query('SELECT count(*)::integer AS count FROM public.reward_wallet_ledger')).rows,
    ).toEqual([{ count: 1 }])
  })

  it('covers the exact actual declaration/model family and refuses owner/class substitutions', () => {
    expect(CURRENT_REWARDS_TABLES).toEqual([...names].sort())
    expect(Object.keys(CURRENT_REWARDS_MODEL_OWNERS)).toHaveLength(14)
    expect(Object.keys(CURRENT_REWARDS_DECLARATION_OWNERS)).toHaveLength(10)
    for (const model of sourcePlan.currentModels.models.filter((model) =>
      names.includes(model.table),
    )) {
      expect(model).toMatchObject(CURRENT_REWARDS_MODEL_OWNERS[model.table])
      for (const bad of [
        { ...model, source: 'unknown-owner' },
        { ...model, app: 'unrelated' },
        { ...model, model: 'unrelated' },
      ])
        expect(() =>
          reconcileCurrentAuthority(
            bad,
            model.table === 'automation_execution_log'
              ? null
              : sourcePlan.tables.find((table) => table.name === model.table)!.authority,
          ),
        ).toThrow('REWARDS_CURRENT_MODEL_REQUIRED')
    }
    expect(() =>
      reconcileCurrentDeclarationAuthority(
        {
          name: 'unknown_reward_table',
          source: 'apps/union-eyes/db/schema/domains/infrastructure/rewards.ts',
        },
        null,
      ),
    ).toThrow('REWARDS_CURRENT_SOURCE_REQUIRED')
    for (const table of currentPlan().tables)
      expect(() =>
        reconcileCurrentDeclarationAuthority(
          { ...table, source: 'unknown-owner' },
          table.authority,
        ),
      ).toThrow('REWARDS_CURRENT_SOURCE_REQUIRED')
  })

  it('emits no table powers for the whole family and exact projected columns on only five tables', async () => {
    const compiled = compileSecurity(currentPlan())
    expect(compiled.blockers).toEqual([])
    for (const rule of compiled.rules) {
      expect(rule.runtimePrivileges, rule.table).toEqual([])
      expect(rule.systemPrivileges, rule.table).toEqual([])
      const columns = REWARD_RUNTIME_COLUMN_CONTRACTS[rule.table]
      const signatures = REWARD_SIGNATURE_COLUMN_CONTRACTS[rule.table]
      expect(rule.runtimeColumnPrivileges ?? []).toEqual(
        columns
          ? [
              { privilege: 'SELECT', columns: [...columns.select] },
              ...(columns.insert ? [{ privilege: 'INSERT', columns: [...columns.insert] }] : []),
            ]
          : [],
      )
      expect(rule.systemSelectColumns ?? []).toEqual(signatures ? [...signatures] : [])
    }
    const facts = (
      await db.query<{
        table_name: string
        column_name: string
        role: string
        privilege: string
        allowed: boolean
      }>(
        `
      SELECT c.relname AS table_name,a.attname AS column_name,r.role,v.privilege,
        has_column_privilege(r.role,c.oid,a.attname,v.privilege) AS allowed
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum<>0 AND NOT a.attisdropped
      CROSS JOIN(VALUES('union_eyes_runtime'),('union_eyes_system')) r(role)
      CROSS JOIN(VALUES('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)
      WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,
        [names],
      )
    ).rows
    expect(facts.length).toBeGreaterThan(1500)
    for (const fact of facts) {
      const runtime = REWARD_RUNTIME_COLUMN_CONTRACTS[fact.table_name]
      const allowed =
        fact.role === 'union_eyes_runtime'
          ? fact.privilege === 'SELECT'
            ? runtime?.select.includes(fact.column_name)
            : fact.privilege === 'INSERT'
              ? runtime?.insert?.includes(fact.column_name)
              : false
          : fact.privilege === 'SELECT' &&
            REWARD_SIGNATURE_COLUMN_CONTRACTS[fact.table_name]?.includes(fact.column_name)
      expect(
        fact.allowed,
        `${fact.role}:${fact.table_name}.${fact.column_name}:${fact.privilege}`,
      ).toBe(Boolean(allowed))
    }
    const tables = (
      await db.query<{ allowed: boolean }>(
        `SELECT has_table_privilege(r.role,c.oid,v.privilege) AS allowed
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN(VALUES('union_eyes_runtime'),('union_eyes_system')) r(role)
      CROSS JOIN(VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
      WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,
        [names],
      )
    ).rows
    expect(tables).toHaveLength(210)
    expect(tables.every((fact) => fact.allowed === false)).toBe(true)
  })

  it('preserves only signature routing/reference reads and denies extra config, system/runtime writes and receipts', async () => {
    expect(
      (await system(() => db.query('SELECT org_id,shop_domain FROM public.shopify_config'))).rows,
    ).toHaveLength(1)
    expect(
      (
        await system(() =>
          db.query(
            "SELECT secret_ref FROM public.shopify_webhook_secret_versions WHERE org_id=$1 AND status='active' AND valid_from<now() AND valid_until IS NULL",
            [org],
          ),
        )
      ).rows,
    ).toHaveLength(1)
    for (const sql of [
      'SELECT storefront_token_secret_ref FROM public.shopify_config',
      'SELECT webhook_secret_ref FROM public.shopify_config',
      'SELECT created_by FROM public.shopify_webhook_secret_versions',
      "UPDATE public.shopify_webhook_secret_versions SET secret_ref='env://FORGED'",
      'DELETE FROM public.shopify_config',
      'SELECT webhook_id FROM public.webhook_receipts',
      'INSERT INTO public.shopify_config(org_id) VALUES(gen_random_uuid())',
    ])
      await expect(system(() => db.query(sql))).rejects.toMatchObject({ code: '42501' })
    await expect(
      runtime(() => db.query('SELECT shop_domain FROM public.shopify_config')),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('stores one pending nonfinancial nomination under the actual original canonical actor', async () => {
    const result = await runtime(() => nomination())
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ status: 'pending' })
    await expect(runtime(() => nomination())).rejects.toThrow('PENDING_PEER_NOMINATION_LIMIT')
    for (const field of ['currency'])
      await expect(
        runtime(() => db.query(`SELECT ${field} FROM public.recognition_programs`)),
      ).rejects.toMatchObject({ code: '42501' })
    for (const field of ['default_credit_amount', 'requires_approval', 'rules_json'])
      await expect(
        runtime(() => db.query(`SELECT ${field} FROM public.recognition_award_types`)),
      ).rejects.toMatchObject({ code: '42501' })
    for (const field of ['approved_by_user_id', 'approved_at', 'issued_at', 'metadata_json'])
      await expect(
        runtime(() => db.query(`SELECT ${field} FROM public.recognition_awards`)),
      ).rejects.toMatchObject({ code: '42501' })
  })

  it.each([
    ['forged issuer', { issuer_user_id: 'forged-actor' }],
    ['self nomination', { recipient_user_id: actor }],
    ['foreign recipient', { recipient_user_id: 'foreign-recipient' }],
    ['unknown recipient', { recipient_user_id: 'absent' }],
    ['issued status', { status: 'issued' }],
    ['approved status', { status: 'approved' }],
    ['credit metadata', { metadata_json: { nomination: true, creditAmount: 999 } }],
    ['admin type', { award_type_id: adminType }],
    ['unknown program', { program_id: randomUUID() }],
  ])('refuses %s even with the retained permissive resource policy', async (_, fields) => {
    await expect(runtime(() => nomination(fields))).rejects.toMatchObject({ code: '42501' })
  })

  it('fails closed for missing selected organization, foreign selection and a copied/fabricated bearer', async () => {
    for (const [selected, token] of [
      ['', bearer],
      [foreignOrg, bearer],
      [org, 'forged-bearer'],
    ])
      await expect(runtime(() => nomination(), selected, token)).rejects.toMatchObject({
        code: '42501',
      })
  })

  it('rechecks current recipient membership without raw auth reads or identity substitution', async () => {
    await db.query(
      'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2',
      [recipient, org],
    )
    try {
      await expect(runtime(() => nomination())).rejects.toThrow(
        'LIVE_CANONICAL_NOMINATION_MEMBERS_REQUIRED',
      )
    } finally {
      await db.query(
        'UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1 AND organization_id=$2',
        [recipient, org],
      )
    }
    await expect(
      runtime(() => db.query('SELECT user_id FROM user_management.organization_users')),
    ).rejects.toMatchObject({ code: '42501' })
  })

  it('refuses archived peer programs and raw insert attempts beyond the existing ten-pending limit', async () => {
    await db.query("UPDATE public.recognition_programs SET status='archived' WHERE id=$1", [
      ids.program,
    ])
    try {
      await expect(runtime(() => nomination())).rejects.toThrow(
        'ACTIVE_PEER_NOMINATION_TYPE_REQUIRED',
      )
    } finally {
      await db.query("UPDATE public.recognition_programs SET status='active' WHERE id=$1", [
        ids.program,
      ])
    }
    for (let index = 1; index < 10; index++) {
      const person = `bounded-nomination-recipient-${index}`
      await db.query(
        "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state) VALUES($1,$2,true,'active')",
        [person, `${person}@example.invalid`],
      )
      await db.query(
        "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,'member',true)",
        [person, org],
      )
      await runtime(() => nomination({ recipient_user_id: person }))
    }
    await expect(runtime(() => nomination({ award_type_id: adminType }))).rejects.toThrow(
      'ACTIVE_PEER_NOMINATION_TYPE_REQUIRED',
    )
    const extra = 'bounded-nomination-recipient-extra'
    await db.query(
      "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state) VALUES($1,'nomination-extra@example.invalid',true,'active')",
      [extra],
    )
    await db.query(
      "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,'member',true)",
      [extra, org],
    )
    await expect(runtime(() => nomination({ recipient_user_id: extra }))).rejects.toThrow(
      'PENDING_PEER_NOMINATION_LIMIT',
    )
    expect(
      (
        await db.query(
          "SELECT count(*)::integer AS count FROM public.recognition_awards WHERE issuer_user_id=$1 AND status='pending'",
          [actor],
        )
      ).rows,
    ).toEqual([{ count: 10 }])
  })

  it('physically denies approval/issuance and history mutation under deliberate ACL drift', async () => {
    await db.exec(
      'GRANT INSERT(approved_by_user_id,approved_at,issued_at),UPDATE,DELETE ON public.recognition_awards TO union_eyes_runtime',
    )
    try {
      for (const fields of [
        { approved_by_user_id: actor },
        { approved_at: new Date() },
        { issued_at: new Date() },
      ])
        await expect(runtime(() => nomination(fields))).rejects.toThrow(
          'PENDING_PEER_NOMINATION_REQUIRED',
        )
      await expect(
        runtime(() =>
          db.query("UPDATE public.recognition_awards SET status='approved' WHERE id=$1", [
            historyAward,
          ]),
        ),
      ).rejects.toThrow('REWARD_NOMINATION_HISTORY_IMMUTABLE')
      await expect(
        runtime(() =>
          db.query('DELETE FROM public.recognition_awards WHERE id=$1', [historyAward]),
        ),
      ).rejects.toThrow('REWARD_NOMINATION_HISTORY_IMMUTABLE')
    } finally {
      await db.exec(
        'REVOKE INSERT(approved_by_user_id,approved_at,issued_at),UPDATE,DELETE ON public.recognition_awards FROM union_eyes_runtime',
      )
    }
  })

  it('strictly inspects the additive guard, rejects disabled triggers and preserves every retained reward/history field', async () => {
    expect(await physicalGuardViolations(REWARD_NOMINATION_GUARDS, execute)).toEqual([])
    expect(
      planPhysicalGuards(
        REWARD_NOMINATION_GUARDS,
        await inspectPhysicalGuards(REWARD_NOMINATION_GUARDS, execute),
      ).statements,
    ).toEqual([])
    await db.exec(
      'BEGIN;ALTER TABLE public.recognition_awards DISABLE TRIGGER ue_reward_nomination_guard',
    )
    try {
      expect(await physicalGuardViolations(REWARD_NOMINATION_GUARDS, execute)).not.toEqual([])
    } finally {
      await db.exec('ROLLBACK')
    }
    expect(await preserved()).toEqual(history)
    expect(
      (
        await db.query(
          "SELECT count(*)::integer AS count FROM pg_policy WHERE polname='retained_legacy_reward_resource'",
        )
      ).rows,
    ).toEqual([{ count: 1 }])
  })
})

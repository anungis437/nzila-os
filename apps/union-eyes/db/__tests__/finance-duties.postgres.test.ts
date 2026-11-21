/** Base-release financial boundaries on an owned canonical PG15/16 clone.
 * Financial/dues persistence is deferred. These are denial and preservation
 * tests, not approval/adoption, financial feature, staging or release proof.
 * Opting in requires the actual per-clone restricted LOGIN and auth URLs.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type pg from 'pg'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { withNativeCanonicalActor } from '@/scripts/runtime/native-canonical-fixture'
import { canonicalMembershipRole } from '@/lib/auth/canonical-membership-role'
import { withCanonicalRequestScope } from '@/lib/auth/canonical-request-scope'
import { insertOrganization } from './page-reads-seed'
import { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } from './native-savepoint-harness'
import { BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS } from '@/scripts/bootstrap-v2/current-authority'
import { MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS } from '@/scripts/bootstrap-v2/module-admission-storage-contract'
import {
  CURRENT_REWARDS_TABLES,
  REWARD_RUNTIME_COLUMN_CONTRACTS,
  REWARD_SIGNATURE_COLUMN_CONTRACTS,
} from '@/scripts/bootstrap-v2/rewards-storage-contract'
import type { V2Plan } from '@/scripts/bootstrap-v2/source'
import {
  performFinancialDuty,
  readFinancialTransaction,
  requireFinancialDuty,
} from '@/lib/authority/store/finance-route-adapter'
import { recordArrearsPayment } from '@/lib/dues/arrears-payment'
import type { RLSTx } from '@/lib/db/with-rls-context'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const plan = JSON.parse(
  readFileSync(
    new globalThis.URL(
      '../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as V2Plan
const overlay = JSON.parse(
  readFileSync(
    new globalThis.URL('../../lib/operations/catalog-v2-decisions.json', import.meta.url),
    'utf8',
  ),
) as {
  currentSecurity: {
    currentFunctions: Array<{ owner: string }>
    dedicatedRolePrivileges: Array<{ role: string }>
  }
}
const billing = plan.currentModels.models.filter(
  (model) =>
    model.app === 'billing' && model.source === 'apps/union-eyes/backend/billing/models.py',
)
const finance = [
  ...new Set([
    ...billing.map((model) => model.table),
    ...Object.keys(BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS),
  ]),
].sort()
const credit = CURRENT_REWARDS_TABLES.filter(
  (table) =>
    !Object.hasOwn(REWARD_RUNTIME_COLUMN_CONTRACTS, table) &&
    !Object.hasOwn(REWARD_SIGNATURE_COLUMN_CONTRACTS, table),
)
const financialWorkflow = ['ue_authority_financial_steps']
const contained = [...finance, ...credit, ...financialWorkflow].sort()
const requiredAuth = plan.authExecution
if (!requiredAuth) throw new Error('Current source canonical auth execution contract required')
const principals = [
  ...new Set([
    RUNTIME_ROLE,
    SYSTEM_ROLE,
    ...requiredAuth.roles,
    ...overlay.currentSecurity.currentFunctions.map((fn) => fn.owner),
    ...overlay.currentSecurity.dedicatedRolePrivileges.map((grant) => grant.role),
  ]),
]
  .filter((role) => role !== 'ue_v2_owner')
  .sort()
const quote = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Source-owned SQL identifier required')
  return `"${name}"`
}
function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = error as { code?: string; cause?: unknown }
  return value.code ?? errorCode(value.cause)
}

function actualRows(value: unknown): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
  )
    throw new Error('Actual native postgres-js row-array adapter required')
  return value as Record<string, unknown>[]
}

describe.skipIf(!URL)('deferred finance has no native storage or duty powers', () => {
  let operator: pg.Client
  const org = randomUUID(),
    foreignOrg = randomUUID(),
    actor = `finance-boundary-${randomUUID()}`
  const ownAdmission = randomUUID(),
    foreignAdmission = randomUUID()
  const asActor = <T>(operation: () => Promise<T>) =>
    withNativeCanonicalActor(actor, org, (binding) =>
      withCanonicalRequestScope(
        binding,
        {
          userId: binding.userId,
          organizationId: binding.organizationId,
          role: canonicalMembershipRole(binding.role, false),
          email: `${actor}@example.invalid`,
          firstName: null,
          lastName: null,
          isSystemAdmin: false,
        },
        operation,
      ),
    )
  const history = async () => {
    const result: Record<string, unknown> = {}
    for (const table of [
      ...contained,
      ...Object.keys(MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS),
      'audit_logs',
    ]) {
      result[table] = (
        await operator.query(`SELECT count(*)::text AS count,
        md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest
        FROM public.${quote(table)} AS t`)
      ).rows[0]
    }
    return result
  }
  beforeAll(async () => {
    expect(
      process.env.UE_CANONICAL_BOOTSTRAP_V2,
      'Opted-in native tests require current canonical source',
    ).toBe('1')
    operator = await savepointHarness.start(URL!) // rejects any operator action fallback
    await insertOrganization(operator, randomUUID().slice(0, 8), { id: org })
    await insertOrganization(operator, randomUUID().slice(0, 8), { id: foreignOrg })
    await operator.query(
      "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin) VALUES($1,$2,true,'active',false)",
      [actor, `${actor}@example.invalid`],
    )
    await operator.query(
      "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,'secretary_treasurer',true)",
      [actor, org],
    )
    for (const [id, organization] of [
      [ownAdmission, org],
      [foreignAdmission, foreignOrg],
    ])
      await operator.query(
        `INSERT INTO public.org_entitlements
        (id,organization_id,feature_key,status,granted_at,current_usage,created_at,updated_at)
        VALUES($1,$2,'grievance_case_suite','active',now(),0,now(),now())`,
        [id, organization],
      )
  })
  afterAll(async () => {
    await savepointHarness.stop()
    await operator?.end()
  })

  it('uses the complete reviewed source family rather than historical positive finance expectations', () => {
    expect(billing).toHaveLength(81)
    expect(Object.keys(BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS)).toHaveLength(8)
    expect(finance).toHaveLength(89)
    expect(credit).toHaveLength(10)
    expect(financialWorkflow).toEqual(['ue_authority_financial_steps'])
    expect(new Set(contained).size).toBe(100)
    expect(
      Object.keys(MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS).some((name) =>
        contained.includes(name),
      ),
    ).toBe(false)
    for (const name of contained) {
      const table = plan.tables.find((table) => table.name === name)
      expect(table, name).toBeDefined()
      expect(table!.authority?.requiredRuntimePrivileges, name).toEqual([])
      expect(table!.authority?.requiredSystemPrivileges, name).toEqual([])
    }
  })

  it('keeps exactly17 own-org SaaS admission columns separate from finance, with no monetary fields, mutation or SYSTEM powers', async () => {
    expect(
      Object.values(MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS).flatMap((spec) => spec.select),
    ).toHaveLength(17)
    for (const [table, spec] of Object.entries(MODULE_ADMISSION_RUNTIME_COLUMN_CONTRACTS)) {
      const rows = (
        await operator.query(
          `SELECT a.attname::text AS name,
        has_column_privilege('union_eyes_runtime',a.attrelid,a.attnum,'SELECT') AS runtime_select,
        has_column_privilege('union_eyes_runtime',a.attrelid,a.attnum,'SELECT WITH GRANT OPTION') AS grantable,
        EXISTS(SELECT FROM unnest(ARRAY['INSERT','UPDATE','REFERENCES']) privilege
          WHERE has_column_privilege('union_eyes_runtime',a.attrelid,a.attnum,privilege)) AS runtime_write,
        EXISTS(SELECT FROM unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) privilege
          WHERE has_column_privilege('union_eyes_system',a.attrelid,a.attnum,privilege)) AS system_any
        FROM pg_catalog.pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum<>0 AND NOT a.attisdropped ORDER BY 1`,
          [`public.${table}`],
        )
      ).rows
      expect(
        rows.filter((row) => row.runtime_select).map((row) => row.name),
        table,
      ).toEqual([...spec.select].sort())
      expect(
        rows.some((row) => row.grantable || row.runtime_write || row.system_any),
        table,
      ).toBe(false)
      for (const role of [RUNTIME_ROLE, SYSTEM_ROLE])
        for (const privilege of [
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER',
        ])
          expect(
            (
              await operator.query('SELECT has_table_privilege($1,$2::regclass,$3) AS allowed', [
                role,
                `public.${table}`,
                privilege,
              ])
            ).rows[0].allowed,
          ).toBe(false)
    }
    const before = await history()
    await asActor(() =>
      savepointHarness.context(RUNTIME_ROLE, org, actor, async (tx) => {
        const rows = actualRows(
          await tx.execute(sql`SELECT id::text AS id FROM public.org_entitlements
        WHERE id IN (${ownAdmission}::uuid,${foreignAdmission}::uuid)`),
        )
        expect(rows).toEqual([{ id: ownAdmission }])
      }),
    )
    await savepointHarness.context(RUNTIME_ROLE, null, actor, async (tx) => {
      const rows = actualRows(
        await tx.execute(
          sql`SELECT id FROM public.org_entitlements WHERE id=${ownAdmission}::uuid`,
        ),
      )
      expect(rows).toEqual([])
    })
    expect(await history()).toEqual(before)
  })

  it('has zero effective table and ordinary/system-column powers for runtime, system and every current private source principal', async () => {
    const rows = (
      await operator.query(
        `WITH wanted AS (
        SELECT c.oid,c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY($1::text[])
      ) SELECT role.rolname::text AS role,wanted.relname::text AS table,
        ARRAY(SELECT privilege FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege
          WHERE has_table_privilege(role.oid,wanted.oid,privilege)) AS table_powers,
        ARRAY(SELECT a.attname::text||':'||privilege FROM pg_catalog.pg_attribute a
          CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) privilege
          WHERE a.attrelid=wanted.oid AND a.attnum<>0 AND NOT a.attisdropped
          AND has_column_privilege(role.oid,wanted.oid,a.attnum,privilege) ORDER BY 1) AS column_powers
      FROM wanted CROSS JOIN pg_catalog.pg_roles role WHERE role.rolname=ANY($2::text[]) ORDER BY 1,2`,
        [contained, principals],
      )
    ).rows
    expect(rows).toHaveLength(contained.length * principals.length)
    for (const row of rows) {
      expect(row.table_powers, `${row.role}.${row.table}`).toEqual([])
      expect(row.column_powers, `${row.role}.${row.table}`).toEqual([])
    }
  })

  it.each([RUNTIME_ROLE, SYSTEM_ROLE])(
    'denies actual %s SQL reads and writes under a restricted LOGIN without changing any retained row',
    async (role) => {
      const before = await history()
      await asActor(() =>
        savepointHarness.context(
          role,
          role === RUNTIME_ROLE ? org : null,
          role === RUNTIME_ROLE ? actor : null,
          async (tx) => {
            const rows = actualRows(
              await tx.execute(sql`SELECT current_user,session_user,rolsuper,rolbypassrls,
        current_setting('app.current_org_id',true) AS selected_org
        FROM pg_catalog.pg_roles WHERE rolname=current_user`),
            )
            expect(rows[0]).toMatchObject({
              current_user: role,
              rolsuper: false,
              rolbypassrls: false,
            })
            expect(rows[0].session_user).toMatch(
              new RegExp(`^ue_native_[a-z0-9_]+_${role === RUNTIME_ROLE ? 'runtime' : 'system'}$`),
            )
            if (role === RUNTIME_ROLE) {
              const context = actualRows(
                await tx.execute(sql`SELECT
                user_management.auth_business_org_authorized(${org}::uuid,NULL::text[]) AS live_context`),
              )
              expect(context).toEqual([{ live_context: true }])
            } else {
              // SYSTEM has no source-authorized user_management namespace or
              // business-predicate EXECUTE. It is measured as its own real
              // restricted principal, never granted that authority for a test.
              expect(rows[0].selected_org).toBe('')
            }
            for (const table of contained) {
              const sourceColumn = plan.tables.find((candidate) => candidate.name === table)!
                .columns[0].name
              for (const statement of [
                `SELECT * FROM public.${quote(table)} LIMIT 0`,
                `INSERT INTO public.${quote(table)} DEFAULT VALUES`,
                `UPDATE public.${quote(table)} SET ${quote(sourceColumn)}=${quote(sourceColumn)} WHERE false`,
                `DELETE FROM public.${quote(table)} WHERE false`,
              ]) {
                await tx.execute(sql.raw('SAVEPOINT finance_no_power'))
                try {
                  const error = await tx.execute(sql.raw(statement)).then(
                    () => null,
                    (error: unknown) => error,
                  )
                  expect(errorCode(error), `${role}:${table}:${statement.split(' ')[0]}`).toBe(
                    '42501',
                  )
                } finally {
                  await tx.execute(sql.raw('ROLLBACK TO SAVEPOINT finance_no_power'))
                }
              }
            }
          },
        ),
      )
      expect(await history()).toEqual(before)
    },
    120000,
  )

  it('refuses duties and dues posting before business callbacks, financial persistence or business audit', async () => {
    const before = await history()
    let businessCalls = 0
    const paymentId = randomUUID()
    const attempts: Array<(tx: RLSTx) => Promise<unknown>> = [
      (tx: RLSTx) =>
        readFinancialTransaction(tx, {
          userId: actor,
          organizationId: org,
          transactionId: paymentId,
        }),
      (tx: RLSTx) =>
        requireFinancialDuty(tx, {
          userId: actor,
          organizationId: org,
          transactionId: paymentId,
          action: 'finance:approve',
        }),
      (tx: RLSTx) =>
        performFinancialDuty(
          tx,
          {
            userId: actor,
            organizationId: org,
            transactionId: paymentId,
            step: 'registered',
            accountId: randomUUID(),
            requiredApprovals: 1,
          },
          async () => {
            businessCalls++
            return {
              result: null,
              audit: {
                action: 'must.not.execute',
                resourceType: 'payments',
                resourceId: paymentId,
              },
            }
          },
        ),
      (tx: RLSTx) =>
        recordArrearsPayment(tx, {
          userId: actor,
          organizationId: org,
          memberId: actor,
          paymentId,
          amount: 10,
        }),
    ]
    for (const attempt of attempts) {
      const error = await asActor(() =>
        savepointHarness.context(RUNTIME_ROLE, org, actor, (tx) => attempt(tx as unknown as RLSTx)),
      ).then(
        () => null,
        (error: unknown) => error,
      )
      expect(error).toMatchObject({
        name: 'BaseFinancialCapabilityUnavailable',
        code: 'NOT_IMPLEMENTED',
        status: 501,
      })
    }
    expect(businessCalls).toBe(0)
    expect(await history()).toEqual(before)
  })
})

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseSql } from '../../scripts/lib/sql-census/parse'
import {
  LEGACY_REWARDS_SIGNATURE_POLICY_QUERY,
  planLegacyRewardsSignaturePolicyRetirement,
  type ExistingFrameworkPolicy,
} from '../../../../tooling/scripts/lib/union-eyes-current-security-preimage'

const root = path.resolve(import.meta.dirname, '../../../..')
let db: PGlite
const inspect = async () => (await db.query<ExistingFrameworkPolicy>(LEGACY_REWARDS_SIGNATURE_POLICY_QUERY)).rows

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE ROLE union_eyes_runtime NOLOGIN; CREATE ROLE union_eyes_system NOLOGIN;
    CREATE TABLE public.shopify_webhook_secret_versions(id uuid PRIMARY KEY,org_id uuid,secret_ref text);
    INSERT INTO public.shopify_webhook_secret_versions VALUES
      ('ea550000-0000-4000-8000-000000000001','ea550000-0000-4000-8000-000000000002','env://UE_SHOPIFY_SYNTHETIC');
    ALTER TABLE public.shopify_webhook_secret_versions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.shopify_webhook_secret_versions FORCE ROW LEVEL SECURITY;`)
  const source = readFileSync(path.join(root, 'apps/union-eyes/db/migrations-platform/0088_gate0_checkout_and_payroll_integrity.sql'), 'utf8')
  const parsed = await parseSql(source)
  expect(parsed.ok).toBe(true)
  const policies = parsed.statements.flatMap((statement, index) => statement.CreatePolicyStmt?.table.relname === 'shopify_webhook_secret_versions'
    ? [parsed.texts[index]] : [])
  expect(policies).toHaveLength(2)
  for (const policy of policies) await db.exec(policy)
}, 60000)
beforeEach(async () => { await db.exec('BEGIN') })
afterEach(async () => { await db.exec('ROLLBACK') })
afterAll(async () => { await db?.close() })

describe('source-admitted legacy signature policy retirement', () => {
  it('removes only the exact old tenant policy, preserving signature-system policy and every stored field', async () => {
    const before = (await db.query('SELECT * FROM public.shopify_webhook_secret_versions')).rows
    const facts = await inspect()
    expect(facts).toHaveLength(1)
    expect((await db.query(LEGACY_REWARDS_SIGNATURE_POLICY_QUERY)).fields.find(field => field.name === 'roles')?.dataTypeID).toBe(1009)
    const plan = await planLegacyRewardsSignaturePolicyRetirement(root, facts)
    expect(plan).toEqual(['DROP POLICY "shopify_webhook_secret_versions_tenant_policy" ON public."shopify_webhook_secret_versions"'])
    expect(await inspect()).toEqual(facts)
    for (const statement of plan) await db.exec(statement)
    expect(await inspect()).toEqual([])
    expect((await db.query('SELECT * FROM public.shopify_webhook_secret_versions')).rows).toEqual(before)
    expect((await db.query("SELECT polname FROM pg_policy WHERE polrelid='public.shopify_webhook_secret_versions'::regclass")).rows)
      .toEqual([{ polname: 'shopify_webhook_secret_versions_system_read' }])
  })

  it.each([
    "ALTER POLICY shopify_webhook_secret_versions_tenant_policy ON public.shopify_webhook_secret_versions TO PUBLIC",
    "ALTER POLICY shopify_webhook_secret_versions_tenant_policy ON public.shopify_webhook_secret_versions USING (true)",
    "ALTER POLICY shopify_webhook_secret_versions_tenant_policy ON public.shopify_webhook_secret_versions WITH CHECK (true)",
    "CREATE POLICY unexpected_tenant ON public.shopify_webhook_secret_versions TO union_eyes_runtime USING (true)",
    "DROP POLICY shopify_webhook_secret_versions_tenant_policy ON public.shopify_webhook_secret_versions",
  ])('refuses changed or incomplete released authority: %s', async mutation => {
    await db.exec(mutation)
    await expect(planLegacyRewardsSignaturePolicyRetirement(root, await inspect())).rejects.toThrow()
  })

  it('refuses a same-name policy moved to a different execution role', async () => {
    await db.exec('ALTER POLICY shopify_webhook_secret_versions_tenant_policy ON public.shopify_webhook_secret_versions TO union_eyes_system')
    await expect(planLegacyRewardsSignaturePolicyRetirement(root, await inspect())).rejects.toThrow()
  })
})

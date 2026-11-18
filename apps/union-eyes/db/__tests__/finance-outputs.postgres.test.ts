/** Deferred exports and exact signature-auth metadata on an owned native clone.
 * No positive finance export/credit feature is qualified by these denials.
 * Real canonical sessions and separate restricted LOGINs are mandatory on opt-in.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import type pg from 'pg'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { canonicalMembershipRole } from '@/lib/auth/canonical-membership-role'
import {
  currentCanonicalRequest,
  withCanonicalRequestScope,
} from '@/lib/auth/canonical-request-scope'
import { withNativeCanonicalActor } from '@/scripts/runtime/native-canonical-fixture'
import { insertOrganization } from './page-reads-seed'
import { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } from './native-savepoint-harness'
import { REWARD_SIGNATURE_COLUMN_CONTRACTS } from '@/scripts/bootstrap-v2/rewards-storage-contract'

vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => {
  const { currentCanonicalRequest } = await import('@/lib/auth/canonical-request-scope')
  const { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } = await import('./native-savepoint-harness')
  return {
    withRLSContext: <T>(scope: { organizationId: string }, work: (tx: unknown) => Promise<T>) => {
      const current = currentCanonicalRequest({ organizationId: scope.organizationId })
      if (!current) throw new Error('Actual canonical native request required')
      return savepointHarness.context(
        RUNTIME_ROLE,
        scope.organizationId,
        current.binding.userId,
        work,
      )
    },
    withSystemContext: <T>(work: (tx: unknown) => Promise<T>) =>
      savepointHarness.context(SYSTEM_ROLE, null, null, work),
  }
})
const URL = process.env.UE_AUTHORITY_COMBINED_URL
const outputs = URL ? await import('@/services/platform-economics/finance-outputs') : null
const webhook = URL ? await import('@/lib/services/rewards/webhook-service') : null
const quote = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Source-owned identifier required')
  return `"${name}"`
}
const secretName = 'UE_SHOPIFY_NATIVE_FINANCE_SIGNATURE'

function actualRows(value: unknown): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
  )
    throw new Error('Actual native postgres-js row-array adapter required')
  return value as Record<string, unknown>[]
}

describe.skipIf(!URL)('deferred native exports preserve signature verification only', () => {
  let operator: pg.Client
  const org = randomUUID(),
    actor = `export-native-${randomUUID()}`,
    shop = `synthetic-${randomUUID()}.example.invalid`
  const originalSecret = process.env[secretName]
  const secret = randomBytes(32).toString('hex')
  const asActor = <T>(work: () => Promise<T>) =>
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
        work,
      ),
    )
  const history = async () => {
    const result: Record<string, unknown> = {}
    for (const table of [
      'shopify_config',
      'shopify_webhook_secret_versions',
      'webhook_receipts',
      'platform_invoices',
      'platform_cost_ledger_entries',
      'allocation_runs',
      'audit_logs',
    ])
      result[table] = (
        await operator.query(`SELECT count(*)::text AS count,
        md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM public.${quote(table)} t`)
      ).rows[0]
    return result
  }
  beforeAll(async () => {
    expect(process.env.UE_CANONICAL_BOOTSTRAP_V2, 'Opt-in requires canonical source').toBe('1')
    operator = await savepointHarness.start(URL!)
    await insertOrganization(operator, randomUUID().slice(0, 8), { id: org })
    await operator.query(
      "INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin) VALUES($1,$2,true,'active',false)",
      [actor, `${actor}@example.invalid`],
    )
    await operator.query(
      "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES($1,$2,'secretary_treasurer',true)",
      [actor, org],
    )
    await operator.query(
      `INSERT INTO public.shopify_config(id,created_at,updated_at,org_id,shop_domain,storefront_token_secret_ref,webhook_secret_ref,allowed_collections)
      VALUES($1,now(),now(),$2,$3,'env://UE_SHOPIFY_UNUSED_STOREFRONT','env://UE_SHOPIFY_UNUSED_WEBHOOK','[]')`,
      [randomUUID(), org, shop],
    )
    await operator.query(
      `INSERT INTO public.shopify_webhook_secret_versions(id,org_id,version,secret_ref,status,valid_from,created_by)
      VALUES($1,$2,1,$3,'active',now()-interval '1 hour',$4)`,
      [randomUUID(), org, `env://${secretName}`, actor],
    )
    process.env[secretName] = secret
  })
  afterAll(async () => {
    if (originalSecret === undefined) delete process.env[secretName]
    else process.env[secretName] = originalSecret
    await savepointHarness.stop()
    await operator?.end()
  })

  it('retains exact signature-auth SELECT columns and zero table/writer grants', async () => {
    for (const [table, allowed] of Object.entries(REWARD_SIGNATURE_COLUMN_CONTRACTS)) {
      const rows = (
        await operator.query(
          `SELECT a.attname::text AS name,
        has_column_privilege('union_eyes_system',a.attrelid,a.attnum,'SELECT') AS system_select,
        has_column_privilege('union_eyes_system',a.attrelid,a.attnum,'SELECT WITH GRANT OPTION') AS grantable,
        EXISTS(SELECT FROM unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) privilege
          WHERE has_column_privilege('union_eyes_runtime',a.attrelid,a.attnum,privilege)) AS runtime_any,
        has_column_privilege('union_eyes_system',a.attrelid,a.attnum,'INSERT') OR
        has_column_privilege('union_eyes_system',a.attrelid,a.attnum,'UPDATE') OR
        has_column_privilege('union_eyes_system',a.attrelid,a.attnum,'REFERENCES') AS writer
        FROM pg_catalog.pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum<>0 AND NOT a.attisdropped ORDER BY 1`,
          [`public.${table}`],
        )
      ).rows
      expect(rows.filter((row) => row.system_select).map((row) => row.name)).toEqual(
        [...allowed].sort(),
      )
      expect(rows.some((row) => row.runtime_any || row.writer || row.grantable)).toBe(false)
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
  })

  it('uses the actual restricted SYSTEM LOGIN to authenticate current configured HMACs without reading credits or creating receipts', async () => {
    const before = await history()
    await savepointHarness.context(SYSTEM_ROLE, null, null, async (tx) => {
      const rows = actualRows(
        await tx.execute(
          sql`SELECT current_user,session_user,rolsuper,rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user`,
        ),
      )
      expect(rows[0]).toMatchObject({
        current_user: SYSTEM_ROLE,
        rolsuper: false,
        rolbypassrls: false,
      })
      expect(rows[0].session_user).toMatch(/^ue_native_[a-z0-9_]+_system$/)
    })
    const authority = await webhook!.resolveShopWebhookAuthority(shop)
    expect(authority?.organizationId).toBe(org)
    expect(authority?.shopDomain).toBe(shop)
    const body = '{"synthetic":true}'
    const signature = createHmac('sha256', secret).update(body).digest('base64')
    expect(
      authority?.verificationSecrets.some((candidate) =>
        webhook!.verifyShopifySignature(body, signature, candidate),
      ),
    ).toBe(true)
    expect(
      webhook!.verifyShopifySignature(
        body,
        createHmac('sha256', 'wrong synthetic key').update(body).digest('base64'),
        secret,
      ),
    ).toBe(false)
    expect(await webhook!.resolveShopWebhookAuthority(`unknown-${shop}`)).toBeNull()
    expect(await history()).toEqual(before)
  })

  it('denies broader provider metadata and every runtime/writer path on both signature-only tables', async () => {
    const before = await history()
    for (const role of [RUNTIME_ROLE, SYSTEM_ROLE])
      await asActor(() =>
        savepointHarness.context(
          role,
          role === RUNTIME_ROLE ? org : null,
          role === RUNTIME_ROLE ? actor : null,
          async (tx) => {
            for (const table of Object.keys(REWARD_SIGNATURE_COLUMN_CONTRACTS))
              for (const statement of [
                `SELECT * FROM public.${quote(table)} LIMIT 0`,
                `INSERT INTO public.${quote(table)} DEFAULT VALUES`,
                `UPDATE public.${quote(table)} SET org_id=org_id WHERE false`,
                `DELETE FROM public.${quote(table)} WHERE false`,
              ]) {
                await tx.execute(sql.raw('SAVEPOINT signature_only'))
                try {
                  const error = (await tx.execute(sql.raw(statement)).then(
                    () => null,
                    (error: unknown) => error,
                  )) as { code?: string; cause?: { code?: string } } | null
                  expect(
                    error?.cause?.code ?? error?.code,
                    `${role}:${table}:${statement.split(' ')[0]}`,
                  ).toBe('42501')
                } finally {
                  await tx.execute(sql.raw('ROLLBACK TO SAVEPOINT signature_only'))
                }
              }
          },
        ),
      )
    expect(await history()).toEqual(before)
  })

  it('refuses all real export service entries under a genuine canonical caller, without an export or business audit', async () => {
    const before = await history()
    const subject = randomUUID()
    const attempts = [
      () => outputs!.exportMasterInvoice(org, subject),
      () => outputs!.exportAllocationStatement(org, subject),
      () => outputs!.exportChargebackReport(org, subject),
      () => outputs!.exportGlJournal(org, subject),
      () => outputs!.generateEvidencePack(org, subject),
    ]
    for (const attempt of attempts) {
      const error = await asActor(() =>
        savepointHarness.context(RUNTIME_ROLE, org, actor, async () => {
          expect(currentCanonicalRequest()?.binding.userId).toBe(actor)
          return attempt()
        }),
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
    expect(await history()).toEqual(before)
  })
})

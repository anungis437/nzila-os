import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { appendCanonicalAuditLog } from '@/lib/audit/canonical-audit-chain'
import { allocateClaimNumber } from '@/lib/claims/claim-number'
import { settleDuesPaymentIntent } from '@/lib/dues/dues-settlement'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { folder, type V2Plan } from './source'

/**
 * Staging defect closure on the real Canonical V2 schema in a native PostgreSQL 16 fixture:
 * organization-scoped claim numbers, APPLICATION_USER_ID=TEXT, SYSTEM audit chain and dues
 * settlement (exactly-once, tamper-denied) under the real SYSTEM role.
 */
const native = process.env.UE_V2_NATIVE_MANIFEST === '1' ? describe : describe.skip
const dialect = new PgDialect()
const adapt = (client: pg.Client) => ({
  execute: async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
    const compiled = dialect.sqlToQuery(query)
    return (await client.query(compiled.sql, compiled.params as unknown[])).rows
  },
})
const orgSql = `INSERT INTO public.organizations
  (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,member_count,
   active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
  VALUES ($1::uuid,'Native org',$2,'local',ARRAY[]::text[],0,ARRAY[]::varchar[],false,0,0,'{}',
   ARRAY[]::text[],'active',15,now(),now())`
const ORG_A = '5a000000-0000-4000-8000-00000000000a'
const ORG_B = '5b000000-0000-4000-8000-00000000000b'

native('staging defect closure (native)', () => {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let superUrl: string
  const previousFlag = process.env.UE_CANONICAL_BOOTSTRAP_V2
  const connect = async () => {
    const client = new pg.Client({ connectionString: superUrl })
    await client.connect()
    return client
  }

  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    fixture = await openNativeRuntimeFixture(plan)
    superUrl = fixture.runtimeUrl.replace('ue_v2_mutation_runtime', 'postgres')
    await fixture.seed.query(orgSql, [ORG_A, 'native-org-a'])
    await fixture.seed.query(orgSql, [ORG_B, 'native-org-b'])
  }, 600000)
  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    else process.env.UE_CANONICAL_BOOTSTRAP_V2 = previousFlag
    if (fixture) await fixture.dispose()
  })

  const insertClaim = (client: pg.Client, org: string, number: string) =>
    client.query(
      'INSERT INTO claims (organization_id, member_id, claim_number) VALUES ($1,$2,$3)',
      [org, 'text-user-id', number],
    )

  it('claim numbers are unique per organization, not globally', async () => {
    const client = await connect()
    try {
      await insertClaim(client, ORG_A, 'CLM-20261015-0001')
      await insertClaim(client, ORG_B, 'CLM-20261015-0001')
      await expect(insertClaim(client, ORG_A, 'CLM-20261015-0001')).rejects.toMatchObject({
        code: '23505',
      })
      const indexes = await client.query(
        "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='claims' AND indexdef ILIKE '%claim_number%' AND indexdef ILIKE '%UNIQUE%'",
      )
      expect(indexes.rows.map((row) => row.indexdef).join('\n')).toContain(
        '(organization_id, claim_number)',
      )
      expect(indexes.rows.some((row) => /\(claim_number\)/.test(row.indexdef))).toBe(false)
    } finally {
      await client.end()
    }
  }, 120000)

  it('concurrent claim creation in one organization yields distinct numbers and no constraint failures', async () => {
    const workers = await Promise.all(Array.from({ length: 8 }, connect))
    try {
      const numbers = await Promise.all(
        workers.map(async (client) => {
          await client.query('BEGIN')
          const number = await allocateClaimNumber(
            adapt(client) as never,
            ORG_B,
            new Date('2026-11-02T10:00:00Z'),
          )
          await insertClaim(client, ORG_B, number)
          await client.query('COMMIT')
          return number
        }),
      )
      expect(new Set(numbers).size).toBe(8)
      expect([...numbers].sort()[0]).toBe('CLM-20261102-0001')
    } finally {
      await Promise.all(workers.map((client) => client.end()))
    }
  }, 120000)

  it('every APPLICATION_USER_ID column is text in the real catalog', async () => {
    const contract = JSON.parse(
      readFileSync(path.join(folder, 'UE_APPLICATION_IDENTITY_CONTRACT.json'), 'utf8'),
    ) as { applicationUserIdColumns: string[]; unclassifiedCurrentIdentityColumns: number }
    expect(contract.unclassifiedCurrentIdentityColumns).toBe(0)
    const rows = await fixture.seed.query(
      `SELECT table_name||'.'||column_name AS name, data_type FROM information_schema.columns
       WHERE table_schema='public'`,
    )
    const types = new Map(rows.rows.map((row) => [row.name as string, row.data_type as string]))
    for (const column of contract.applicationUserIdColumns)
      expect(['text', 'character varying'], column).toContain(types.get(column))
  })

  it('SYSTEM appends a hash-chained canonical audit record in the same transaction as its work', async () => {
    await fixture.systemWriter.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
      await appendCanonicalAuditLog(tx as never, {
        organizationId: ORG_A,
        action: 'deadline.test_first',
        resourceType: 'grievance_deadlines',
        userId: 'system:cron:native',
        details: { n: 1 },
      })
      await appendCanonicalAuditLog(tx as never, {
        organizationId: ORG_A,
        action: 'deadline.test_second',
        resourceType: 'grievance_deadlines',
        userId: 'system:cron:native',
        details: { n: 2 },
      })
    })
    const rows = await fixture.seed.query(
      "SELECT action, content_hash, previous_hash FROM public.audit_logs WHERE organization_id=$1 AND action LIKE 'deadline.test_%' ORDER BY created_at, id",
      [ORG_A],
    )
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows[1].previous_hash).toBe(rows.rows[0].content_hash)
  }, 120000)

  describe('dues settlement under the real SYSTEM role', () => {
    const MEMBER = 'native-member-text-id'
    const ids = ['d1111111-1111-4111-8111-111111111111', 'd2222222-2222-4222-8222-222222222222']
    const intentFor = (id: string, piId: string, overrides: Record<string, unknown> = {}) => ({
      id: piId,
      amount: 2500,
      amount_received: 2500,
      currency: 'cad',
      metadata: {
        ue_payment_kind: 'member_dues',
        ue_dues_payment_id: id,
        organization_id: ORG_A,
        member_user_id: MEMBER,
      },
      ...overrides,
    })
    const settle = (
      id: string,
      piId: string,
      event: string,
      overrides: Record<string, unknown> = {},
    ) =>
      fixture.systemWriter.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
        return settleDuesPaymentIntent(tx as never, intentFor(id, piId, overrides), event)
      })

    beforeAll(async () => {
      for (const [index, id] of ids.entries())
        await fixture.seed.query(
          `INSERT INTO dues_transactions (id, organization_id, member_id, transaction_type, amount, period_start,
             period_end, due_date, status, processor_type, processor_payment_id, dues_amount, total_amount)
           VALUES ($1,$2,$3,'payment',25.00,CURRENT_DATE,CURRENT_DATE,CURRENT_DATE,'pending','stripe',$4,25.00,25.00)`,
          [id, ORG_A, MEMBER, `pi_native_${index}`],
        )
    }, 120000)

    it('credits once, audits, and treats a redelivery as a duplicate', async () => {
      expect(await settle(ids[0], 'pi_native_0', 'evt_native_1')).toBe('settled')
      expect(await settle(ids[0], 'pi_native_0', 'evt_native_1_retry')).toBe('duplicate')
      const ledger = await fixture.seed.query(
        'SELECT user_id, amount::text, status, created_by FROM member_dues_ledger WHERE reference_id=$1',
        [ids[0]],
      )
      expect(ledger.rows).toEqual([
        { user_id: MEMBER, amount: '25.00', status: 'posted', created_by: 'system:stripe-webhook' },
      ])
      const audit = await fixture.seed.query(
        "SELECT user_id FROM public.audit_logs WHERE organization_id=$1 AND action='dues.settle' AND resource_id=$2",
        [ORG_A, ids[0]],
      )
      expect(audit.rows).toEqual([{ user_id: 'system:stripe-webhook' }])
    }, 120000)

    it('denies tampered metadata, amount and provider reference with no ledger or status change', async () => {
      await expect(
        settle(ids[1], 'pi_native_1', 'evt_t1', { amount_received: 1, amount: 1 }),
      ).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' })
      await expect(settle(ids[1], 'pi_attacker', 'evt_t2')).rejects.toMatchObject({
        code: 'PROVIDER_REFERENCE_MISMATCH',
      })
      await expect(
        settle(ids[1], 'pi_native_1', 'evt_t3', {
          metadata: {
            ue_payment_kind: 'member_dues',
            ue_dues_payment_id: ids[1],
            organization_id: ORG_B,
            member_user_id: MEMBER,
          },
        }),
      ).rejects.toMatchObject({ code: 'ORGANIZATION_MISMATCH' })
      const state = await fixture.seed.query('SELECT status FROM dues_transactions WHERE id=$1', [
        ids[1],
      ])
      expect(state.rows[0].status).toBe('pending')
      const ledger = await fixture.seed.query(
        'SELECT count(*)::int AS n FROM member_dues_ledger WHERE reference_id=$1',
        [ids[1]],
      )
      expect(ledger.rows[0].n).toBe(0)
    }, 120000)
  })
})

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { feeAdjustments } from '../../db/schema/domains/finance/transaction-fees'
import {
  insertWriteOwnedFeeAdjustment,
  type FeeAdjustmentInsert,
} from '../../services/platform-economics/fee-adjustment-insert'

export function feeAdjustmentFixture(row: Record<string, unknown>): FeeAdjustmentInsert {
  assert.equal(typeof row.fee_event_id, 'string')
  assert.equal(typeof row.organization_id, 'string')
  if (typeof row.fee_event_id !== 'string' || typeof row.organization_id !== 'string')
    throw new Error('UE_V2_FEE_FIXTURE_FOREIGN_KEYS_REQUIRED')
  return {
    feeEventId: row.fee_event_id,
    organizationId: row.organization_id,
    adjustmentType: 'reversal',
    amountCad: '-12.345',
    reason: 'Completion Charter synthetic fee adjustment',
  }
}

export async function qualifyFeeAdjustmentWriteOwnedResult(
  seed: pg.Client,
  system: pg.Client,
  input: FeeAdjustmentInsert,
  systemWriter?: PostgresJsDatabase,
): Promise<string[]> {
  const catalogue = await seed.query<{
    name: string
    type: string
    notnull: boolean
    identity: string
    generated: string
    default: string | null
  }>(
    `SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,
      a.attnotnull AS notnull,a.attidentity AS identity,a.attgenerated AS generated,
      pg_get_expr(d.adbin,d.adrelid) AS default
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.fee_adjustments'::regclass AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY a.attnum`,
  )
  assert.deepEqual(
    catalogue.rows.map((column) => ({
      name: column.name,
      notnull: column.notnull,
      identity: column.identity,
      generated: column.generated,
      default: column.default,
    })),
    [
      ['id', true, 'gen_random_uuid()'],
      ['fee_event_id', true, null],
      ['organization_id', true, null],
      ['adjustment_type', true, null],
      ['amount_cad', true, null],
      ['reason', true, null],
      ['source_refund_id', false, null],
      ['approved_by', false, null],
      ['approved_at', false, null],
      ['metadata', false, null],
      ['created_at', true, 'now()'],
    ].map(([name, notnull, defaultValue]) => ({
      name,
      notnull,
      identity: '',
      generated: '',
      default: defaultValue,
    })),
    'UE_V2_FEE_DEFAULT_OR_COLUMN_DRIFT',
  )
  assert.equal(catalogue.rows.find((column) => column.name === 'amount_cad')?.type, 'numeric(14,2)')
  assert.equal(
    (
      await seed.query(
        "SELECT tgname FROM pg_trigger WHERE tgrelid='public.fee_adjustments'::regclass AND NOT tgisinternal",
      )
    ).rowCount,
    0,
    'UE_V2_FEE_USER_TRIGGER_CONFLICT',
  )
  assert.equal(
    (
      await seed.query(
        "SELECT rulename FROM pg_rules WHERE schemaname='public' AND tablename='fee_adjustments'",
      )
    ).rowCount,
    0,
    'UE_V2_FEE_REWRITE_RULE_CONFLICT',
  )
  const queries: string[] = []
  const writer = drizzle(system, {
    logger: {
      logQuery(query) {
        queries.push(query)
      },
    },
  })
  const inspector = drizzle(seed)
  const createdIds: string[] = []
  const ownedRows = () =>
    seed.query('SELECT to_jsonb(t) AS row FROM public.fee_adjustments t ORDER BY id')
  const baseline = (await ownedRows()).rows
  const begin = async () => {
    await system.query('BEGIN')
    await system.query('SET LOCAL ROLE union_eyes_system')
    const actor = (
      await system.query(
        'SELECT current_user AS role,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user',
      )
    ).rows[0]
    assert.deepEqual(actor, { role: 'union_eyes_system', superuser: false, bypass: false })
  }
  const cases = ['FEE_CANONICAL_DEFAULTS_NO_GENERATED_IDENTITY_USER_TRIGGER_OR_REWRITE']
  try {
    for (const [amountCad, expected] of [
      ['0', '0.00'],
      ['-0.0001', '0.00'],
      ['-12.345', '-12.35'],
      ['1.005', '1.01'],
      ['999999999999.994', '999999999999.99'],
      ['-999999999999.99', '-999999999999.99'],
    ]) {
      await begin()
      let inserted: Awaited<ReturnType<typeof insertWriteOwnedFeeAdjustment>>
      let transactionTime: string
      try {
        transactionTime = (
          await system.query<{ value: string }>('SELECT transaction_timestamp()::text AS value')
        ).rows[0].value
        inserted = await insertWriteOwnedFeeAdjustment(writer, { ...input, amountCad })
        createdIds.push(inserted.id)
        await system.query('SET CONSTRAINTS ALL IMMEDIATE')
        await system.query('COMMIT')
      } finally {
        await system.query('ROLLBACK')
      }
      assert.equal(inserted.amountCad, expected)
      assert.equal(inserted.sourceRefundId, null)
      assert.equal(inserted.approvedBy, null)
      assert.equal(inserted.approvedAt, null)
      assert.equal(inserted.metadata, null)
      const [persisted] = await inspector
        .select()
        .from(feeAdjustments)
        .where(eq(feeAdjustments.id, inserted.id))
      assert.deepEqual(inserted, persisted, 'UE_V2_FEE_EXACT_COMPLETE_PERSISTED_RESULT_REQUIRED')
      assert.equal(
        (
          await seed.query<{ exact: boolean }>(
            'SELECT created_at=$2::timestamptz AND source_refund_id IS NULL AND approved_by IS NULL AND approved_at IS NULL AND metadata IS NULL AS exact FROM public.fee_adjustments WHERE id=$1',
            [inserted.id, transactionTime],
          )
        ).rows[0].exact,
        true,
        'UE_V2_FEE_DATABASE_TRANSACTION_TIMESTAMP_FULL_PRECISION_REQUIRED',
      )
    }
    cases.push('FEE_EXACT_ELEVEN_FIELD_OWNER_PERSISTED_RESULT_AND_NULL_DEFAULTS')
    cases.push('FEE_ZERO_NEGATIVE_ZERO_ROUNDING_AND_NUMERIC14_2_PRECISION')
    cases.push('FEE_DATABASE_AUTHORITATIVE_FULL_PRECISION_TRANSACTION_TIME')

    await begin()
    try {
      const inserted = await insertWriteOwnedFeeAdjustment(writer, {
        ...input,
        approvedBy: '',
      })
      createdIds.push(inserted.id)
      await system.query('COMMIT')
      const [persisted] = await inspector
        .select()
        .from(feeAdjustments)
        .where(eq(feeAdjustments.id, inserted.id))
      assert.deepEqual(inserted, persisted)
      assert.equal(inserted.approvedBy, '')
      assert.equal(inserted.approvedAt, null)
    } finally {
      await system.query('ROLLBACK')
    }

    await begin()
    try {
      const approval = new Date('2026-01-02T03:04:05.678Z')
      const inserted = await insertWriteOwnedFeeAdjustment(writer, {
        ...input,
        feeEventId: input.feeEventId.toUpperCase(),
        organizationId: input.organizationId.toUpperCase(),
        adjustmentType: 'partial_reversal',
        sourceRefundId: '',
        approvedBy: 'synthetic-approver',
        approvedAt: approval,
        metadata: { note: 'synthetic', omitted: undefined, nested: { approved: true } },
      })
      createdIds.push(inserted.id)
      await system.query('COMMIT')
      const [persisted] = await inspector
        .select()
        .from(feeAdjustments)
        .where(eq(feeAdjustments.id, inserted.id))
      assert.deepEqual(inserted, persisted)
      assert.equal(inserted.feeEventId, input.feeEventId.toLowerCase())
      assert.equal(inserted.organizationId, input.organizationId.toLowerCase())
      assert.equal(inserted.sourceRefundId, '')
      assert.equal(inserted.approvedBy, 'synthetic-approver')
      assert.deepEqual(inserted.approvedAt, approval)
      assert.deepEqual(inserted.metadata, { note: 'synthetic', nested: { approved: true } })
    } finally {
      await system.query('ROLLBACK')
    }
    cases.push('FEE_APPROVAL_EMPTY_REFUND_UUID_AND_JSONB_DATABASE_NORMALIZATION')

    for (const [invalid, expectedCode] of [
      [{ ...input, amountCad: '999999999999.995' }, '22003'],
      [{ ...input, amountCad: 'not-a-number' }, '22P02'],
      [{ ...input, feeEventId: randomUUID() }, '23503'],
      [{ ...input, sourceRefundId: 'x'.repeat(256) }, '22001'],
    ] as const) {
      const before = (await ownedRows()).rows
      await begin()
      try {
        await assert.rejects(
          insertWriteOwnedFeeAdjustment(writer, invalid),
          (error: unknown) =>
            error instanceof Error &&
            'cause' in error &&
            error.cause instanceof pg.DatabaseError &&
            error.cause.code === expectedCode,
        )
      } finally {
        await system.query('ROLLBACK')
      }
      assert.deepEqual((await ownedRows()).rows, before)
    }
    cases.push(
      'FEE_NUMERIC_OVERFLOW_INVALID_AMOUNT_FOREIGN_KEY_AND_LENGTH_ERRORS_NO_RESULT_OR_RESIDUE',
    )
    const beforeRollback = (await ownedRows()).rows
    await begin()
    try {
      await insertWriteOwnedFeeAdjustment(writer, input)
      await assert.rejects(
        system.query('SELECT 1/0'),
        (error: unknown) => error instanceof pg.DatabaseError && error.code === '22012',
      )
    } finally {
      await system.query('ROLLBACK')
    }
    assert.deepEqual((await ownedRows()).rows, beforeRollback)
    cases.push('FEE_POST_INSERT_DOWNSTREAM_FAILURE_TRANSACTION_ROLLBACK')

    await begin()
    try {
      await assert.rejects(
        system.query(
          'INSERT INTO public.fee_adjustments (fee_event_id,organization_id,adjustment_type,amount_cad,reason) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [
            input.feeEventId,
            input.organizationId,
            input.adjustmentType,
            input.amountCad,
            input.reason,
          ],
        ),
        (error: unknown) => error instanceof pg.DatabaseError && error.code === '42501',
      )
    } finally {
      await system.query('ROLLBACK')
    }
    assert(queries.some((query) => /^insert /i.test(query)))
    assert(queries.some((query) => /^select /i.test(query)))
    for (const query of queries) {
      assert(!/\breturning\b/i.test(query), 'UE_V2_FEE_HELPER_RETURNING_FORBIDDEN')
      if (/^select /i.test(query))
        assert(
          !/\bfrom\b/i.test(query.replace(/\bfrom \(select 1\) as fee_adjustment_input\b/i, '')),
          'UE_V2_FEE_HELPER_TABLE_READ_FORBIDDEN',
        )
    }
    cases.push('FEE_PRODUCTION_HELPER_NO_RETURNING_NO_TABLE_READ_FULL_RETURNING_DENIED')
    assert(systemWriter, 'UE_V2_FEE_PRODUCTION_DRIVER_REQUIRED')
    const production = await systemWriter.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
      const actor = await tx.execute<{ role: string; superuser: boolean; bypass: boolean }>(
        sql`SELECT current_user AS role,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user`,
      )
      assert.deepEqual(actor[0], { role: 'union_eyes_system', superuser: false, bypass: false })
      const inserted = await insertWriteOwnedFeeAdjustment(tx, {
        ...input,
        amountCad: '-0.0001',
        approvedAt: new Date('2026-01-02T03:04:05.678Z'),
        metadata: { driver: 'postgres-js' },
      })
      createdIds.push(inserted.id)
      return inserted
    })
    const [persisted] = await inspector
      .select()
      .from(feeAdjustments)
      .where(eq(feeAdjustments.id, production.id))
    assert.deepEqual(production, persisted)
    assert.equal(production.amountCad, '0.00')
    const beforeProductionRollback = (await ownedRows()).rows
    const downstream = new Error('UE_V2_SYNTHETIC_DOWNSTREAM_FAILURE')
    await assert.rejects(
      systemWriter.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE union_eyes_system`)
        await insertWriteOwnedFeeAdjustment(tx, input)
        throw downstream
      }),
      (error: unknown) => error === downstream,
    )
    assert.deepEqual((await ownedRows()).rows, beforeProductionRollback)
    cases.push('FEE_PRODUCTION_POSTGRES_JS_DRIVER_EXACT_PERSISTED_RESULT_AND_ROLLBACK')
    return cases
  } finally {
    await system.query('ROLLBACK')
    for (const id of createdIds)
      await seed.query('DELETE FROM public.fee_adjustments WHERE id=$1', [id])
    assert.deepEqual((await ownedRows()).rows, baseline, 'UE_V2_FEE_PROOF_EXACT_CLEANUP_REQUIRED')
  }
}

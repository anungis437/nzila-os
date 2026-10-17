import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import {
  feeAdjustments,
  type FeeAdjustment,
  type NewFeeAdjustment,
} from '../../db/schema/domains/finance/transaction-fees'

export type FeeAdjustmentInsert = Omit<NewFeeAdjustment, 'id' | 'createdAt'>

export async function insertWriteOwnedFeeAdjustment<T extends PgQueryResultHKT>(
  writer: Pick<PgDatabase<T>, 'select' | 'insert'>,
  input: FeeAdjustmentInsert,
): Promise<FeeAdjustment> {
  const id = randomUUID()
  const [normalized] = await writer
    .select({
      feeEventId: sql`${input.feeEventId}::uuid`.mapWith(feeAdjustments.feeEventId),
      organizationId: sql`${input.organizationId}::uuid`.mapWith(feeAdjustments.organizationId),
      amountCad: sql`${input.amountCad}::numeric(14,2)`.mapWith(feeAdjustments.amountCad),
      approvedAt: sql`${input.approvedAt?.toISOString() ?? null}::timestamptz`.mapWith(
        feeAdjustments.approvedAt,
      ),
      metadata:
        sql`${input.metadata == null ? null : JSON.stringify(input.metadata)}::jsonb`.mapWith(
          feeAdjustments.metadata,
        ),
      createdAt: sql`transaction_timestamp()`.mapWith(feeAdjustments.createdAt),
      createdAtValue: sql<string>`transaction_timestamp()::text`,
    })
    .from(sql`(select 1) as fee_adjustment_input`)
  if (!normalized) throw new Error('FEE_ADJUSTMENT_NORMALIZATION_RESULT_REQUIRED')
  const record: FeeAdjustment = {
    id,
    feeEventId: normalized.feeEventId,
    organizationId: normalized.organizationId,
    adjustmentType: input.adjustmentType,
    amountCad: normalized.amountCad,
    reason: input.reason,
    sourceRefundId: input.sourceRefundId ?? null,
    approvedBy: input.approvedBy ?? null,
    approvedAt: normalized.approvedAt,
    metadata: normalized.metadata,
    createdAt: normalized.createdAt,
  }
  const inserted: unknown = await writer.insert(feeAdjustments).values({
    ...record,
    // A Date decodes to milliseconds; retain PostgreSQL's full default-time precision on disk.
    createdAt: sql`${normalized.createdAtValue}::timestamptz`,
  })
  const count =
    inserted !== null && typeof inserted === 'object'
      ? 'rowCount' in inserted
        ? inserted.rowCount
        : 'count' in inserted
          ? inserted.count
          : undefined
      : undefined
  if (count !== 1) throw new Error('FEE_ADJUSTMENT_EXACT_INSERT_COUNT_REQUIRED')
  return record
}

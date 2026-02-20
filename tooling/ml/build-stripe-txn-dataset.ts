#!/usr/bin/env npx tsx
/**
 * tooling/ml/build-stripe-txn-dataset.ts
 *
 * Builds the stripe_txn_features_v1 dataset for transaction-level ML (Option B).
 * Queries stripePayments + stripeRefunds + stripeDisputes, engineers
 * per-transaction features (with rolling baselines), writes CSV to Blob,
 * and registers in mlDatasets.
 *
 * Usage:
 *   npx tsx tooling/ml/build-stripe-txn-dataset.ts \
 *     --entity-id <uuid> \
 *     --start 2025-01-01 \
 *     --end 2025-12-31 \
 *     --created-by system
 *
 * Requires: DATABASE_URL, AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
 */
import { parseArgs } from 'node:util'
import { db } from '@nzila/db'
import { stripePayments, stripeRefunds } from '@nzila/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { buildTxnFeatures, toCsv } from './lib/stripeFeatureEngineering'
import type { RawTxn } from './lib/stripeFeatureEngineering'
import { writeBlobDataset } from './lib/blobDatasetWriter'

const { values } = parseArgs({
  options: {
    'entity-id': { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    'created-by': { type: 'string', default: 'system' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help) {
  console.log(`
Usage: npx tsx tooling/ml/build-stripe-txn-dataset.ts \\
  --entity-id <uuid> \\
  --start YYYY-MM-DD \\
  --end YYYY-MM-DD \\
  --created-by system
`)
  process.exit(0)
}

function fatal(msg: string): never {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const entityId = values['entity-id'] ?? fatal('--entity-id is required')
  const periodStart = values.start ?? fatal('--start is required')
  const periodEnd = values.end ?? fatal('--end is required')
  const createdBy = values['created-by'] as string

  console.error(`Building stripe_txn_features_v1 for ${entityId} (${periodStart} → ${periodEnd})`)

  const startTs = new Date(periodStart + 'T00:00:00Z')
  const endTs = new Date(periodEnd + 'T23:59:59Z')

  // Load payments
  const payments = await db
    .select({
      occurredAt: stripePayments.occurredAt,
      amountCents: stripePayments.amountCents,
      currency: stripePayments.currency,
      stripeObjectId: stripePayments.stripeObjectId,
      objectType: stripePayments.objectType,
    })
    .from(stripePayments)
    .where(
      and(
        eq(stripePayments.entityId, entityId),
        gte(stripePayments.occurredAt, startTs),
        lte(stripePayments.occurredAt, endTs),
      ),
    )

  // Load refunds as negative transactions
  const refunds = await db
    .select({
      occurredAt: stripeRefunds.occurredAt,
      amountCents: stripeRefunds.amountCents,
      refundId: stripeRefunds.refundId,
    })
    .from(stripeRefunds)
    .where(
      and(
        eq(stripeRefunds.entityId, entityId),
        gte(stripeRefunds.occurredAt, startTs),
        lte(stripeRefunds.occurredAt, endTs),
      ),
    )

  console.error(`  Loaded: ${payments.length} payments, ${refunds.length} refunds`)

  // Build raw transaction list
  const rawTxns: RawTxn[] = [
    ...payments.map((p) => ({
      occurredAt: p.occurredAt,
      amountCents: p.amountCents,
      currency: p.currency,
      paymentMethodType: 'card', // default — extend when payment method info is stored
      isRefund: false,
      isDispute: false,
      stripePaymentIntentId: p.objectType === 'payment_intent' ? p.stripeObjectId : null,
      stripeChargeId: null,
      stripeEventId: null,
    })),
    ...refunds.map((r) => ({
      occurredAt: r.occurredAt,
      amountCents: -r.amountCents, // sign negative for refunds
      currency: 'CAD', // refunds inherit entity currency
      paymentMethodType: 'refund',
      isRefund: true,
      isDispute: false,
      stripePaymentIntentId: null,
      stripeChargeId: r.refundId ?? null,
      stripeEventId: null,
    })),
  ]

  if (rawTxns.length === 0) {
    fatal(`No transactions found for entity ${entityId} in ${periodStart} → ${periodEnd}.`)
  }

  const featureRows = buildTxnFeatures(rawTxns)
  const csv = toCsv(featureRows)

  const result = await writeBlobDataset({
    entityId,
    datasetKey: 'stripe_txn_features_v1',
    periodStart,
    periodEnd,
    csvContent: csv,
    schemaJson: {
      occurred_at: 'string',
      amount: 'float',
      amount_abs: 'float',
      amount_log1p: 'float',
      currency: 'string',
      payment_method_type: 'string',
      is_refund: 'int',
      is_dispute: 'int',
      hour_of_day: 'int',
      day_of_week: 'int',
      median_amount_30d: 'float',
      mad_amount_30d: 'float',
      z_robust_amount_30d: 'float',
      stripe_payment_intent_id: 'string',
      stripe_charge_id: 'string',
      stripe_event_id: 'string',
    },
    buildConfigJson: {
      script: 'build-stripe-txn-dataset.ts',
      periodStart,
      periodEnd,
      entityId,
      rawTxnCount: rawTxns.length,
      builtAt: new Date().toISOString(),
    },
    createdBy,
  })

  console.error('\n✔ Done.')
  console.error(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})

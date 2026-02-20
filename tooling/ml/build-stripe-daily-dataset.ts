#!/usr/bin/env npx tsx
/**
 * tooling/ml/build-stripe-daily-dataset.ts
 *
 * Builds the stripe_daily_metrics_v1 dataset for ML training/inference.
 * Queries existing normalized Stripe tables, aggregates daily metrics,
 * writes a CSV snapshot to Azure Blob, and registers it in mlDatasets.
 *
 * Usage:
 *   npx tsx tooling/ml/build-stripe-daily-dataset.ts \
 *     --entity-id <uuid> \
 *     --start 2025-01-01 \
 *     --end 2025-12-31 \
 *     --created-by system
 *
 * Requires: DATABASE_URL, AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
 */
import { parseArgs } from 'node:util'
import { db } from '@nzila/db'
import {
  stripePayments,
  stripeRefunds,
  stripeDisputes,
  stripePayouts,
} from '@nzila/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { buildDailyMetrics, toCsv } from './lib/stripeFeatureEngineering'
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
Usage: npx tsx tooling/ml/build-stripe-daily-dataset.ts \\
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

  console.error(`Building stripe_daily_metrics_v1 for ${entityId} (${periodStart} → ${periodEnd})`)

  const startTs = new Date(periodStart + 'T00:00:00Z')
  const endTs = new Date(periodEnd + 'T23:59:59Z')

  const [payments, refunds, disputes, payouts] = await Promise.all([
    db
      .select({
        occurredAt: stripePayments.occurredAt,
        amountCents: stripePayments.amountCents,
        currency: stripePayments.currency,
      })
      .from(stripePayments)
      .where(
        and(
          eq(stripePayments.entityId, entityId),
          gte(stripePayments.occurredAt, startTs),
          lte(stripePayments.occurredAt, endTs),
        ),
      ),

    db
      .select({
        occurredAt: stripeRefunds.occurredAt,
        amountCents: stripeRefunds.amountCents,
      })
      .from(stripeRefunds)
      .where(
        and(
          eq(stripeRefunds.entityId, entityId),
          gte(stripeRefunds.occurredAt, startTs),
          lte(stripeRefunds.occurredAt, endTs),
        ),
      ),

    db
      .select({
        occurredAt: stripeDisputes.occurredAt,
        amountCents: stripeDisputes.amountCents,
      })
      .from(stripeDisputes)
      .where(
        and(
          eq(stripeDisputes.entityId, entityId),
          gte(stripeDisputes.occurredAt, startTs),
          lte(stripeDisputes.occurredAt, endTs),
        ),
      ),

    db
      .select({
        occurredAt: stripePayouts.occurredAt,
        amountCents: stripePayouts.amountCents,
        currency: stripePayouts.currency,
      })
      .from(stripePayouts)
      .where(
        and(
          eq(stripePayouts.entityId, entityId),
          gte(stripePayouts.occurredAt, startTs),
          lte(stripePayouts.occurredAt, endTs),
        ),
      ),
  ])

  console.error(
    `  Loaded: ${payments.length} payments, ${refunds.length} refunds, ` +
      `${disputes.length} disputes, ${payouts.length} payouts`,
  )

  const rows = buildDailyMetrics(payments, refunds, disputes, payouts)

  if (rows.length === 0) {
    fatal(`No data rows built for the specified period. Check that Stripe data exists for entity ${entityId}.`)
  }

  const csv = toCsv(rows)

  const result = await writeBlobDataset({
    entityId,
    datasetKey: 'stripe_daily_metrics_v1',
    periodStart,
    periodEnd,
    csvContent: csv,
    schemaJson: {
      date: 'string',
      gross_sales: 'float',
      net_sales: 'float',
      txn_count: 'int',
      refunds_amount: 'float',
      refunds_count: 'int',
      disputes_count: 'int',
      disputes_amount: 'float',
      payout_count: 'int',
      payout_amount: 'float',
      currency: 'string',
    },
    buildConfigJson: {
      script: 'build-stripe-daily-dataset.ts',
      periodStart,
      periodEnd,
      entityId,
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

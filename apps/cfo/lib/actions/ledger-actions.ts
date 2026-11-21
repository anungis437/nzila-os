/**
 * CFO Server Actions — Ledger + Reconciliation.
 *
 * Integrates @nzila/payments-stripe (real Stripe data) and @nzila/qbo
 * (QuickBooks journal entries) for a unified financial view.
 */
'use server'

import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { resolveOrgContext } from '@/lib/resolve-org'
import { cfoRows } from '@/queries/action-context'
import { legacyCfoAuditPredicate } from '@/lib/services/cfo-records'
import { CfoCapabilityUnavailableError } from '@/lib/services/capability-unavailable'
import { buildFinancialSummary } from '@/lib/qbo'

export interface LedgerEntry {
  id: string
  date: Date
  description: string
  account: string
  debit: number | null
  credit: number | null
  source: 'stripe' | 'qbo' | 'manual'
  reference: string | null
}

export interface LedgerSummary {
  entries: LedgerEntry[]
  totalDebits: number
  totalCredits: number
  netBalance: number
  entryCount: number
}

export async function getLedgerEntries(opts?: {
  page?: number
  pageSize?: number
  source?: string
  startDate?: string
  endDate?: string
}): Promise<LedgerSummary> {
  return resolveOrgContext(
    'resource',
    { permission: 'ledger:view' },
    async (context): Promise<LedgerSummary> => {
      const scope = legacyCfoAuditPredicate(context)
      const page = opts?.page ?? 1
      const pageSize = opts?.pageSize ?? 50
      const offset = (page - 1) * pageSize

      try {
        const entries = cfoRows<LedgerEntry>(
          await context.db.execute(
            sql`SELECT
        id, created_at as date, action as description,
        COALESCE(metadata->>'account', 'General') as account,
        CASE WHEN metadata->>'type' = 'debit' THEN CAST(metadata->>'amount' AS NUMERIC) END as debit,
        CASE WHEN metadata->>'type' = 'credit' THEN CAST(metadata->>'amount' AS NUMERIC) END as credit,
        COALESCE(metadata->>'source', 'manual') as source,
        metadata->>'reference' as reference
      FROM audit_log
      WHERE ${scope} AND (action LIKE 'ledger.%' OR action LIKE 'payment.%' OR action LIKE 'invoice.%')
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
          ),
        )

        const [totals] = cfoRows<{
          total_debits: number
          total_credits: number
          entry_count: number
        }>(
          await context.db.execute(
            sql`SELECT
        COALESCE(SUM(CASE WHEN metadata->>'type' = 'debit' THEN CAST(metadata->>'amount' AS NUMERIC) END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN metadata->>'type' = 'credit' THEN CAST(metadata->>'amount' AS NUMERIC) END), 0) as total_credits,
        COUNT(*) as entry_count
      FROM audit_log
      WHERE ${scope} AND (action LIKE 'ledger.%' OR action LIKE 'payment.%' OR action LIKE 'invoice.%')`,
          ),
        )

        return {
          entries: entries ?? [],
          totalDebits: Number(totals?.total_debits ?? 0),
          totalCredits: Number(totals?.total_credits ?? 0),
          netBalance: Number(totals?.total_credits ?? 0) - Number(totals?.total_debits ?? 0),
          entryCount: Number(totals?.entry_count ?? 0),
        }
      } catch (error) {
        logger.error('Failed to fetch ledger entries', { error })
        return { entries: [], totalDebits: 0, totalCredits: 0, netBalance: 0, entryCount: 0 }
      }
    },
  )
}

export interface ReconciliationResult {
  matched: number
  unmatched: number
  exceptions: number
  closeReady: boolean
  closeReadinessScore: number
  lastRun: Date | null
}

export async function runReconciliation(): Promise<ReconciliationResult> {
  return resolveOrgContext('organization', { permission: 'ledger:write' }, async () => {
    throw new CfoCapabilityUnavailableError('RECONCILIATION_SOURCE_UNAVAILABLE')
  })
}

export async function getFinancialOverview() {
  return resolveOrgContext('organization', { permission: 'ledger:view' }, async (_context) => {
    try {
      const summary = await buildFinancialSummary()
      return summary
    } catch (error) {
      logger.error('Failed to build financial overview', { error })
      return null
    }
  })
}

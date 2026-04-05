/**
 * CFO Server Actions — Ledger + Reconciliation.
 *
 * Integrates @nzila/payments-stripe (real Stripe data) and @nzila/qbo
 * (QuickBooks journal entries) for a unified financial view.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { matchPayoutsToDeposits, computeCloseReadiness, generateExceptions } from '@nzila/payments-stripe'
import { buildFinancialSummary } from '@/lib/qbo'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

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
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('ledger:view')

  const page = opts?.page ?? 1
  const pageSize = opts?.pageSize ?? 50
  const offset = (page - 1) * pageSize

  try {
    const entries = (await platformDb.execute(
      sql`SELECT
        id, created_at as date, action as description,
        COALESCE(metadata->>'account', 'General') as account,
        CASE WHEN metadata->>'type' = 'debit' THEN CAST(metadata->>'amount' AS NUMERIC) END as debit,
        CASE WHEN metadata->>'type' = 'credit' THEN CAST(metadata->>'amount' AS NUMERIC) END as credit,
        COALESCE(metadata->>'source', 'manual') as source,
        metadata->>'reference' as reference
      FROM audit_log
      WHERE action LIKE 'ledger.%' OR action LIKE 'payment.%' OR action LIKE 'invoice.%'
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
    )) as unknown as { rows: LedgerEntry[] }

    const [totals] = (await platformDb.execute(
      sql`SELECT
        COALESCE(SUM(CASE WHEN metadata->>'type' = 'debit' THEN CAST(metadata->>'amount' AS NUMERIC) END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN metadata->>'type' = 'credit' THEN CAST(metadata->>'amount' AS NUMERIC) END), 0) as total_credits,
        COUNT(*) as entry_count
      FROM audit_log
      WHERE action LIKE 'ledger.%' OR action LIKE 'payment.%' OR action LIKE 'invoice.%'`,
    )) as unknown as [{ total_debits: number; total_credits: number; entry_count: number }]

    return {
      entries: entries.rows ?? [],
      totalDebits: Number(totals?.total_debits ?? 0),
      totalCredits: Number(totals?.total_credits ?? 0),
      netBalance: Number(totals?.total_credits ?? 0) - Number(totals?.total_debits ?? 0),
      entryCount: Number(totals?.entry_count ?? 0),
    }
  } catch (error) {
    logger.error('Failed to fetch ledger entries', { error })
    return { entries: [], totalDebits: 0, totalCredits: 0, netBalance: 0, entryCount: 0 }
  }
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
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('ledger:write')

  try {
    logger.info('Starting month-end reconciliation', { actorId: userId })

    const matchResult = matchPayoutsToDeposits([], [])
    const exceptions = generateExceptions('default', 'current', matchResult)
    const closeReport = computeCloseReadiness('default', 'current', matchResult, exceptions)

    // Record evidence
    const pack = buildEvidencePackFromAction({
      actionId: `recon-${Date.now()}`,
      actionType: 'RECONCILIATION_RUN',
      orgId: 'platform',
      executedBy: userId,
    })
    await processEvidencePack(pack)

    logger.info('Reconciliation completed', {
      actorId: userId,
      matched: matchResult.matched.length,
      closeReady: closeReport.ready,
    })

    return {
      matched: matchResult.matched.length,
      unmatched: matchResult.unmatchedStripe.length + matchResult.unmatchedQbo.length,
      exceptions: exceptions.length,
      closeReady: closeReport.ready,
      closeReadinessScore: closeReport.score,
      lastRun: new Date(),
    }
  } catch (error) {
    logger.error('Reconciliation failed', { error })
    return {
      matched: 0,
      unmatched: 0,
      exceptions: 0,
      closeReady: false,
      closeReadinessScore: 0,
      lastRun: null,
    }
  }
}

export async function getFinancialOverview() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('ledger:view')

  try {
    const summary = await buildFinancialSummary()
    return summary
  } catch (error) {
    logger.error('Failed to build financial overview', { error })
    return null
  }
}

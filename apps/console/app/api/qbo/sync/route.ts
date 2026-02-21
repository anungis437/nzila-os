// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO Report Sync
 * POST /api/qbo/sync
 *
 * Body: { entityId, reportType, periodStart?, periodEnd? }
 *
 * Triggers a synchronous QBO report pull:
 *   1. Loads active connection + tokens for the entity
 *   2. Refreshes access token if needed
 *   3. Fetches the report from QBO v3 REST API
 *   4. Stores the raw JSON in Blob storage (documents pattern)
 *   5. Creates qbo_sync_runs + qbo_reports rows
 *
 * Report types: trial_balance | profit_and_loss | balance_sheet |
 *               cash_flow | aging_receivable | aging_payable | general_ledger
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { qboConnections, qboTokens, qboSyncRuns, qboReports } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { createQboClient } from '@nzila/qbo/client'
import { getValidToken, isAccessTokenExpired } from '@nzila/qbo/oauth'
import type { QboTokenSet } from '@nzila/qbo/types'
import { createHash } from 'crypto'

// QBO report name → API report name mapping
const REPORT_NAME_MAP: Record<string, string> = {
  trial_balance: 'TrialBalance',
  profit_and_loss: 'ProfitAndLoss',
  balance_sheet: 'BalanceSheet',
  cash_flow: 'CashFlow',
  aging_receivable: 'AgedReceivables',
  aging_payable: 'AgedPayables',
  general_ledger: 'GeneralLedger',
}

const QboSyncSchema = z.object({
  entityId: z.string().min(1),
  reportType: z.string().min(1),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = QboSyncSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'entityId and reportType required' }, { status: 400 })
  }
  const { entityId, reportType, periodStart, periodEnd } = parsed.data

  const qboReportName = REPORT_NAME_MAP[reportType as string]
  if (!qboReportName) {
    return NextResponse.json(
      { error: `Unknown reportType. Valid: ${Object.keys(REPORT_NAME_MAP).join(', ')}` },
      { status: 400 },
    )
  }

  const access = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!access.ok) return access.response

  // ── Load connection ─────────────────────────────────────────────────────

  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(
      eq(qboConnections.entityId, entityId),
      eq(qboConnections.isActive, true),
    ),
  })

  if (!connection) {
    return NextResponse.json({ error: 'No active QBO connection for entity' }, { status: 404 })
  }

  const tokenRow = await platformDb.query.qboTokens.findFirst({
    where: eq(qboTokens.connectionId, connection.id),
    orderBy: [desc(qboTokens.createdAt)],
  })

  if (!tokenRow) {
    return NextResponse.json({ error: 'No tokens found for connection' }, { status: 404 })
  }

  // Reconstruct QboTokenSet from the DB row
  let tokenSet: QboTokenSet = {
    access_token: tokenRow.accessToken,
    refresh_token: tokenRow.refreshToken,
    token_type: 'bearer',
    expires_in: Math.max(
      0,
      Math.floor((tokenRow.accessTokenExpiresAt.getTime() - Date.now()) / 1000),
    ),
    x_refresh_token_expires_in: Math.max(
      0,
      Math.floor((tokenRow.refreshTokenExpiresAt.getTime() - Date.now()) / 1000),
    ),
    realmId: connection.realmId,
    obtainedAt: tokenRow.createdAt.getTime(),
  }

  // Auto-refresh if needed
  if (isAccessTokenExpired(tokenSet)) {
    tokenSet = await getValidToken(tokenSet, async (refreshed: QboTokenSet) => {
      const newAccessExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
      const newRefreshExpiresAt = new Date(
        Date.now() + refreshed.x_refresh_token_expires_in * 1000,
      )
      await platformDb.insert(qboTokens).values({
        connectionId: connection.id,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        accessTokenExpiresAt: newAccessExpiresAt,
        refreshTokenExpiresAt: newRefreshExpiresAt,
      })
    })
  }

  // ── Create sync run ─────────────────────────────────────────────────────

  const [syncRun] = await platformDb
    .insert(qboSyncRuns)
    .values({
      entityId,
      connectionId: connection.id,
      reportType: reportType as typeof qboSyncRuns.$inferInsert['reportType'],
      periodStart: periodStart ?? null,
      periodEnd: periodEnd ?? null,
      status: 'running',
      startedAt: new Date(),
    })
    .returning()

  // ── Fetch report ────────────────────────────────────────────────────────

  try {
    const qbo = createQboClient(tokenSet)

    const reportParams: Record<string, string> = {}
    if (periodStart) reportParams.start_date = periodStart as string
    if (periodEnd) reportParams.end_date = periodEnd as string

    const report = await qbo.report(qboReportName, reportParams)
    const reportJson = JSON.stringify(report)
    const sha256 = createHash('sha256').update(reportJson).digest('hex')

    // TODO(blob): store reportJson in Azure Blob Storage and get documentId
    // For now we use sha256 as a placeholder document ID until blob integration is wired
    const documentId = sha256

    const [reportRow] = await platformDb
      .insert(qboReports)
      .values({
        entityId,
        syncRunId: syncRun.id,
        reportType: reportType as typeof qboReports.$inferInsert['reportType'],
        periodStart: periodStart ?? null,
        periodEnd: periodEnd ?? null,
        documentId,
        sha256,
        fetchedAt: new Date(),
      })
      .returning()

    await platformDb
      .update(qboSyncRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(qboSyncRuns.id, syncRun.id))

    return NextResponse.json({
      syncRunId: syncRun.id,
      reportId: reportRow.id,
      reportType,
      sha256,
      periodStart,
      periodEnd,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[QBO] Report sync failed:', message)

    await platformDb
      .update(qboSyncRuns)
      .set({ status: 'failed', completedAt: new Date(), errorMessage: message })
      .where(eq(qboSyncRuns.id, syncRun.id))

    return NextResponse.json({ error: 'Report sync failed', detail: message }, { status: 502 })
  }
}

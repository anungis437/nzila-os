// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO Report Sync
 * POST /api/qbo/sync
 *
 * Body: { orgId, reportType, periodStart?, periodEnd? }
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
import { requireOrgAccess } from '@/lib/api-guards'
import { createQboClient } from '@nzila/qbo/client'
import { getValidToken, isAccessTokenExpired } from '@nzila/qbo/oauth'
import type { QboTokenSet } from '@nzila/qbo/types'
import { createHash } from 'crypto'
import { uploadBuffer } from '@nzila/blob'
import { createLogger } from '@nzila/os-core'
import { encryptToken, decryptToken } from '@/lib/qbo-token-crypto'

const logger = createLogger('qbo:sync')

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
  orgId: z.string().min(1),
  reportType: z.string().min(1),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = QboSyncSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'orgId and reportType required' }, { status: 400 })
  }
  const { orgId, reportType, periodStart, periodEnd } = parsed.data

  const qboReportName = REPORT_NAME_MAP[reportType as string]
  if (!qboReportName) {
    return NextResponse.json(
      { error: `Unknown reportType. Valid: ${Object.keys(REPORT_NAME_MAP).join(', ')}` },
      { status: 400 },
    )
  }

  const access = await requireOrgAccess(orgId, { minRole: 'org_secretary' })
  if (!access.ok) return access.response

  // ── Load connection ─────────────────────────────────────────────────────

  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(
      eq(qboConnections.orgId, orgId),
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

  // Reconstruct QboTokenSet from the DB row (decrypt from storage)
  let tokenSet: QboTokenSet = {
    access_token: decryptToken(tokenRow.accessToken),
    refresh_token: decryptToken(tokenRow.refreshToken),
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
        accessToken: encryptToken(refreshed.access_token),
        refreshToken: encryptToken(refreshed.refresh_token),
        accessTokenExpiresAt: newAccessExpiresAt,
        refreshTokenExpiresAt: newRefreshExpiresAt,
      })
    })
  }

  // ── Create sync run ─────────────────────────────────────────────────────

  const [syncRun] = await platformDb
    .insert(qboSyncRuns)
    .values({
      orgId,
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

    // Store report JSON in Azure Blob Storage
    const blobPath = `qbo-reports/${orgId}/${reportType}/${syncRun.id}.json`
    const { blobPath: storedPath } = await uploadBuffer({
      container: 'documents',
      blobPath,
      buffer: Buffer.from(reportJson, 'utf-8'),
      contentType: 'application/json',
    })
    const documentId = storedPath

    const [reportRow] = await platformDb
      .insert(qboReports)
      .values({
        orgId,
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
    logger.error('[QBO] Report sync failed', { detail: message })

    await platformDb
      .update(qboSyncRuns)
      .set({ status: 'failed', completedAt: new Date(), errorMessage: message })
      .where(eq(qboSyncRuns.id, syncRun.id))

    return NextResponse.json({ error: 'Report sync failed', detail: message }, { status: 502 })
  }
}

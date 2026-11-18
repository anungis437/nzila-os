import { platformDb } from '@nzila/db/platform'
import { qboConnections, qboTokens, qboSyncRuns, qboReports } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { createQboClient } from '@nzila/qbo/client'
import { getValidToken, isAccessTokenExpired, revokeToken } from '@nzila/qbo/oauth'
import type { QboTokenSet } from '@nzila/qbo/types'
import { createHash } from 'node:crypto'
import { uploadBuffer } from '@nzila/blob'
import { createLogger } from '@nzila/os-core'
import { encryptToken, decryptToken } from '@/lib/qbo-token-crypto'
const logger = createLogger('qbo:service')

export async function persistQboConnection(
  orgId: string,
  realmId: string,
  userId: string,
  tokenSet: QboTokenSet,
) {
  const now = new Date()
  const accessTokenExpiresAt = new Date(tokenSet.obtainedAt + tokenSet.expires_in * 1000)
  const refreshTokenExpiresAt = new Date(
    tokenSet.obtainedAt + tokenSet.x_refresh_token_expires_in * 1000,
  )

  await platformDb.transaction(async (tx) => {
    // Mark any existing active connection for this entity+realmId inactive
    await tx
      .update(qboConnections)
      .set({ isActive: false, disconnectedAt: now, updatedAt: now })
      .where(and(eq(qboConnections.orgId, orgId), eq(qboConnections.realmId, realmId)))

    // Create fresh connection
    const [connection] = await tx
      .insert(qboConnections)
      .values({
        orgId,
        realmId,
        isActive: true,
        connectedBy: userId,
        connectedAt: now,
      })
      .returning()

    // Encrypt tokens before storage (AES-256-GCM envelope encryption)
    await tx.insert(qboTokens).values({
      connectionId: connection.id,
      accessToken: encryptToken(tokenSet.access_token),
      refreshToken: encryptToken(tokenSet.refresh_token),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    })
  })
}

export async function readQboConnectionStatus(orgId: string) {
  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(eq(qboConnections.orgId, orgId), eq(qboConnections.isActive, true)),
    orderBy: [desc(qboConnections.connectedAt)],
  })
  if (!connection) {
    return {
      status: 200 as const,
      body: { connected: false },
    }
  }
  const tokenRow = await platformDb.query.qboTokens.findFirst({
    where: eq(qboTokens.connectionId, connection.id),
    orderBy: [desc(qboTokens.createdAt)],
  })
  return {
    status: 200 as const,
    body: {
      connected: true,
      realmId: connection.realmId,
      companyName: connection.companyName,
      connectedAt: connection.connectedAt,
      connectedBy: connection.connectedBy,
      tokenStatus: tokenRow
        ? {
            accessTokenExpiresAt: tokenRow.accessTokenExpiresAt,
            refreshTokenExpiresAt: tokenRow.refreshTokenExpiresAt,
          }
        : null,
    },
  }
}

export async function disconnectQboConnection(orgId: string) {
  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(eq(qboConnections.orgId, orgId), eq(qboConnections.isActive, true)),
  })
  if (!connection) {
    return {
      status: 404 as const,
      body: { error: 'No active QBO connection' },
    }
  }
  const tokenRow = await platformDb.query.qboTokens.findFirst({
    where: eq(qboTokens.connectionId, connection.id),
    orderBy: [desc(qboTokens.createdAt)],
  })
  // Best-effort revoke — don't fail if Intuit is down
  if (tokenRow) {
    await revokeToken(decryptToken(tokenRow.refreshToken)).catch((err: unknown) =>
      logger.warn('[QBO] Token revocation failed (continuing disconnect)', {
        error: err instanceof Error ? err.message : String(err),
      }),
    )
  }
  const now = new Date()
  await platformDb
    .update(qboConnections)
    .set({ isActive: false, disconnectedAt: now, updatedAt: now })
    .where(and(eq(qboConnections.id, connection.id), eq(qboConnections.orgId, orgId)))
  return {
    status: 200 as const,
    body: { disconnected: true },
  }
}
// QBO report name → API report name mapping
export const QBO_REPORT_NAME_MAP: Record<string, string> = {
  trial_balance: 'TrialBalance',
  profit_and_loss: 'ProfitAndLoss',
  balance_sheet: 'BalanceSheet',
  cash_flow: 'CashFlow',
  aging_receivable: 'AgedReceivables',
  aging_payable: 'AgedPayables',
  general_ledger: 'GeneralLedger',
}

export async function synchronizeQboReport(
  input: { orgId: string; reportType: string; periodStart?: string; periodEnd?: string },
  qboReportName: string,
) {
  const { orgId, reportType, periodStart, periodEnd } = input
  // ── Load connection ─────────────────────────────────────────────────────
  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(eq(qboConnections.orgId, orgId), eq(qboConnections.isActive, true)),
  })
  if (!connection) {
    return {
      status: 404 as const,
      body: { error: 'No active QBO connection for entity' },
    }
  }
  const tokenRow = await platformDb.query.qboTokens.findFirst({
    where: eq(qboTokens.connectionId, connection.id),
    orderBy: [desc(qboTokens.createdAt)],
  })
  if (!tokenRow) {
    return {
      status: 404 as const,
      body: { error: 'No tokens found for connection' },
    }
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
      const newRefreshExpiresAt = new Date(Date.now() + refreshed.x_refresh_token_expires_in * 1000)
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
      reportType: reportType as (typeof qboSyncRuns.$inferInsert)['reportType'],
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
        reportType: reportType as (typeof qboReports.$inferInsert)['reportType'],
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
      .where(and(eq(qboSyncRuns.id, syncRun.id), eq(qboSyncRuns.orgId, orgId)))
    return {
      status: 200 as const,
      body: {
        syncRunId: syncRun.id,
        reportId: reportRow.id,
        reportType,
        sha256,
        periodStart,
        periodEnd,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[QBO] Report sync failed', { detail: message })
    await platformDb
      .update(qboSyncRuns)
      .set({ status: 'failed', completedAt: new Date(), errorMessage: message })
      .where(and(eq(qboSyncRuns.id, syncRun.id), eq(qboSyncRuns.orgId, orgId)))
    return {
      status: 502 as const,
      body: { error: 'Report sync failed', detail: message },
    }
  }
}

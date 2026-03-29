// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO Connection Status + Disconnect
 *
 * GET    /api/qbo/status?orgId=...   → current connection info
 * DELETE /api/qbo/status?orgId=...   → revoke tokens + disconnect
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { qboConnections, qboTokens } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireOrgAccess } from '@/lib/api-guards'
import { revokeToken } from '@nzila/qbo/oauth'
import { createLogger } from '@nzila/os-core'
import { decryptToken } from '@/lib/qbo-token-crypto'

const logger = createLogger('qbo:status')

// ── GET — connection status ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  }

  const access = await requireOrgAccess(orgId)
  if (!access.ok) return access.response

  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(
      eq(qboConnections.orgId, orgId),
      eq(qboConnections.isActive, true),
    ),
    orderBy: [desc(qboConnections.connectedAt)],
  })

  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  const tokenRow = await platformDb.query.qboTokens.findFirst({
    where: eq(qboTokens.connectionId, connection.id),
    orderBy: [desc(qboTokens.createdAt)],
  })

  return NextResponse.json({
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
  })
}

// ── DELETE — disconnect ───────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const entityIdResult = z.string().min(1).safeParse(req.nextUrl.searchParams.get('orgId'))
  if (!entityIdResult.success) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  }
  const orgId = entityIdResult.data

  const access = await requireOrgAccess(orgId, { minRole: 'org_admin' })
  if (!access.ok) return access.response

  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(
      eq(qboConnections.orgId, orgId),
      eq(qboConnections.isActive, true),
    ),
  })

  if (!connection) {
    return NextResponse.json({ error: 'No active QBO connection' }, { status: 404 })
  }

  const tokenRow = await platformDb.query.qboTokens.findFirst({
    where: eq(qboTokens.connectionId, connection.id),
    orderBy: [desc(qboTokens.createdAt)],
  })

  // Best-effort revoke — don't fail if Intuit is down
  if (tokenRow) {
    await revokeToken(decryptToken(tokenRow.refreshToken)).catch((err: unknown) =>
      logger.warn('[QBO] Token revocation failed (continuing disconnect)', { error: err instanceof Error ? err.message : String(err) }),
    )
  }

  const now = new Date()
  await platformDb
    .update(qboConnections)
    .set({ isActive: false, disconnectedAt: now, updatedAt: now })
    .where(eq(qboConnections.id, connection.id))

  return NextResponse.json({ disconnected: true })
}

// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO Connection Status + Disconnect
 *
 * GET    /api/qbo/status?entityId=...   → current connection info
 * DELETE /api/qbo/status?entityId=...   → revoke tokens + disconnect
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { qboConnections, qboTokens } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { revokeToken } from '@nzila/qbo/oauth'

// ── GET — connection status ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get('entityId')
  if (!entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }

  const access = await requireEntityAccess(entityId)
  if (!access.ok) return access.response

  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(
      eq(qboConnections.entityId, entityId),
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
  const entityIdResult = z.string().min(1).safeParse(req.nextUrl.searchParams.get('entityId'))
  if (!entityIdResult.success) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }
  const entityId = entityIdResult.data

  const access = await requireEntityAccess(entityId, { minRole: 'entity_admin' })
  if (!access.ok) return access.response

  const connection = await platformDb.query.qboConnections.findFirst({
    where: and(
      eq(qboConnections.entityId, entityId),
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
    await revokeToken(tokenRow.refreshToken).catch((err: unknown) =>
      console.warn('[QBO] Token revocation failed (continuing disconnect):', err),
    )
  }

  const now = new Date()
  await platformDb
    .update(qboConnections)
    .set({ isActive: false, disconnectedAt: now, updatedAt: now })
    .where(eq(qboConnections.id, connection.id))

  return NextResponse.json({ disconnected: true })
}

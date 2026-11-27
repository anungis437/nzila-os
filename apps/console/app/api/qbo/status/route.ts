import {
  readQboConnectionStatus,
  disconnectQboConnection,
} from '@/lib/services/qbo-connection-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — QBO Connection Status + Disconnect
 *
 * GET    /api/qbo/status?orgId=...   → current connection info
 * DELETE /api/qbo/status?orgId=...   → revoke tokens + disconnect
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireOrgAccess } from '@/lib/api-guards'

// ── GET — connection status ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  }

  const access = await requireOrgAccess(orgId)
  if (!access.ok) return access.response

  const result = await readQboConnectionStatus(orgId)
  return NextResponse.json(result.body, { status: result.status })
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

  const result = await disconnectQboConnection(orgId)
  return NextResponse.json(result.body, { status: result.status })
}

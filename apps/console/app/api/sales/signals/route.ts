import { collectSalesSignals } from '@/lib/services/sales-signals-service'
/**
 * GET /api/sales/signals
 *
 * CRM-ready sales follow-up signals from platform data.
 * Restricted to platform operators.
 *
 * Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
 */

import { NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { sessionClaims } = await auth()
  const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined
  const role = meta?.nzilaRole as string | undefined
  const allowedRoles = ['platform_admin', 'studio_admin', 'ops']

  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  try {
    const result = await collectSalesSignals()
    return NextResponse.json(result.body, { status: result.status })
  } catch {
    return NextResponse.json({ ok: false, error: 'signal_export_unavailable' }, { status: 503 })
  }
}

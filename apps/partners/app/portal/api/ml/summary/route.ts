// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /portal/api/ml/summary
 *
 * Returns ML anomaly summary for a partner-entitled entity.
 * Aggregate-only: daily anomaly counts, no per-transaction details,
 * no raw feature vectors, no model internals.
 *
 * RBAC:
 *   - Clerk session required (via partner portal)
 *   - partnerEntities row with `ml:summary` in allowedViews
 *   - ml:summary feature gate (tier ≥ registered)
 *
 * Query params:
 *   entityId    optional — when omitted the route self-resolves the first
 *               entity the partner org is entitled to view (allows pages to
 *               call without direct DB access)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPartnerMlSummary } from '@nzila/ml-sdk/server'
import { requirePartnerEntityAccess, resolvePartnerEntityIdForView } from '@/lib/partner-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityIdParam = searchParams.get('entityId')

    // ── Entitlement check ────────────────────────────────────────────────────
    // If entityId is provided, verify the caller is entitled to that specific
    // entity.  If omitted, self-resolve the first entitled entity for this
    // partner org — so pages can call without needing direct DB access.
    let entityId: string
    if (entityIdParam) {
      const access = await requirePartnerEntityAccess(entityIdParam, 'ml:summary')
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }
      entityId = entityIdParam
    } else {
      const resolved = await resolvePartnerEntityIdForView('ml:summary')
      if (!resolved) {
        return NextResponse.json(
          { error: 'No ml:summary entitlement found for this organisation' },
          { status: 403 },
        )
      }
      entityId = resolved
    }

    // ── Fetch aggregate ML data via ml-sdk server layer ──────────────────────
    // ML tables are accessed via @nzila/ml-sdk/server (INV-02: no direct table reads)
    const summary = await getPartnerMlSummary(entityId)

    return NextResponse.json(summary)
  } catch (err) {
    console.error('[Partner ML /summary]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


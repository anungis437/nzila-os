/**
 * TrustCore — Evidence Bundle Export
 *
 * GET /api/export/evidence
 *
 * Returns all evidence events for the authenticated org,
 * grouped by entityType and ordered chronologically.
 *
 * Access: org_admin, auditor
 * Plan:   PRO / PREMIUM required
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { listTrustcoreEvidenceEvents } from '@nzila/db/queries/trustcore'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import { gateEvidenceExport } from '@/lib/billing/featureAccess'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
    // ── Billing gate ──────────────────────────────────────────────────────
    const subscription = await getResolvedSubscription(ctx.orgId)
    const gate = gateEvidenceExport(subscription)
    if (!gate.allowed) {
      return NextResponse.json(
        { success: false, error: gate.error, feature: gate.feature, message: gate.message },
        { status: 403 },
      )
    }

    const events = await listTrustcoreEvidenceEvents(ctx.orgId)

    // Group by entityType, ordered chronologically within each group
    const grouped: Record<string, typeof events> = {}
    for (const event of events) {
      if (!grouped[event.entityType]) {
        grouped[event.entityType] = []
      }
      grouped[event.entityType]!.push(event)
    }

    const bundle = {
      exportedAt: new Date().toISOString(),
      orgId: ctx.orgId,
      totalEvents: events.length,
      evidenceStatement:
        'This evidence bundle is generated from an immutable audit log. All events are recorded with actor, timestamp, and action attribution.',
      eventsByType: grouped,
      allEvents: events, // flat list for programmatic consumers
    }

    return NextResponse.json(
      { success: true, data: bundle },
      {
        headers: {
          'Content-Disposition': `attachment; filename="trustcore-evidence-${ctx.orgId}-${Date.now()}.json"`,
          'Cache-Control': 'no-store',
        },
      },
    )
  },
)

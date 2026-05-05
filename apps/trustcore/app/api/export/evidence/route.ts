/**
 * TrustCore — Evidence Bundle Export
 *
 * GET /api/export/evidence
 *
 * Returns all evidence events for the authenticated org,
 * grouped by entityType and ordered chronologically.
 *
 * Access: org_admin, auditor
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { listTrustcoreEvidenceEvents } from '@nzila/db/queries/trustcore'

export const GET = withRequiredRole(
  ['org_admin', 'auditor', 'platform_admin'],
  async (_request: NextRequest, ctx) => {
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

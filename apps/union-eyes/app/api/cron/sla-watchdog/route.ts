/**
 * POST /api/cron/sla-watchdog
 *
 * Background worker invoked on a cron schedule (every minute via external
 * scheduler or Vercel / Azure cron). Scans all non-terminal claims, checks
 * SLA compliance, and emits alert events for claims nearing or past breach.
 *
 * Security: Guarded by CRON_SECRET header so only the scheduler can invoke.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/db'
import { claims } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { eventBus } from '@/lib/events/event-bus'
import { logger } from '@/lib/logger'
import { timingSafeEqual } from 'crypto'
import {
  CLAIM_SLA_STANDARDS,
  type ClaimStatus,
  type ClaimPriority,
} from '@/lib/services/claim-workflow-fsm'

export const dynamic = 'force-dynamic'

const PRIORITY_MULTIPLIERS: Record<string, number> = {
  critical: 0.5,
  high: 0.75,
  medium: 1.0,
  low: 1.5,
}

function slaDeadline(
  status: ClaimStatus,
  priority: ClaimPriority,
  statusChangedAt: Date,
): Date {
  const baseHours = CLAIM_SLA_STANDARDS[status] ?? 0
  const multiplier = PRIORITY_MULTIPLIERS[priority] ?? 1
  const d = new Date(statusChangedAt)
  d.setHours(d.getHours() + baseHours * multiplier)
  return d
}

export async function POST(request: NextRequest) {
  // Authenticate via shared secret
  const secret = request.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET ?? ''
  const secretsMatch =
    secret.length === expected.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  if (!secretsMatch && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch all active (non-terminal) claims
    const activeClaims = await db
      .select({
        claimId: claims.claimId,
        claimNumber: claims.claimNumber,
        status: claims.status,
        priority: claims.priority,
        organizationId: claims.organizationId,
        assignedTo: claims.assignedTo,
        updatedAt: claims.updatedAt,
        createdAt: claims.createdAt,
      })
      .from(claims)
      .where(sql`${claims.status} NOT IN ('closed', 'resolved', 'rejected')`)

    const now = new Date()
    let atRiskCount = 0
    let breachedCount = 0

    for (const c of activeClaims) {
      const status = c.status as ClaimStatus
      const priority = (c.priority as ClaimPriority) || 'medium'
      const changedAt = c.updatedAt ?? c.createdAt ?? now

      const deadline = slaDeadline(status, priority, changedAt)
      const msRemaining = deadline.getTime() - now.getTime()
      const hoursRemaining = msRemaining / (1000 * 60 * 60)
      const totalHours = (CLAIM_SLA_STANDARDS[status] ?? 1) * (PRIORITY_MULTIPLIERS[priority] ?? 1)

      // At-risk: less than 20% of SLA time remaining
      const atRisk = hoursRemaining > 0 && hoursRemaining < totalHours * 0.2
      const breached = hoursRemaining <= 0

      if (breached) {
        breachedCount++
        eventBus.emit('claim_events', {
          claim_id: c.claimId,
          event_type: 'sla_breached',
          actor: 'system:sla-watchdog',
          timestamp: now.toISOString(),
          payload: {
            claimNumber: c.claimNumber,
            status,
            priority,
            deadline: deadline.toISOString(),
            hoursOverdue: Math.abs(hoursRemaining).toFixed(1),
            organizationId: c.organizationId,
            assignedTo: c.assignedTo,
          },
        }, {
          organizationId: c.organizationId ?? undefined,
          source: 'sla-watchdog',
        })
      } else if (atRisk) {
        atRiskCount++
        eventBus.emit('claim_events', {
          claim_id: c.claimId,
          event_type: 'sla_at_risk',
          actor: 'system:sla-watchdog',
          timestamp: now.toISOString(),
          payload: {
            claimNumber: c.claimNumber,
            status,
            priority,
            deadline: deadline.toISOString(),
            hoursRemaining: hoursRemaining.toFixed(1),
            organizationId: c.organizationId,
            assignedTo: c.assignedTo,
          },
        }, {
          organizationId: c.organizationId ?? undefined,
          source: 'sla-watchdog',
        })
      }
    }

    logger.info('SLA watchdog run complete', {
      totalActive: activeClaims.length,
      atRisk: atRiskCount,
      breached: breachedCount,
    })

    return NextResponse.json({
      scanned: activeClaims.length,
      at_risk: atRiskCount,
      breached: breachedCount,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    logger.error('SLA watchdog failed', { error: String(err) })
    return NextResponse.json({ error: 'Watchdog failed' }, { status: 500 })
  }
}

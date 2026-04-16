/**
 * POST /api/cron/sla-watchdog
 *
 * Background worker invoked on a cron schedule (every minute via external
 * scheduler or Vercel / Azure cron). Scans all non-terminal claims, checks
 * SLA compliance, and emits alert events for claims nearing or past breach.
 *
 * Protected by withApi cron auth (Phase 7 — Workflow Realignment).
 */
import { db } from '@/db/db'
import { claims } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { eventBus } from '@/lib/events/event-bus'
import { logger } from '@/lib/logger'
import { withApi } from '@/lib/api/framework'
import { trackPilotEvent } from '@/lib/services/pilot-tracking'
import {
  CLAIM_SLA_STANDARDS,
  type ClaimStatus,
  type ClaimPriority,
} from '@/lib/services/claim-workflow-fsm'
import { recordUnionEyesSlaCompliance, recordUnionEyesSlaWatchdog } from '@/lib/pilot-metrics'

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

export const POST = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'SLA watchdog — scan claims for SLA compliance' },
  },
  async () => {
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

        if (c.organizationId) {
          await trackPilotEvent({
            userId: 'system:sla-watchdog',
            organizationId: c.organizationId,
            sessionId: `system:${c.claimId}`,
            eventType: 'sla_breached',
            metadata: {
              claimId: c.claimId,
              claimNumber: c.claimNumber,
              status,
              priority,
            },
          })
        }
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

        eventBus.emit('claim_events', {
          claim_id: c.claimId,
          event_type: 'sla_breach_risk',
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

        if (c.organizationId) {
          await trackPilotEvent({
            userId: 'system:sla-watchdog',
            organizationId: c.organizationId,
            sessionId: `system:${c.claimId}`,
            eventType: 'sla_breach_risk',
            metadata: {
              claimId: c.claimId,
              claimNumber: c.claimNumber,
              status,
              priority,
            },
          })
        }
      }
    }

    logger.info('SLA watchdog run complete', {
      totalActive: activeClaims.length,
      atRisk: atRiskCount,
      breached: breachedCount,
    })

    const watchdogTraceId = `sla-watchdog:${now.toISOString()}`
    const orgCounts = new Map<string, { breached: number; atRisk: number; compliant: number; scanned: number }>()
    for (const c of activeClaims) {
      if (!c.organizationId) continue
      const current = orgCounts.get(c.organizationId) ?? { breached: 0, atRisk: 0, compliant: 0, scanned: 0 }
      const status = c.status as ClaimStatus
      const priority = (c.priority as ClaimPriority) || 'medium'
      const changedAt = c.updatedAt ?? c.createdAt ?? now
      const deadline = slaDeadline(status, priority, changedAt)
      const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
      const totalHours = (CLAIM_SLA_STANDARDS[status] ?? 1) * (PRIORITY_MULTIPLIERS[priority] ?? 1)
      current.scanned += 1
      if (hoursRemaining <= 0) current.breached += 1
      else {
        current.compliant += 1
        if (hoursRemaining < totalHours * 0.2) current.atRisk += 1
      }
      orgCounts.set(c.organizationId, current)
    }

    for (const [orgId, counts] of orgCounts.entries()) {
      recordUnionEyesSlaWatchdog(orgId, counts.breached, counts.atRisk, watchdogTraceId).catch((err) =>
        logger.warn('Pilot metric emit failed', { error: String(err), metric: 'sla_breach_count', orgId }),
      )

      recordUnionEyesSlaCompliance(orgId, counts.compliant, counts.scanned, watchdogTraceId).catch((err) =>
        logger.warn('Pilot metric emit failed', { error: String(err), metric: 'sla_compliance_rate', orgId }),
      )
    }

    return {
      scanned: activeClaims.length,
      at_risk: atRiskCount,
      breached: breachedCount,
      timestamp: now.toISOString(),
    }
  },
)

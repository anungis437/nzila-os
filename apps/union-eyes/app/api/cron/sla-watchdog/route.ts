/**
 * POST /api/cron/sla-watchdog
 *
 * Background worker run by the scheduler (see lib/operations/scheduled-jobs.json). Scans the non-terminal claims, assesses each
 * against its SLA once, writes a durable inbox alert for the steward each late or at-risk claim is assigned to, and records the
 * organization's SLA metrics.
 *
 * Protected by withApi cron auth.
 *
 * The claims are read across organizations by SYSTEM authority (a cross-organization SELECT on claims only). The alerts are
 * tenant rows, so each organization's alerts are written inside that organization's own context. A claim with no assignee has no
 * one to alert; it is counted in the result so the gap is visible instead of silent.
 */
import { and, asc, gt, sql } from 'drizzle-orm'
import { db } from '@/db/db'
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
import { claims } from '@/db/schema'
import { logger } from '@/lib/logger'
import { withApi } from '@/lib/api/framework'
import { recordUnionEyesSlaCompliance, recordUnionEyesSlaWatchdog } from '@/lib/pilot-metrics'
import { jobResponse, type JobFailure } from '@/lib/operations/job-result'
import {
  MAX_ALERTS_PER_ORGANIZATION,
  MAX_SCAN_PAGES,
  SCAN_PAGE_SIZE,
  assessClaim,
  emptyTally,
  tally,
  writeSlaAlerts,
  type OrganizationTally,
  type ScannedClaim,
} from '@/lib/workflow/sla-alerts'

export const dynamic = 'force-dynamic'

const WATCHDOG_ACTOR = 'system:sla-watchdog'

export const POST = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'SLA watchdog — scan claims for SLA compliance' },
  },
  async () => {
    const now = new Date()
    const failures: JobFailure[] = []
    const organizations = new Map<string, OrganizationTally>()
    let scanned = 0
    let withoutOrganization = 0

    // Keyset-paged so a run never holds every active claim, and each page is bounded.
    let after: string | null = null
    let pages = 0
    for (;;) {
      if (pages >= MAX_SCAN_PAGES) {
        failures.push({ scope: 'scan', reason: `stopped after ${MAX_SCAN_PAGES} pages; the remaining claims were not assessed` })
        break
      }
      const cursor: string | null = after
      const page: ScannedClaim[] = await withSystemContext(async () =>
        db
          .select({
            claimId: claims.claimId,
            claimNumber: claims.claimNumber,
            status: claims.status,
            priority: claims.priority,
            organizationId: claims.organizationId,
            assignedTo: claims.assignedTo,
            statusChangedAt: claims.statusChangedAt,
            createdAt: claims.createdAt,
          })
          .from(claims)
          .where(and(sql`${claims.status} NOT IN ('closed', 'resolved', 'rejected')`, cursor ? gt(claims.claimId, cursor) : undefined))
          .orderBy(asc(claims.claimId))
          .limit(SCAN_PAGE_SIZE),
      )
      pages += 1
      for (const claim of page) {
        scanned += 1
        if (!claim.organizationId) {
          withoutOrganization += 1
          continue
        }
        const entry = organizations.get(claim.organizationId) ?? emptyTally()
        tally(entry, claim, assessClaim(claim, now))
        organizations.set(claim.organizationId, entry)
      }
      if (page.length < SCAN_PAGE_SIZE) break
      after = page[page.length - 1].claimId
    }

    // The trace id is the organization and the hour, so a rerun in the same hour reports under the same trace.
    const hour = now.toISOString().slice(0, 13)
    let atRisk = 0
    let breached = 0
    let alertsWritten = 0
    let alertsDeferred = 0
    let unassigned = 0

    for (const [organizationId, counts] of organizations) {
      atRisk += counts.atRisk
      breached += counts.breached
      unassigned += counts.unassigned

      const batch = counts.alerts.slice(0, MAX_ALERTS_PER_ORGANIZATION)
      alertsDeferred += counts.alerts.length - batch.length
      try {
        alertsWritten += await withRLSContext({ organizationId, userId: WATCHDOG_ACTOR }, (tx) => writeSlaAlerts(tx, organizationId, batch))
      } catch (error) {
        logger.error('SLA alerts were not written', { organizationId, error: String(error) })
        failures.push({ scope: `alerts:${organizationId}`, reason: 'alert write failed' })
      }

      const traceId = `sla-watchdog:${organizationId}:${hour}`
      const results = await Promise.allSettled([
        recordUnionEyesSlaWatchdog(organizationId, counts.breached, counts.atRisk, traceId),
        recordUnionEyesSlaCompliance(organizationId, counts.compliant, counts.scanned, traceId),
      ])
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.warn('Pilot metric emit failed', { error: String(result.reason), metric: index === 0 ? 'sla_breach_count' : 'sla_compliance_rate', organizationId })
          failures.push({ scope: `metrics:${organizationId}`, reason: 'pilot metric not recorded' })
        }
      })
    }

    logger.info('SLA watchdog run complete', { scanned, atRisk, breached, alertsWritten, alertsDeferred, unassigned, withoutOrganization })

    return jobResponse({
      job: 'sla-watchdog',
      attempted: organizations.size,
      succeeded: organizations.size - new Set(failures.map((f) => f.scope.split(':')[1]).filter(Boolean)).size,
      failures,
      details: {
        scanned,
        at_risk: atRisk,
        breached,
        alerts_written: alertsWritten,
        alerts_deferred: alertsDeferred,
        unassigned_claims: unassigned,
        claims_without_organization: withoutOrganization,
        timestamp: now.toISOString(),
      },
    })
  },
)

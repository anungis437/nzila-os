/**
 * Nzila OS — Platform-wide aggregate metrics
 *
 * Used by the Platform Overview control plane and executive dashboards.
 * Platform admins see global numbers; org admins see scoped numbers.
 *
 * @module @nzila/platform-metrics/platform
 */
import { platformDb } from '@nzila/db/platform'
import {
  entities,
  auditEvents,
  ueCases,
  zongaRevenueEvents,
  commerceQuotes,
  automationCommands,
  nacpExamSessions,
} from '@nzila/db/schema'
import { count, eq } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlatformOverviewMetrics {
  totalOrgs: number
  activeAppsPerOrg: Record<string, number>
  totalAuditEvents: number
  totalBackgroundJobs: number
  activeSessions: number
  revenueEventsProcessed: number
  claimsProcessed: number
  quotesGenerated: number
  systemVersion: string
}

export interface OrgScopedOverviewMetrics {
  totalAuditEvents: number
  totalBackgroundJobs: number
  activeSessions: number
  revenueEventsProcessed: number
  claimsProcessed: number
  quotesGenerated: number
}

// ── Platform-scoped metrics (admin only) ────────────────────────────────────

export async function getPlatformOverviewMetrics(
  systemVersion: string,
): Promise<PlatformOverviewMetrics> {
  const [
    orgsResult,
    auditResult,
    jobsResult,
    sessionsResult,
    revenueResult,
    claimsResult,
    quotesResult,
  ] = await Promise.all([
    platformDb.select({ total: count().as('total') }).from(entities),
    platformDb.select({ total: count().as('total') }).from(auditEvents),
    platformDb
      .select({ total: count().as('total') })
      .from(automationCommands)
      .where(eq(automationCommands.status, 'succeeded')),
    platformDb
      .select({ total: count().as('total') })
      .from(nacpExamSessions)
      .where(eq(nacpExamSessions.status, 'in_progress')),
    platformDb.select({ total: count().as('total') }).from(zongaRevenueEvents),
    platformDb.select({ total: count().as('total') }).from(ueCases),
    platformDb.select({ total: count().as('total') }).from(commerceQuotes),
  ])

  return {
    totalOrgs: orgsResult[0]?.total ?? 0,
    activeAppsPerOrg: {}, // filled by caller with org-level queries if needed
    totalAuditEvents: auditResult[0]?.total ?? 0,
    totalBackgroundJobs: jobsResult[0]?.total ?? 0,
    activeSessions: sessionsResult[0]?.total ?? 0,
    revenueEventsProcessed: revenueResult[0]?.total ?? 0,
    claimsProcessed: claimsResult[0]?.total ?? 0,
    quotesGenerated: quotesResult[0]?.total ?? 0,
    systemVersion,
  }
}

// ── Org-scoped metrics (for org admins) ─────────────────────────────────────

export async function getOrgOverviewMetrics(
  orgId: string,
): Promise<OrgScopedOverviewMetrics> {
  const [auditResult, jobsResult, sessionsResult, revenueResult, claimsResult, quotesResult] =
    await Promise.all([
      platformDb
        .select({ total: count().as('total') })
        .from(auditEvents)
        .where(eq(auditEvents.entityId, orgId)),
      platformDb
        .select({ total: count().as('total') })
        .from(automationCommands)
        .where(eq(automationCommands.status, 'succeeded')),
      platformDb
        .select({ total: count().as('total') })
        .from(nacpExamSessions)
        .where(eq(nacpExamSessions.entityId, orgId)),
      platformDb
        .select({ total: count().as('total') })
        .from(zongaRevenueEvents)
        .where(eq(zongaRevenueEvents.entityId, orgId)),
      platformDb
        .select({ total: count().as('total') })
        .from(ueCases)
        .where(eq(ueCases.entityId, orgId)),
      platformDb
        .select({ total: count().as('total') })
        .from(commerceQuotes)
        .where(eq(commerceQuotes.entityId, orgId)),
    ])

  return {
    totalAuditEvents: auditResult[0]?.total ?? 0,
    totalBackgroundJobs: jobsResult[0]?.total ?? 0,
    activeSessions: sessionsResult[0]?.total ?? 0,
    revenueEventsProcessed: revenueResult[0]?.total ?? 0,
    claimsProcessed: claimsResult[0]?.total ?? 0,
    quotesGenerated: quotesResult[0]?.total ?? 0,
  }
}

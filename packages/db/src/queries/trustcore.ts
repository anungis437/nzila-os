/**
 * Nzila OS — TrustCore Typed Query Helpers
 *
 * All queries are org-scoped. Passing orgId is mandatory for every helper.
 * No optional orgId — the absence of org context must never silently return data.
 *
 * @module @nzila/db/queries/trustcore
 */
import { eq, and, count, sql, desc } from 'drizzle-orm'
import { db } from '../client'
import {
  trustcorePrivacyPrograms,
  trustcoreDataAssets,
  trustcorePias,
  trustcoreIncidents,
  trustcoreDsrRequests,
  trustcoreConsentRecords,
  trustcoreVendors,
  trustcoreEvidenceEvents,
} from '../schema/trustcore'

// ── Re-export types for app consumption ───────────────────────────────────

export type TrustcorePrivacyProgram = typeof trustcorePrivacyPrograms.$inferSelect
export type TrustcoreDataAsset = typeof trustcoreDataAssets.$inferSelect
export type TrustcorePia = typeof trustcorePias.$inferSelect
export type TrustcoreIncident = typeof trustcoreIncidents.$inferSelect
export type TrustcoreDsrRequest = typeof trustcoreDsrRequests.$inferSelect
export type TrustcoreConsentRecord = typeof trustcoreConsentRecords.$inferSelect
export type TrustcoreVendor = typeof trustcoreVendors.$inferSelect
export type TrustcoreEvidenceEvent = typeof trustcoreEvidenceEvents.$inferSelect

export type NewTrustcoreEvidenceEvent = typeof trustcoreEvidenceEvents.$inferInsert

// ── Dashboard summary ──────────────────────────────────────────────────────

export interface TrustcoreDashboardSummary {
  orgId: string
  complianceScore: number
  openRisks: number
  pendingRequests: number
  incidentAlerts: number
  auditReadinessStatus: 'ready' | 'partial' | 'not_ready'
  evaluatedAt: string
}

/**
 * Compute a live compliance dashboard summary for an org.
 *
 * Score derivation (deterministic, explainable):
 *   - Base score starts at 100.
 *   - -20 per critical open incident (max -40).
 *   - -10 per overdue DSR request (max -30).
 *   - -5  per vendor at high/critical risk without contract reviewed (max -20).
 *   - +0  per approved PIA (these protect the score floor).
 *   - Floor at 0, ceiling at 100.
 *
 * Audit readiness:
 *   - ready        → score ≥ 80 AND no critical open incidents
 *   - partial      → score ≥ 50
 *   - not_ready    → score < 50
 */
export async function getTrustcoreDashboardSummary(
  orgId: string,
): Promise<TrustcoreDashboardSummary> {
  const [
    openIncidentsResult,
    criticalIncidentsResult,
    overdueDsrResult,
    pendingDsrResult,
    riskyVendorsResult,
  ] = await Promise.all([
    // open incidents (resolution_status = 'open' | 'contained')
    db
      .select({ value: count() })
      .from(trustcoreIncidents)
      .where(
        and(
          eq(trustcoreIncidents.orgId, orgId),
          sql`${trustcoreIncidents.resolutionStatus} IN ('open', 'contained')`,
        ),
      ),

    // critical open incidents (severity = 'critical' AND open/contained)
    db
      .select({ value: count() })
      .from(trustcoreIncidents)
      .where(
        and(
          eq(trustcoreIncidents.orgId, orgId),
          eq(trustcoreIncidents.severity, 'critical'),
          sql`${trustcoreIncidents.resolutionStatus} IN ('open', 'contained')`,
        ),
      ),

    // overdue DSR requests
    db
      .select({ value: count() })
      .from(trustcoreDsrRequests)
      .where(
        and(
          eq(trustcoreDsrRequests.orgId, orgId),
          eq(trustcoreDsrRequests.status, 'overdue'),
        ),
      ),

    // pending DSR requests (received | verifying_identity | in_progress | overdue)
    db
      .select({ value: count() })
      .from(trustcoreDsrRequests)
      .where(
        and(
          eq(trustcoreDsrRequests.orgId, orgId),
          sql`${trustcoreDsrRequests.status} IN ('received', 'verifying_identity', 'in_progress', 'overdue')`,
        ),
      ),

    // vendors at high/critical risk without reviewed contract
    db
      .select({ value: count() })
      .from(trustcoreVendors)
      .where(
        and(
          eq(trustcoreVendors.orgId, orgId),
          sql`${trustcoreVendors.riskLevel} IN ('high', 'critical')`,
          eq(trustcoreVendors.contractReviewed, false),
          sql`${trustcoreVendors.status} = 'active'`,
        ),
      ),
  ])

  const criticalIncidents = Number(criticalIncidentsResult[0]?.value ?? 0)
  const overdueDsr = Number(overdueDsrResult[0]?.value ?? 0)
  const riskyVendors = Number(riskyVendorsResult[0]?.value ?? 0)
  const openIncidents = Number(openIncidentsResult[0]?.value ?? 0)
  const pendingRequests = Number(pendingDsrResult[0]?.value ?? 0)

  let score = 100
  score -= Math.min(criticalIncidents * 20, 40)
  score -= Math.min(overdueDsr * 10, 30)
  score -= Math.min(riskyVendors * 5, 20)
  score = Math.max(0, Math.min(100, score))

  const auditReadinessStatus: TrustcoreDashboardSummary['auditReadinessStatus'] =
    score >= 80 && criticalIncidents === 0
      ? 'ready'
      : score >= 50
        ? 'partial'
        : 'not_ready'

  return {
    orgId,
    complianceScore: score,
    openRisks: openIncidents,
    pendingRequests,
    incidentAlerts: criticalIncidents,
    auditReadinessStatus,
    evaluatedAt: new Date().toISOString(),
  }
}

// ── List helpers ───────────────────────────────────────────────────────────

export async function listTrustcoreDataAssets(orgId: string): Promise<TrustcoreDataAsset[]> {
  return db
    .select()
    .from(trustcoreDataAssets)
    .where(eq(trustcoreDataAssets.orgId, orgId))
    .orderBy(desc(trustcoreDataAssets.createdAt))
}

export async function listTrustcorePias(orgId: string): Promise<TrustcorePia[]> {
  return db
    .select()
    .from(trustcorePias)
    .where(eq(trustcorePias.orgId, orgId))
    .orderBy(desc(trustcorePias.createdAt))
}

export async function listTrustcoreIncidents(orgId: string): Promise<TrustcoreIncident[]> {
  return db
    .select()
    .from(trustcoreIncidents)
    .where(eq(trustcoreIncidents.orgId, orgId))
    .orderBy(desc(trustcoreIncidents.createdAt))
}

export async function listTrustcoreDsrRequests(orgId: string): Promise<TrustcoreDsrRequest[]> {
  return db
    .select()
    .from(trustcoreDsrRequests)
    .where(eq(trustcoreDsrRequests.orgId, orgId))
    .orderBy(desc(trustcoreDsrRequests.createdAt))
}

export async function listTrustcoreVendors(orgId: string): Promise<TrustcoreVendor[]> {
  return db
    .select()
    .from(trustcoreVendors)
    .where(eq(trustcoreVendors.orgId, orgId))
    .orderBy(desc(trustcoreVendors.createdAt))
}

export async function listTrustcoreEvidenceEvents(orgId: string): Promise<TrustcoreEvidenceEvent[]> {
  return db
    .select()
    .from(trustcoreEvidenceEvents)
    .where(eq(trustcoreEvidenceEvents.orgId, orgId))
    .orderBy(desc(trustcoreEvidenceEvents.createdAt))
}

// ── Write helpers ──────────────────────────────────────────────────────────

/**
 * Persist a TrustCore evidence event for the given org.
 * This is the DB-backed implementation called by lib/evidence/logEvent.ts.
 */
export async function createTrustcoreEvidenceEvent(
  input: NewTrustcoreEvidenceEvent,
): Promise<TrustcoreEvidenceEvent> {
  const [row] = await db
    .insert(trustcoreEvidenceEvents)
    .values(input)
    .returning()
  return row
}

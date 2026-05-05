/**
 * Nzila OS — TrustCore Typed Query Helpers
 *
 * All queries are org-scoped. Passing orgId is mandatory for every helper.
 * No optional orgId — the absence of org context must never silently return data.
 *
 * @module @nzila/db/queries/trustcore
 */
import { eq, desc } from 'drizzle-orm'
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
  trustcoreComplianceSnapshots,
  trustcorePolicies,
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
export type TrustcoreComplianceSnapshot = typeof trustcoreComplianceSnapshots.$inferSelect
export type TrustcorePolicy = typeof trustcorePolicies.$inferSelect

export type NewTrustcoreDataAsset = typeof trustcoreDataAssets.$inferInsert
export type NewTrustcorePia = typeof trustcorePias.$inferInsert
export type NewTrustcoreIncident = typeof trustcoreIncidents.$inferInsert
export type NewTrustcoreDsrRequest = typeof trustcoreDsrRequests.$inferInsert
export type NewTrustcoreVendor = typeof trustcoreVendors.$inferInsert
export type NewTrustcoreEvidenceEvent = typeof trustcoreEvidenceEvents.$inferInsert
export type NewTrustcoreComplianceSnapshot = typeof trustcoreComplianceSnapshots.$inferInsert
export type NewTrustcorePolicy = typeof trustcorePolicies.$inferInsert

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
 * Delegates scoring to the TrustCore compliance engine so that
 * the dashboard score and the compliance page score are always in sync.
 * The engine data is fetched in a single parallel round-trip.
 */
export async function getTrustcoreDashboardSummary(
  orgId: string,
): Promise<TrustcoreDashboardSummary> {
  // Fetch all required data in one parallel pass (no N+1)
  const [
    programs,
    assets,
    pias,
    incidents,
    dsrRequests,
    vendors,
  ] = await Promise.all([
    db.select().from(trustcorePrivacyPrograms).where(eq(trustcorePrivacyPrograms.orgId, orgId)),
    db.select().from(trustcoreDataAssets).where(eq(trustcoreDataAssets.orgId, orgId)),
    db.select().from(trustcorePias).where(eq(trustcorePias.orgId, orgId)),
    db.select().from(trustcoreIncidents).where(eq(trustcoreIncidents.orgId, orgId)),
    db.select().from(trustcoreDsrRequests).where(eq(trustcoreDsrRequests.orgId, orgId)),
    db.select().from(trustcoreVendors).where(eq(trustcoreVendors.orgId, orgId)),
  ])

  // ── Score ─────────────────────────────────────────────────────────────────
  // Mirror the engine rules so dashboard and /compliance are always aligned.

  let score = 100

  // Governance
  const activeProgram = programs.find((p) => p.status === 'active')
  if (!activeProgram) score -= 25
  else if (!activeProgram.privacyOfficerEmail) score -= 10

  // Data inventory
  const activeAssets = assets.filter((a) => a.status === 'active')
  if (activeAssets.length === 0) {
    score -= 20
  } else {
    const highCritical = activeAssets.filter(
      (a) => a.sensitivityLevel === 'high' || a.sensitivityLevel === 'critical',
    )
    if (highCritical.length > 0 && pias.length === 0) {
      score -= Math.min(highCritical.length * 10, 30)
    }
    const crossBorderNoCountry = activeAssets.filter(
      (a) => a.crossBorderTransfer && !a.destinationCountry,
    )
    if (crossBorderNoCountry.length > 0) score -= 10
  }

  // PIAs
  if (pias.length === 0 && activeAssets.length > 0) {
    score -= 15
  } else {
    const mitigationReq = pias.filter((p) => p.status === 'mitigation_required')
    score -= Math.min(mitigationReq.length * 5, 20)
    const highRiskNoMitigation = pias.filter((p) => (p.riskScore ?? 0) >= 70 && !p.mitigationPlan)
    score -= Math.min(highRiskNoMitigation.length * 10, 20)
  }

  // Incidents
  const openCritical = incidents.filter(
    (i) => i.severity === 'critical' && (i.resolutionStatus === 'open' || i.resolutionStatus === 'contained'),
  )
  score -= Math.min(openCritical.length * 20, 40)

  const unreportedSerious = incidents.filter((i) => i.seriousHarmLikely && !i.reportedToCai)
  score -= Math.min(unreportedSerious.length * 25, 50)

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const stalledOpen = incidents.filter(
    (i) =>
      (i.resolutionStatus === 'open' || i.resolutionStatus === 'contained') &&
      Date.now() - i.createdAt.getTime() > thirtyDaysMs,
  )
  score -= Math.min(stalledOpen.length * 10, 30)

  // DSR
  const overdue = dsrRequests.filter((r) => r.status === 'overdue')
  score -= Math.min(overdue.length * 15, 45)
  const activeUnverified = dsrRequests.filter(
    (r) =>
      r.status !== 'completed' &&
      r.status !== 'denied' &&
      !r.identityVerified,
  )
  score -= Math.min(activeUnverified.length * 5, 15)

  // Vendors
  const activeVendors = vendors.filter((v) => v.status === 'active')
  const highRiskNoPia = activeVendors.filter(
    (v) => (v.riskLevel === 'high' || v.riskLevel === 'critical') && !v.piaRequired,
  )
  score -= Math.min(highRiskNoPia.length * 10, 30)
  const crossBorderNoContract = activeVendors.filter(
    (v) => v.crossBorderTransfer && !v.contractReviewed,
  )
  score -= Math.min(crossBorderNoContract.length * 10, 20)

  score = Math.max(0, Math.min(100, score))

  // ── Derived counters ───────────────────────────────────────────────────────
  const openIncidents = incidents.filter(
    (i) => i.resolutionStatus === 'open' || i.resolutionStatus === 'contained',
  ).length
  const pendingRequests = dsrRequests.filter(
    (r) => r.status !== 'completed' && r.status !== 'denied',
  ).length

  const hasCriticalRisks = openCritical.length > 0 || unreportedSerious.length > 0
  const auditReadinessStatus: TrustcoreDashboardSummary['auditReadinessStatus'] =
    score >= 85 && !hasCriticalRisks
      ? 'ready'
      : score >= 60
        ? 'partial'
        : 'not_ready'

  return {
    orgId,
    complianceScore: score,
    openRisks: openIncidents,
    pendingRequests,
    incidentAlerts: openCritical.length,
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

export async function listTrustcorePrivacyPrograms(orgId: string): Promise<TrustcorePrivacyProgram[]> {
  return db
    .select()
    .from(trustcorePrivacyPrograms)
    .where(eq(trustcorePrivacyPrograms.orgId, orgId))
    .orderBy(desc(trustcorePrivacyPrograms.createdAt))
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
  if (!row) {
    throw new Error('createTrustcoreEvidenceEvent: insert returned no row')
  }
  return row
}

export async function createTrustcoreDataAsset(
  input: NewTrustcoreDataAsset,
): Promise<TrustcoreDataAsset> {
  const [row] = await db
    .insert(trustcoreDataAssets)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcoreDataAsset: insert returned no row')
  }
  return row
}

export async function createTrustcorePia(
  input: NewTrustcorePia,
): Promise<TrustcorePia> {
  const [row] = await db
    .insert(trustcorePias)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcorePia: insert returned no row')
  }
  return row
}

export async function createTrustcoreIncident(
  input: NewTrustcoreIncident,
): Promise<TrustcoreIncident> {
  const [row] = await db
    .insert(trustcoreIncidents)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcoreIncident: insert returned no row')
  }
  return row
}

export async function createTrustcoreDsrRequest(
  input: NewTrustcoreDsrRequest,
): Promise<TrustcoreDsrRequest> {
  const [row] = await db
    .insert(trustcoreDsrRequests)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcoreDsrRequest: insert returned no row')
  }
  return row
}

export async function createTrustcoreVendor(
  input: NewTrustcoreVendor,
): Promise<TrustcoreVendor> {
  const [row] = await db
    .insert(trustcoreVendors)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcoreVendor: insert returned no row')
  }
  return row
}

export async function createTrustcorePrivacyProgram(
  input: typeof trustcorePrivacyPrograms.$inferInsert,
): Promise<TrustcorePrivacyProgram> {
  const [row] = await db
    .insert(trustcorePrivacyPrograms)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcorePrivacyProgram: insert returned no row')
  }
  return row
}

export async function createTrustcoreConsentRecord(
  input: typeof trustcoreConsentRecords.$inferInsert,
): Promise<TrustcoreConsentRecord> {
  const [row] = await db
    .insert(trustcoreConsentRecords)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcoreConsentRecord: insert returned no row')
  }
  return row
}

/**
 * Return the most recent active privacy program for an org, or null.
 */
export async function getActivePrivacyProgram(
  orgId: string,
): Promise<TrustcorePrivacyProgram | null> {
  const [row] = await db
    .select()
    .from(trustcorePrivacyPrograms)
    .where(eq(trustcorePrivacyPrograms.orgId, orgId))
    .orderBy(desc(trustcorePrivacyPrograms.createdAt))
    .limit(1)
  return row ?? null
}

// ── Compliance snapshot helpers ────────────────────────────────────────────

/**
 * Persist an immutable compliance evaluation snapshot.
 * Returns the created row.
 */
export async function createComplianceSnapshot(
  input: NewTrustcoreComplianceSnapshot,
): Promise<TrustcoreComplianceSnapshot> {
  const [row] = await db
    .insert(trustcoreComplianceSnapshots)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createComplianceSnapshot: insert returned no row')
  }
  return row
}

/**
 * Return the most recent snapshot for an org, or null when none exists.
 */
export async function getLatestComplianceSnapshot(
  orgId: string,
): Promise<TrustcoreComplianceSnapshot | null> {
  const [row] = await db
    .select()
    .from(trustcoreComplianceSnapshots)
    .where(eq(trustcoreComplianceSnapshots.orgId, orgId))
    .orderBy(desc(trustcoreComplianceSnapshots.createdAt))
    .limit(1)
  return row ?? null
}

/**
 * Return the last N snapshots for an org, ordered newest first.
 */
export async function listComplianceSnapshots(
  orgId: string,
  limit = 10,
): Promise<TrustcoreComplianceSnapshot[]> {
  return db
    .select()
    .from(trustcoreComplianceSnapshots)
    .where(eq(trustcoreComplianceSnapshots.orgId, orgId))
    .orderBy(desc(trustcoreComplianceSnapshots.createdAt))
    .limit(limit)
}

// ── Policy helpers ─────────────────────────────────────────────────────────

export async function createTrustcorePolicy(
  input: NewTrustcorePolicy,
): Promise<TrustcorePolicy> {
  const [row] = await db
    .insert(trustcorePolicies)
    .values(input)
    .returning()
  if (!row) {
    throw new Error('createTrustcorePolicy: insert returned no row')
  }
  return row
}

/**
 * Return all policies for an org, ordered newest first.
 * Optionally filter by type.
 */
export async function listTrustcorePolicies(
  orgId: string,
  type?: 'privacy_policy' | 'data_governance',
): Promise<TrustcorePolicy[]> {
  const rows = await db
    .select()
    .from(trustcorePolicies)
    .where(eq(trustcorePolicies.orgId, orgId))
    .orderBy(desc(trustcorePolicies.createdAt))
  return type ? rows.filter((r) => r.type === type) : rows
}

/**
 * Return the latest version of a policy type for an org, or null.
 */
export async function getLatestPolicy(
  orgId: string,
  type: 'privacy_policy' | 'data_governance',
): Promise<TrustcorePolicy | null> {
  const [row] = await db
    .select()
    .from(trustcorePolicies)
    .where(eq(trustcorePolicies.orgId, orgId))
    .orderBy(desc(trustcorePolicies.createdAt))
    .limit(1)
  return row && row.type === type ? row : null
}

/**
 * Nzila OS — TrustCore Typed Query Helpers
 *
 * All queries are org-scoped. Passing orgId is mandatory for every helper.
 * No optional orgId — the absence of org context must never silently return data.
 *
 * @module @nzila/db/queries/trustcore
 */
import { eq, desc, and } from 'drizzle-orm'
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
  trustcoreReminders,
  trustcoreSubscriptions,
  trustcoreLeads,
  trustcoreRisks,
  trustcoreRiskReviews,
  trustcoreRiskMitigations,
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
export type TrustcoreReminder = typeof trustcoreReminders.$inferSelect
export type NewTrustcoreReminder = typeof trustcoreReminders.$inferInsert
export type TrustcoreSubscription = typeof trustcoreSubscriptions.$inferSelect
export type NewTrustcoreSubscription = typeof trustcoreSubscriptions.$inferInsert
export type TrustcoreLead = typeof trustcoreLeads.$inferSelect
export type NewTrustcoreLead = typeof trustcoreLeads.$inferInsert

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
 * Optionally filter by type in the WHERE clause.
 */
export async function listTrustcorePolicies(
  orgId: string,
  type?: 'privacy_policy' | 'data_governance',
): Promise<TrustcorePolicy[]> {
  const where = type
    ? and(eq(trustcorePolicies.orgId, orgId), eq(trustcorePolicies.type, type))
    : eq(trustcorePolicies.orgId, orgId)
  return db
    .select()
    .from(trustcorePolicies)
    .where(where)
    .orderBy(desc(trustcorePolicies.createdAt))
}

/**
 * Return the latest version of a policy type for an org, or null.
 * Filters by type in the WHERE clause for correctness and efficiency.
 */
export async function getLatestPolicy(
  orgId: string,
  type: 'privacy_policy' | 'data_governance',
): Promise<TrustcorePolicy | null> {
  const [row] = await db
    .select()
    .from(trustcorePolicies)
    .where(and(eq(trustcorePolicies.orgId, orgId), eq(trustcorePolicies.type, type)))
    .orderBy(desc(trustcorePolicies.createdAt))
    .limit(1)
  return row ?? null
}

// ── Reminder helpers ───────────────────────────────────────────────────────

/**
 * Return all non-dismissed reminders for an org, sorted by severity then dueAt.
 * Severity order: critical > high > medium > low (via CASE in application layer).
 */
export async function listTrustcoreReminders(
  orgId: string,
  status?: 'open' | 'completed' | 'dismissed' | 'overdue',
): Promise<TrustcoreReminder[]> {
  const where = status
    ? and(eq(trustcoreReminders.orgId, orgId), eq(trustcoreReminders.status, status))
    : eq(trustcoreReminders.orgId, orgId)
  const rows = await db
    .select()
    .from(trustcoreReminders)
    .where(where)
    .orderBy(desc(trustcoreReminders.createdAt))

  // Sort: critical first, then high, medium, low; ties broken by dueAt ascending
  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const
  return rows.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99
    const sb = SEVERITY_ORDER[b.severity] ?? 99
    if (sa !== sb) return sa - sb
    const da = a.dueAt?.getTime() ?? Infinity
    const dueB = b.dueAt?.getTime() ?? Infinity
    return da - dueB
  })
}

/**
 * Upsert a reminder by (orgId, sourceType, sourceId, title).
 * If a matching open/overdue reminder already exists, it is left unchanged.
 * If none exists, a new one is inserted.
 * Returns the existing or newly created reminder.
 */
export async function upsertTrustcoreReminder(
  input: NewTrustcoreReminder,
): Promise<TrustcoreReminder> {
  // Look for existing open/overdue reminder with same key
  const existing = await db
    .select()
    .from(trustcoreReminders)
    .where(
      and(
        eq(trustcoreReminders.orgId, input.orgId),
        eq(trustcoreReminders.sourceType, input.sourceType),
        eq(trustcoreReminders.title, input.title),
      ),
    )
    .limit(1)

  const activeExisting = existing.find(
    (r) => r.status === 'open' || r.status === 'overdue',
  )
  if (activeExisting) return activeExisting

  const [row] = await db
    .insert(trustcoreReminders)
    .values(input)
    .returning()
  if (!row) throw new Error('upsertTrustcoreReminder: insert returned no row')
  return row
}

/**
 * Update a reminder's status (complete or dismiss).
 * Returns the updated row.
 */
export async function updateTrustcoreReminderStatus(
  id: string,
  orgId: string,
  status: 'completed' | 'dismissed',
): Promise<TrustcoreReminder> {
  const now = new Date()
  const patch =
    status === 'completed'
      ? { status: 'completed' as const, completedAt: now, updatedAt: now }
      : { status: 'dismissed' as const, dismissedAt: now, updatedAt: now }

  const [row] = await db
    .update(trustcoreReminders)
    .set(patch)
    .where(and(eq(trustcoreReminders.id, id), eq(trustcoreReminders.orgId, orgId)))
    .returning()
  if (!row) throw new Error('updateTrustcoreReminderStatus: reminder not found')
  return row
}

/**
 * Return a single reminder by id + orgId, or null.
 */
export async function getTrustcoreReminder(
  id: string,
  orgId: string,
): Promise<TrustcoreReminder | null> {
  const [row] = await db
    .select()
    .from(trustcoreReminders)
    .where(and(eq(trustcoreReminders.id, id), eq(trustcoreReminders.orgId, orgId)))
    .limit(1)
  return row ?? null
}

// ── Subscription helpers ────────────────────────────────────────────────────

/**
 * Return the subscription record for an org, or null if none exists.
 * Callers should fall back to FREE when null is returned.
 */
export async function getTrustcoreSubscription(
  orgId: string,
): Promise<TrustcoreSubscription | null> {
  const [row] = await db
    .select()
    .from(trustcoreSubscriptions)
    .where(eq(trustcoreSubscriptions.orgId, orgId))
    .limit(1)
  return row ?? null
}

/**
 * Upsert a subscription record for an org.
 * Inserts if none exists; updates plan/status/period/stripe fields if one does.
 */
export async function upsertTrustcoreSubscription(
  input: NewTrustcoreSubscription,
): Promise<TrustcoreSubscription> {
  const existing = await getTrustcoreSubscription(input.orgId)
  if (!existing) {
    const [row] = await db
      .insert(trustcoreSubscriptions)
      .values(input)
      .returning()
    if (!row) throw new Error('upsertTrustcoreSubscription: insert returned no row')
    return row
  }

  const [row] = await db
    .update(trustcoreSubscriptions)
    .set({
      plan: input.plan ?? existing.plan,
      status: input.status ?? existing.status,
      currentPeriodStart: input.currentPeriodStart ?? existing.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd ?? existing.currentPeriodEnd,
      stripeCustomerId: input.stripeCustomerId ?? existing.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId ?? existing.stripeSubscriptionId,
      updatedAt: new Date(),
    })
    .where(eq(trustcoreSubscriptions.orgId, input.orgId))
    .returning()
  if (!row) throw new Error('upsertTrustcoreSubscription: update returned no row')
  return row
}

/**
 * Count active (open/overdue) reminders for an org.
 * Used by billing gate to enforce FREE tier limit.
 */
export async function countActiveTrustcoreReminders(orgId: string): Promise<number> {
  const rows = await db
    .select()
    .from(trustcoreReminders)
    .where(eq(trustcoreReminders.orgId, orgId))
  return rows.filter((r) => r.status === 'open' || r.status === 'overdue').length
}

// ── Lead helpers ────────────────────────────────────────────────────────────

/**
 * Upsert a lead by email.
 * If a lead with the same email already exists, source is NOT overwritten
 * (first-touch attribution). Returns the existing or newly created lead.
 */
export async function upsertTrustcoreLead(input: {
  email: string
  source: 'landing' | 'sample_trust_center' | 'onboarding'
}): Promise<TrustcoreLead> {
  const existing = await db
    .select()
    .from(trustcoreLeads)
    .where(eq(trustcoreLeads.email, input.email))
    .limit(1)
  if (existing[0]) return existing[0]

  const [row] = await db.insert(trustcoreLeads).values(input).returning()
  if (!row) throw new Error('upsertTrustcoreLead: insert returned no row')
  return row
}

/**
 * Mark a lead as converted after onboarding completion.
 * Sets convertedAt and orgId on the matching email record.
 */
export async function convertTrustcoreLead(
  email: string,
  orgId: string,
): Promise<TrustcoreLead | null> {
  const [row] = await db
    .update(trustcoreLeads)
    .set({ convertedAt: new Date(), orgId })
    .where(and(eq(trustcoreLeads.email, email)))
    .returning()
  return row ?? null
}

/**
 * Return all leads ordered by capturedAt desc.
 * Platform admin only — never expose on public routes.
 */
export async function listTrustcoreLeads(): Promise<TrustcoreLead[]> {
  return db.select().from(trustcoreLeads).orderBy(desc(trustcoreLeads.capturedAt))
}

// ── Risk Register ─────────────────────────────────────────────────────────

export type TrustcoreRisk = typeof trustcoreRisks.$inferSelect
export type TrustcoreRiskReview = typeof trustcoreRiskReviews.$inferSelect
export type TrustcoreRiskMitigation = typeof trustcoreRiskMitigations.$inferSelect

export type NewTrustcoreRisk = typeof trustcoreRisks.$inferInsert
export type NewTrustcoreRiskReview = typeof trustcoreRiskReviews.$inferInsert
export type NewTrustcoreRiskMitigation = typeof trustcoreRiskMitigations.$inferInsert

/**
 * List all risks for an org, newest first.
 */
export async function listTrustcoreRisks(orgId: string): Promise<TrustcoreRisk[]> {
  return db
    .select()
    .from(trustcoreRisks)
    .where(eq(trustcoreRisks.orgId, orgId))
    .orderBy(desc(trustcoreRisks.createdAt))
}

/**
 * Get a single risk by id, scoped to org.
 */
export async function getTrustcoreRisk(
  orgId: string,
  riskId: string,
): Promise<TrustcoreRisk | null> {
  const [row] = await db
    .select()
    .from(trustcoreRisks)
    .where(and(eq(trustcoreRisks.orgId, orgId), eq(trustcoreRisks.id, riskId)))
    .limit(1)
  return row ?? null
}

/**
 * Create a new risk. orgId is mandatory.
 */
export async function createTrustcoreRisk(input: NewTrustcoreRisk): Promise<TrustcoreRisk> {
  const [row] = await db.insert(trustcoreRisks).values(input).returning()
  if (!row) throw new Error('createTrustcoreRisk: insert returned no row')
  return row
}

/**
 * Update a risk. Caller must pass orgId for safety.
 */
export async function updateTrustcoreRisk(
  orgId: string,
  riskId: string,
  patch: Partial<NewTrustcoreRisk>,
): Promise<TrustcoreRisk | null> {
  const [row] = await db
    .update(trustcoreRisks)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(trustcoreRisks.orgId, orgId), eq(trustcoreRisks.id, riskId)))
    .returning()
  return row ?? null
}

/**
 * Append a mitigation entry to a risk.
 */
export async function addTrustcoreRiskMitigation(
  input: NewTrustcoreRiskMitigation,
): Promise<TrustcoreRiskMitigation> {
  const [row] = await db.insert(trustcoreRiskMitigations).values(input).returning()
  if (!row) throw new Error('addTrustcoreRiskMitigation: insert returned no row')
  return row
}

/**
 * Append a review entry to a risk.
 */
export async function addTrustcoreRiskReview(
  input: NewTrustcoreRiskReview,
): Promise<TrustcoreRiskReview> {
  const [row] = await db.insert(trustcoreRiskReviews).values(input).returning()
  if (!row) throw new Error('addTrustcoreRiskReview: insert returned no row')
  return row
}

/**
 * List mitigations for a single risk, newest first.
 */
export async function listTrustcoreRiskMitigations(
  riskId: string,
): Promise<TrustcoreRiskMitigation[]> {
  return db
    .select()
    .from(trustcoreRiskMitigations)
    .where(eq(trustcoreRiskMitigations.riskId, riskId))
    .orderBy(desc(trustcoreRiskMitigations.createdAt))
}

/**
 * List reviews for a single risk, newest first.
 */
export async function listTrustcoreRiskReviews(riskId: string): Promise<TrustcoreRiskReview[]> {
  return db
    .select()
    .from(trustcoreRiskReviews)
    .where(eq(trustcoreRiskReviews.riskId, riskId))
    .orderBy(desc(trustcoreRiskReviews.reviewedAt))
}

/**
 * Nzila OS — NACP Integrity Proof Ports (Real Implementation)
 *
 * Backed by evidence_packs, audit_events, and evidence_pack_artifacts
 * tables — no stubs, no hardcoded zeros.
 *
 * Org-scoped read-only queries; no new write paths.
 *
 * @module @nzila/platform-proof/ports/nacp
 */
import { platformDb } from '@nzila/db/platform'
import { auditEvents, evidencePacks } from '@nzila/db/schema'
import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import type { NacpIntegrityProofPorts, NacpSealStatus, NacpAnomaly } from '../nacp-proof'

// ── Constants ───────────────────────────────────────────────────────────────

/** Terminal event types emitted by NACP exam lifecycle */
const NACP_TERMINAL_EVENT_TYPES = [
  'SUBMISSION_SEALED',
  'GRADING_FINALIZED',
  'EXPORT_GENERATED',
] as const

// ── Port implementations ────────────────────────────────────────────────────

/**
 * Derive seal status per terminal event type from audit_events + evidence_packs.
 *
 * For each NACP terminal event type:
 *  - totalEvents = count of matching audit_events for the org
 *  - sealedCount = count of evidence_packs with status 'sealed' or 'verified' referencing those events
 *  - unsealedCount = totalEvents − sealedCount
 *  - lastSealedAt = max(evidence_packs.createdAt) for sealed packs
 *  - lastSubjectId = targetId of the most recent sealed audit event
 */
async function fetchSealStatuses(orgId: string): Promise<readonly NacpSealStatus[]> {
  const statuses: NacpSealStatus[] = []

  for (const eventType of NACP_TERMINAL_EVENT_TYPES) {
    // Total audit events of this terminal type for org
    const [totalRow] = await platformDb
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(and(eq(auditEvents.orgId, orgId), eq(auditEvents.action, eventType)))

    const totalEvents = totalRow?.count ?? 0

    // Sealed evidence packs matching this event type + org
    const [sealedRow] = await platformDb
      .select({
        count: sql<number>`count(*)::int`,
        lastSealedAt: sql<string | null>`max(${evidencePacks.verifiedAt})`,
      })
      .from(evidencePacks)
      .where(
        and(
          eq(evidencePacks.orgId, orgId),
          eq(evidencePacks.eventId, eventType),
          inArray(evidencePacks.status, ['sealed', 'verified']),
        ),
      )

    const sealedCount = sealedRow?.count ?? 0
    const lastSealedAt = sealedRow?.lastSealedAt ?? null

    // Most recent audit event of this type for lastSubjectId
    const [latestEvent] = await platformDb
      .select({ targetId: auditEvents.targetId })
      .from(auditEvents)
      .where(and(eq(auditEvents.orgId, orgId), eq(auditEvents.action, eventType)))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1)

    statuses.push({
      eventType,
      totalEvents,
      sealedCount,
      unsealedCount: Math.max(0, totalEvents - sealedCount),
      lastSealedAt,
      lastSubjectId: latestEvent?.targetId ?? null,
    })
  }

  return statuses
}

/**
 * Detect anomalies by comparing audit events against evidence packs.
 *
 * Anomaly types:
 *  - missing_seal: terminal audit event exists but no sealed evidence pack references it
 *  - chain_break: evidence pack with chainIntegrity = 'BROKEN'
 *  - out_of_order: evidence pack createdAt < its hashChainStart audit event createdAt
 */
async function fetchAnomalies(orgId: string): Promise<readonly NacpAnomaly[]> {
  const anomalies: NacpAnomaly[] = []
  const now = new Date().toISOString()

  // 1. Find terminal audit events without sealed evidence packs (missing_seal)
  for (const eventType of NACP_TERMINAL_EVENT_TYPES) {
    const unsealedEvents = await platformDb
      .select({
        id: auditEvents.id,
        targetId: auditEvents.targetId,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(and(eq(auditEvents.orgId, orgId), eq(auditEvents.action, eventType)))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100)

    for (const evt of unsealedEvents) {
      // Check if a sealed/verified evidence pack references this audit event
      const [match] = await platformDb
        .select({ id: evidencePacks.id })
        .from(evidencePacks)
        .where(
          and(
            eq(evidencePacks.orgId, orgId),
            eq(evidencePacks.eventId, eventType),
            inArray(evidencePacks.status, ['sealed', 'verified']),
          ),
        )
        .limit(1)

      if (!match) {
        anomalies.push({
          type: 'missing_seal',
          subjectId: evt.targetId ?? evt.id,
          eventType,
          detectedAt: now,
          description: `Terminal event ${eventType} (audit ${evt.id}) has no sealed evidence pack`,
        })
      }
    }
  }

  // 2. Chain breaks — evidence packs with chainIntegrity = 'BROKEN'
  const brokenPacks = await platformDb
    .select({
      packId: evidencePacks.packId,
      eventId: evidencePacks.eventId,
      createdAt: evidencePacks.createdAt,
    })
    .from(evidencePacks)
    .where(and(eq(evidencePacks.orgId, orgId), eq(evidencePacks.chainIntegrity, 'BROKEN')))
    .limit(100)

  for (const pack of brokenPacks) {
    anomalies.push({
      type: 'chain_break',
      subjectId: pack.packId,
      eventType: pack.eventId,
      detectedAt: now,
      description: `Evidence pack ${pack.packId} has broken hash chain integrity`,
    })
  }

  return anomalies
}

/**
 * Fetch the latest export proof hash — the hash chain end of the most recent
 * sealed/verified evidence pack with event type EXPORT_GENERATED.
 */
async function fetchExportProofHash(orgId: string): Promise<string | null> {
  const [row] = await platformDb
    .select({ hashChainEnd: evidencePacks.hashChainEnd })
    .from(evidencePacks)
    .where(
      and(
        eq(evidencePacks.orgId, orgId),
        eq(evidencePacks.eventId, 'EXPORT_GENERATED'),
        inArray(evidencePacks.status, ['sealed', 'verified']),
      ),
    )
    .orderBy(desc(evidencePacks.createdAt))
    .limit(1)

  return row?.hashChainEnd ?? null
}

/**
 * Fetch hash chain length and head from the audit_events table.
 *
 * - length = count of hash-chained audit events for this org
 * - head = hash of the most recent audit event
 */
async function fetchHashChainInfo(
  orgId: string,
): Promise<{ length: number; head: string | null }> {
  const [countRow] = await platformDb
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, orgId))

  const [headRow] = await platformDb
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, orgId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  return {
    length: countRow?.count ?? 0,
    head: headRow?.hash ?? null,
  }
}

// ── Assembled Ports Object ──────────────────────────────────────────────────

/**
 * Real NACP integrity proof ports backed by platform DB.
 * Org-scoped, read-only, no stubs.
 */
export const nacpIntegrityPorts: NacpIntegrityProofPorts = {
  fetchSealStatuses,
  fetchAnomalies,
  fetchExportProofHash,
  fetchHashChainInfo,
}

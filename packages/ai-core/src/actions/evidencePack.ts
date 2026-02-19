/**
 * @nzila/ai-core — AI Actions Evidence Pack Collector
 *
 * Collects attestation documents, ingestion reports, and Stripe report
 * documents linked to AI actions for inclusion in evidence packs.
 * Works with the existing generate-evidence-index.ts script.
 */
import { db } from '@nzila/db'
import { documents, aiActions, aiActionRuns } from '@nzila/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { ACTION_TYPES } from '../schemas'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AiActionEvidence {
  actionId: string
  actionType: string
  runId: string
  riskTier: string
  status: string
  attestationDocumentId: string | null
  relatedDocuments: Array<{
    documentId: string
    category: string
    title: string
    blobContainer: string
    blobPath: string
    sha256: string
    sizeBytes: number
    linkedType: string | null
    linkedId: string | null
  }>
}

export interface AiActionsEvidenceAppendix {
  schemaVersion: '1.0'
  entityId: string
  periodLabel: string
  collectedAt: string
  actions: AiActionEvidence[]
  summary: {
    totalActions: number
    executedActions: number
    failedActions: number
    attestationCount: number
    documentCount: number
  }
}

// ── Collector ───────────────────────────────────────────────────────────────

/**
 * Collect all AI action evidence for an entity in a given period.
 * Returns an appendix structure suitable for inclusion in evidence packs.
 *
 * @param entityId - The entity UUID
 * @param periodLabel - e.g., "2026-02"
 * @param actionTypes - Filter by action types (defaults to all known)
 */
export async function collectAiActionEvidence(
  entityId: string,
  periodLabel: string,
  actionTypes?: string[],
): Promise<AiActionsEvidenceAppendix> {
  const typesToCollect = actionTypes ?? Object.values(ACTION_TYPES)

  // 1. Find all evidence-pack-eligible actions for this entity & period
  const allActions = await db
    .select()
    .from(aiActions)
    .where(
      and(
        eq(aiActions.entityId, entityId),
        eq(aiActions.evidencePackEligible, true),
      ),
    )

  // Filter by period (actions created in the period month)
  const periodActions = allActions.filter((action) => {
    const actionMonth = action.createdAt.toISOString().slice(0, 7)
    return actionMonth === periodLabel && typesToCollect.includes(action.actionType)
  })

  if (periodActions.length === 0) {
    return {
      schemaVersion: '1.0',
      entityId,
      periodLabel,
      collectedAt: new Date().toISOString(),
      actions: [],
      summary: {
        totalActions: 0,
        executedActions: 0,
        failedActions: 0,
        attestationCount: 0,
        documentCount: 0,
      },
    }
  }

  const actionIds = periodActions.map((a) => a.id)

  // 2. Load all runs for these actions
  const runs = await db
    .select()
    .from(aiActionRuns)
    .where(inArray(aiActionRuns.actionId, actionIds))

  // 3. Collect all attestation document IDs from runs
  const attestationDocIds = runs
    .map((r) => r.attestationDocumentId)
    .filter((id): id is string => id != null)

  // 4. Collect all documents linked to these actions
  const linkedDocs = actionIds.length > 0
    ? await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.entityId, entityId),
            eq(documents.linkedType, 'ai_action'),
            inArray(documents.linkedId, actionIds),
          ),
        )
    : []

  // Also collect attestation docs directly if any
  const attestationDocs = attestationDocIds.length > 0
    ? await db
        .select()
        .from(documents)
        .where(inArray(documents.id, attestationDocIds))
    : []

  // Merge and deduplicate documents
  const allDocs = new Map<string, typeof linkedDocs[0]>()
  for (const doc of [...linkedDocs, ...attestationDocs]) {
    allDocs.set(doc.id, doc)
  }

  // 5. Build evidence items per action
  const actionEvidence: AiActionEvidence[] = periodActions.map((action) => {
    const actionRuns = runs.filter((r) => r.actionId === action.id)
    const latestRun = actionRuns.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0]

    // Find documents related to this action
    const relatedDocs = Array.from(allDocs.values()).filter(
      (doc) =>
        (doc.linkedType === 'ai_action' && doc.linkedId === action.id) ||
        (latestRun?.attestationDocumentId && doc.id === latestRun.attestationDocumentId),
    )

    return {
      actionId: action.id,
      actionType: action.actionType,
      runId: latestRun?.id ?? '',
      riskTier: action.riskTier,
      status: action.status,
      attestationDocumentId: latestRun?.attestationDocumentId ?? null,
      relatedDocuments: relatedDocs.map((doc) => ({
        documentId: doc.id,
        category: doc.category,
        title: doc.title,
        blobContainer: doc.blobContainer,
        blobPath: doc.blobPath,
        sha256: doc.sha256,
        sizeBytes: Number(doc.sizeBytes),
        linkedType: doc.linkedType,
        linkedId: doc.linkedId,
      })),
    }
  })

  const executedCount = periodActions.filter((a) => a.status === 'executed').length
  const failedCount = periodActions.filter((a) => a.status === 'failed').length

  return {
    schemaVersion: '1.0',
    entityId,
    periodLabel,
    collectedAt: new Date().toISOString(),
    actions: actionEvidence,
    summary: {
      totalActions: periodActions.length,
      executedActions: executedCount,
      failedActions: failedCount,
      attestationCount: attestationDocIds.length,
      documentCount: allDocs.size,
    },
  }
}

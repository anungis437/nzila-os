/**
 * @nzila/ai-core — Action Attestation
 *
 * Creates evidence-grade attestation JSON for AI actions,
 * stores as a document via @nzila/blob.
 */
import { db } from '@nzila/db'
import { documents, auditEvents } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { uploadBuffer, computeSha256 } from '@nzila/blob'
import { computeEntryHash } from '@nzila/os-core/hash'
import { sha256 } from '../logging'
import { buildAttestationPath } from '@nzila/tools-runtime'
import type { ToolCallEntry } from '@nzila/tools-runtime'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AttestationInput {
  action: {
    id: string
    entityId: string
    appKey: string
    profileKey: string
    actionType: string
    riskTier: string
    status: string
    requestedBy: string
    approvedBy: string | null
    approvedAt: Date | null
    proposalJson: unknown
    relatedDomainType: string | null
    relatedDomainId: string | null
    aiRequestId: string | null
    evidencePackEligible: boolean
    createdAt: Date
    updatedAt: Date
  }
  run: {
    id: string
    startedAt: Date
  }
  policyDecision: Record<string, unknown> | null
  toolCalls: ToolCallEntry[]
  artifacts: Record<string, unknown>
}

export interface AttestationJson {
  attestationVersion: '1.0'
  actionId: string
  runId: string
  entityId: string
  appKey: string
  profileKey: string
  actionType: string
  riskTier: string
  status: string
  requestedBy: string
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string
  executedAt: string
  policyDecisionJson: Record<string, unknown> | null
  aiContext: {
    aiRequestId: string | null
  }
  toolTrace: {
    toolCallsJson: ToolCallEntry[]
  }
  artifacts: {
    documents: Array<{
      key: string
      value: unknown
    }>
  }
  hashes: {
    proposalHash: string
    attestationHash: string
  }
  links: {
    relatedDomainType: string | null
    relatedDomainId: string | null
    evidencePackEligible: boolean
  }
}

export interface StoredAttestation {
  documentId: string
  blobPath: string
  sha256: string
  sizeBytes: number
}

// ── Create attestation ──────────────────────────────────────────────────────

/**
 * Build the attestation JSON for an action execution.
 */
export function createActionAttestation(input: AttestationInput): AttestationJson {
  const proposalHash = sha256(JSON.stringify(input.action.proposalJson))

  // Build attestation without the self-hash first
  const attestation: AttestationJson = {
    attestationVersion: '1.0',
    actionId: input.action.id,
    runId: input.run.id,
    entityId: input.action.entityId,
    appKey: input.action.appKey,
    profileKey: input.action.profileKey,
    actionType: input.action.actionType,
    riskTier: input.action.riskTier,
    status: 'executed',
    requestedBy: input.action.requestedBy,
    approvedBy: input.action.approvedBy,
    approvedAt: input.action.approvedAt?.toISOString() ?? null,
    createdAt: input.action.createdAt.toISOString(),
    executedAt: new Date().toISOString(),
    policyDecisionJson: input.policyDecision,
    aiContext: {
      aiRequestId: input.action.aiRequestId,
    },
    toolTrace: {
      toolCallsJson: input.toolCalls,
    },
    artifacts: {
      documents: Object.entries(input.artifacts).map(([key, value]) => ({
        key,
        value,
      })),
    },
    hashes: {
      proposalHash,
      attestationHash: '', // placeholder
    },
    links: {
      relatedDomainType: input.action.relatedDomainType,
      relatedDomainId: input.action.relatedDomainId,
      evidencePackEligible: input.action.evidencePackEligible,
    },
  }

  // Compute self-hash
  const contentForHash = { ...attestation, hashes: { ...attestation.hashes, attestationHash: '' } }
  attestation.hashes.attestationHash = sha256(JSON.stringify(contentForHash))

  return attestation
}

// ── Store attestation ───────────────────────────────────────────────────────

/**
 * Store attestation JSON as a document in Azure Blob.
 */
export async function storeAttestation(
  attestation: AttestationJson,
  actorClerkUserId: string,
): Promise<StoredAttestation> {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  const blobPath = buildAttestationPath({
    entityId: attestation.entityId,
    year,
    month,
    actionType: attestation.actionType,
    runId: attestation.runId,
  })

  const buffer = Buffer.from(JSON.stringify(attestation, null, 2), 'utf-8')
  const blobSha256 = computeSha256(buffer)

  await uploadBuffer({
    container: 'exports',
    blobPath,
    buffer,
    contentType: 'application/json',
  })

  // Create documents row
  const [doc] = await db
    .insert(documents)
    .values({
      entityId: attestation.entityId,
      category: 'attestation',
      title: `AI Action Attestation — ${attestation.actionType} — ${attestation.runId}`,
      blobContainer: 'exports',
      blobPath,
      contentType: 'application/json',
      sizeBytes: BigInt(buffer.length),
      sha256: blobSha256,
      uploadedBy: actorClerkUserId,
      classification: 'internal',
      linkedType: 'ai_action',
      linkedId: attestation.actionId,
    })
    .returning()

  // Audit event for attestation storage
  const [latest] = await db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.entityId, attestation.entityId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  const previousHash = latest?.hash ?? null
  const auditPayload = {
    entityId: attestation.entityId,
    actorClerkUserId,
    action: 'ai.attestation_stored',
    targetType: 'document',
    targetId: doc.id,
    afterJson: {
      actionId: attestation.actionId,
      runId: attestation.runId,
      sha256: blobSha256,
      blobPath,
    },
    timestamp: now.toISOString(),
  }
  const hash = computeEntryHash(auditPayload, previousHash)

  await db.insert(auditEvents).values({
    entityId: attestation.entityId,
    actorClerkUserId,
    action: 'ai.attestation_stored',
    targetType: 'document',
    targetId: doc.id,
    afterJson: auditPayload.afterJson,
    hash,
    previousHash,
  })

  return {
    documentId: doc.id,
    blobPath,
    sha256: blobSha256,
    sizeBytes: buffer.length,
  }
}

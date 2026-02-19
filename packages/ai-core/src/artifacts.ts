/**
 * @nzila/ai-core — AI Artifact storage
 *
 * Stores approved AI outputs as documents via @nzila/blob.
 * Only explicitly marked artifacts (governance drafts, close memos, etc.)
 * should be stored; NOT all AI outputs.
 */
import { db } from '@nzila/db'
import { documents, auditEvents } from '@nzila/db/schema'
import { uploadBuffer, computeSha256 } from '@nzila/blob'
import { computeEntryHash } from '@nzila/os-core/hash'
import { eq, desc } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

export interface StoreAiArtifactInput {
  content: string | Buffer
  contentType?: string
  entityId: string
  classification: 'public' | 'internal' | 'confidential'
  category: 'minute_book' | 'filing' | 'resolution' | 'minutes' | 'certificate' | 'year_end' | 'export' | 'attestation' | 'ingestion_report' | 'other'
  title: string
  linkedType?: string
  linkedId?: string
  uploadedBy: string
  container?: string
}

export interface StoredArtifact {
  documentId: string
  blobPath: string
  sha256: string
  sizeBytes: number
}

// ── Store artifact ──────────────────────────────────────────────────────────

/**
 * Store an AI-generated artifact as a document in Azure Blob.
 * Creates a documents row and appends an audit event.
 */
export async function storeAiArtifactAsDocument(
  input: StoreAiArtifactInput,
): Promise<StoredArtifact> {
  const buffer = typeof input.content === 'string'
    ? Buffer.from(input.content, 'utf-8')
    : input.content

  const containerName = input.container ?? 'evidence'
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const blobPath = `ai-artifacts/${input.entityId}/${timestamp}-${slugify(input.title)}`

  // 1. Upload to blob
  const uploaded = await uploadBuffer({
    container: containerName,
    blobPath,
    buffer,
    contentType: input.contentType ?? 'application/json',
  })

  // 2. Create documents row
  const [doc] = await db
    .insert(documents)
    .values({
      entityId: input.entityId,
      category: input.category,
      title: input.title,
      blobContainer: containerName,
      blobPath: uploaded.blobPath,
      contentType: input.contentType ?? 'application/json',
      sizeBytes: BigInt(uploaded.sizeBytes),
      sha256: uploaded.sha256,
      uploadedBy: input.uploadedBy,
      classification: input.classification,
      linkedType: input.linkedType ?? 'ai_artifact',
      linkedId: input.linkedId ?? undefined,
    })
    .returning()

  // 3. Audit event
  const [latest] = await db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.entityId, input.entityId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1)

  const previousHash = latest?.hash ?? null
  const payload = {
    entityId: input.entityId,
    actorClerkUserId: input.uploadedBy,
    action: 'ai.artifact_stored',
    targetType: 'document',
    targetId: doc.id,
    afterJson: {
      title: input.title,
      sha256: uploaded.sha256,
      blobPath: uploaded.blobPath,
      category: input.category,
      classification: input.classification,
    },
    timestamp: new Date().toISOString(),
  }
  const hash = computeEntryHash(payload, previousHash)

  await db.insert(auditEvents).values({
    entityId: input.entityId,
    actorClerkUserId: input.uploadedBy,
    action: 'ai.artifact_stored',
    targetType: 'document',
    targetId: doc.id,
    afterJson: payload.afterJson,
    hash,
    previousHash,
  })

  return {
    documentId: doc.id,
    blobPath: uploaded.blobPath,
    sha256: uploaded.sha256,
    sizeBytes: uploaded.sizeBytes,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

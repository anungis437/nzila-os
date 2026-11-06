import { knowledgeBase } from '@/db/schema'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { performAuditedOperation } from '@/lib/audit/operation-audit'
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client'
import { writeKnowledgeBaseEmbedding } from '@/lib/ai/knowledge-base-embeddings'
import { KNOWLEDGE_BASE_EMBEDDING, vectorColumnReady } from '@/lib/ai/vector-readiness'
import { logger } from '@/lib/logger'

/**
 * The durable, tenant-scoped retrieval index of an ingested document (DEF-0B2-AI-RAG-INDEX-PROCESS-LOCAL).
 *
 * The ingested text is stored as the organization's own knowledge_base rows (source_type 'ai_ingest', never public, row-level security on
 * organization_id), one row per chunk, so it survives a restart, is shared by every instance and is read by the same knowledge search the
 * chatbot uses. Where pgvector is installed each chunk's embedding is stored in knowledge_base.embedding; where it is not, the rows are
 * stored without a vector and the answer says the semantic part is not available, rather than claiming it.
 */
export const INGEST_SOURCE_TYPE = 'ai_ingest'
export const INGEST_CHUNK_CHARS = 6000
export const INGEST_MAX_CHUNKS = 100

export class IngestTooLargeToIndexError extends Error {
  readonly code = 'INGEST_TOO_LARGE_TO_INDEX'
  constructor(readonly chunks: number) {
    super(
      `The document would need ${chunks} index chunks; at most ${INGEST_MAX_CHUNKS} are indexed per document.`,
    )
    this.name = 'IngestTooLargeToIndexError'
  }
}

/** Splits text into chunks of at most `size` characters, preferring a paragraph or line break near the end of each chunk. */
export function chunkIngestedText(text: string, size = INGEST_CHUNK_CHARS): string[] {
  const chunks: string[] = []
  let rest = text.trim()
  while (rest.length > size) {
    const window = rest.slice(0, size)
    const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'))
    const end = cut > size / 2 ? cut : size
    chunks.push(rest.slice(0, end).trim())
    rest = rest.slice(end).trim()
  }
  if (rest.length > 0) chunks.push(rest)
  return chunks.filter((c) => c.length > 0)
}

export interface DurableIndexResult {
  status: 'indexed' | 'stored_without_embedding'
  durable: true
  documentId: string
  knowledgeBaseIds: string[]
  chunkCount: number
  /** True only when every chunk's vector was stored. */
  embedded: boolean
}

async function embed(text: string): Promise<number[]> {
  const result = await getAiClient().embed({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.EMBEDDINGS,
    input: text,
    dataClass: 'internal',
  })
  return result.embeddings[0]
}

export async function indexIngestedDocument(input: {
  organizationId: string
  userId: string
  documentId: string
  title: string
  content: string
  source: string
  tags?: string[]
}): Promise<DurableIndexResult> {
  const { organizationId, userId, documentId } = input
  const chunks = chunkIngestedText(input.content)
  if (chunks.length > INGEST_MAX_CHUNKS) throw new IngestTooLargeToIndexError(chunks.length)
  const now = new Date()

  // The rows and their record commit together.
  const knowledgeBaseIds = await withRLSContext({ organizationId }, async (tx) => {
    const ids: string[] = []
    for (const [index, content] of chunks.entries()) {
      const [row] = await tx
        .insert(knowledgeBase)
        .values({
          organizationId,
          title: chunks.length > 1 ? `${input.title} (${index + 1}/${chunks.length})` : input.title,
          documentType: 'other',
          content,
          sourceType: INGEST_SOURCE_TYPE,
          sourceId: documentId,
          tags: input.tags ?? [],
          isPublic: false,
          isActive: true,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: knowledgeBase.id })
      ids.push(row.id)
    }
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'ai.ingest.knowledge_base',
      resourceType: 'knowledge_base',
      resourceId: documentId,
      details: { source: input.source, knowledgeBaseIds: ids, chunkCount: ids.length },
    })
    return ids
  })

  if (knowledgeBaseIds.length === 0 || !(await vectorColumnReady(KNOWLEDGE_BASE_EMBEDDING))) {
    return {
      status: 'stored_without_embedding',
      durable: true,
      documentId,
      knowledgeBaseIds,
      chunkCount: knowledgeBaseIds.length,
      embedded: false,
    }
  }

  // The text leaves the database for the embedding service only once the intent is recorded. The rows are already stored: a failure here
  // leaves them durable but without a vector, and the answer says so instead of failing the stored ingest or claiming an embedding.
  try {
    const vectors = await performAuditedOperation(
      {
        organizationId,
        userId,
        action: 'ai.ingest.embed',
        resourceType: 'knowledge_base',
        resourceId: documentId,
        details: { chunkCount: chunks.length },
      },
      async () => {
        const out: number[][] = []
        for (const chunk of chunks) out.push(await embed(chunk))
        return out
      },
    )

    await withRLSContext({ organizationId }, async (tx) => {
      for (const [index, id] of knowledgeBaseIds.entries()) {
        await writeKnowledgeBaseEmbedding(tx, { id, organizationId, embedding: vectors[index] })
      }
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'ai.ingest.knowledge_base.embedded',
        resourceType: 'knowledge_base',
        resourceId: documentId,
        details: { knowledgeBaseIds },
      })
    })
  } catch (error) {
    logger.error('AI ingest embedding not stored', {
      documentId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      status: 'stored_without_embedding',
      durable: true,
      documentId,
      knowledgeBaseIds,
      chunkCount: knowledgeBaseIds.length,
      embedded: false,
    }
  }

  return {
    status: 'indexed',
    durable: true,
    documentId,
    knowledgeBaseIds,
    chunkCount: knowledgeBaseIds.length,
    embedded: true,
  }
}

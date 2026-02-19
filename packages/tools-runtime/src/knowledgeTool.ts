/**
 * @nzila/tools-runtime — Knowledge Ingestion Tool
 *
 * Deterministic text chunking, embedding via ai-core, and
 * storage into aiEmbeddings + aiKnowledgeSources.
 * Idempotent by (entityId, sourceId, chunkSize, overlap).
 */
import { db } from '@nzila/db'
import {
  aiKnowledgeSources,
  aiEmbeddings,
  aiKnowledgeIngestionRuns,
  documents,
} from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { embed } from '@nzila/ai-core/gateway'
import { uploadWithLogging, downloadWithLogging } from './blobTool'
import { createToolCallEntry, type ToolCallEntry } from './sanitize'
import type { AiIngestKnowledgeSourceProposal } from '@nzila/ai-core/schemas'

// ── Deterministic chunker ───────────────────────────────────────────────────

export interface TextChunk {
  chunkIndex: number
  chunkId: string
  text: string
}

/**
 * Split text into overlapping chunks deterministically.
 * Same input + same params = same chunks every time.
 */
export function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  maxChunks: number,
): TextChunk[] {
  const chunks: TextChunk[] = []
  let start = 0
  let index = 0

  while (start < text.length && index < maxChunks) {
    const end = Math.min(start + chunkSize, text.length)
    const chunkStr = text.slice(start, end)

    chunks.push({
      chunkIndex: index,
      chunkId: `chunk-${index.toString().padStart(6, '0')}`,
      text: chunkStr,
    })

    start += chunkSize - chunkOverlap
    if (start <= (chunks[chunks.length - 1]?.chunkIndex ?? 0) * (chunkSize - chunkOverlap) && start > 0) {
      // Safety: avoid infinite loop if overlap >= chunkSize
      start = end
    }
    index++
  }

  return chunks
}

// ── Idempotency ─────────────────────────────────────────────────────────────

function buildIngestionIdempotencyKey(
  entityId: string,
  sourceId: string,
  chunkSize: number,
  overlap: number,
): string {
  return `${entityId}::${sourceId}::${chunkSize}::${overlap}`
}

// ── Resolve source text ─────────────────────────────────────────────────────

async function resolveSourceText(
  proposal: AiIngestKnowledgeSourceProposal,
): Promise<{ text: string; toolCall: ToolCallEntry }> {
  const startedAt = new Date()
  const source = proposal.source

  if (source.sourceType === 'manual_text' && source.text) {
    const finishedAt = new Date()
    return {
      text: source.text,
      toolCall: createToolCallEntry({
        toolName: 'knowledgeTool.resolveSource',
        startedAt,
        finishedAt,
        inputs: { sourceType: 'manual_text', length: source.text.length },
        outputs: { textLength: source.text.length },
        status: 'success',
      }),
    }
  }

  if (source.sourceType === 'blob_document' && source.documentId) {
    // Look up the document to get blob path
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, source.documentId))
      .limit(1)

    if (!doc) throw new Error(`Document ${source.documentId} not found`)

    const { buffer, toolCall: dlToolCall } = await downloadWithLogging(
      doc.blobContainer,
      doc.blobPath,
    )

    const finishedAt = new Date()
    return {
      text: buffer.toString('utf-8'),
      toolCall: createToolCallEntry({
        toolName: 'knowledgeTool.resolveSource',
        startedAt,
        finishedAt,
        inputs: { sourceType: 'blob_document', documentId: source.documentId },
        outputs: { textLength: buffer.length },
        status: 'success',
      }),
    }
  }

  if (source.sourceType === 'url' && source.url) {
    const response = await fetch(source.url)
    if (!response.ok) throw new Error(`Failed to fetch URL: ${source.url} (${response.status})`)
    const text = await response.text()

    const finishedAt = new Date()
    return {
      text,
      toolCall: createToolCallEntry({
        toolName: 'knowledgeTool.resolveSource',
        startedAt,
        finishedAt,
        inputs: { sourceType: 'url', url: source.url },
        outputs: { textLength: text.length },
        status: 'success',
      }),
    }
  }

  throw new Error(`Cannot resolve source: ${source.sourceType}`)
}

// ── Main ingestion ──────────────────────────────────────────────────────────

export interface IngestionResult {
  sourceId: string
  ingestionRunId: string
  chunkCount: number
  embeddingCount: number
  reportDocumentId: string
  toolCalls: ToolCallEntry[]
}

/**
 * Ingest a knowledge source: resolve text, chunk, embed, store.
 * Idempotent by source + chunking params.
 */
export async function ingestKnowledgeSource(
  proposal: AiIngestKnowledgeSourceProposal,
  actorClerkUserId: string,
): Promise<IngestionResult> {
  const toolCalls: ToolCallEntry[] = []
  const { source, ingestion, retention, citations } = proposal
  const entityId = proposal.entityId

  // 1. Upsert knowledge source
  let [existingSource] = await db
    .select()
    .from(aiKnowledgeSources)
    .where(
      and(
        eq(aiKnowledgeSources.entityId, entityId),
        eq(aiKnowledgeSources.title, source.title),
        eq(aiKnowledgeSources.appKey, proposal.appKey),
      ),
    )
    .limit(1)

  if (!existingSource) {
    const [newSource] = await db
      .insert(aiKnowledgeSources)
      .values({
        entityId,
        appKey: proposal.appKey,
        sourceType: source.sourceType === 'manual_text' ? 'manual' : source.sourceType,
        title: source.title,
        documentId: source.documentId ?? undefined,
        url: source.url ?? undefined,
        status: 'active',
        createdBy: actorClerkUserId,
      })
      .returning()
    existingSource = newSource
  }

  const sourceId = existingSource.id

  // 2. Create ingestion run
  const [ingestionRun] = await db
    .insert(aiKnowledgeIngestionRuns)
    .values({
      entityId,
      sourceId,
      status: 'queued',
    })
    .returning()

  try {
    // 3. Resolve source text
    const { text: sourceText, toolCall: resolveToolCall } = await resolveSourceText(proposal)
    toolCalls.push(resolveToolCall)

    // 4. Chunk text
    const chunkStartedAt = new Date()
    const chunks = chunkText(
      sourceText,
      ingestion.chunkSize,
      ingestion.chunkOverlap,
      ingestion.maxChunks,
    )
    const chunkFinishedAt = new Date()

    toolCalls.push(
      createToolCallEntry({
        toolName: 'knowledgeTool.chunkText',
        startedAt: chunkStartedAt,
        finishedAt: chunkFinishedAt,
        inputs: {
          textLength: sourceText.length,
          chunkSize: ingestion.chunkSize,
          chunkOverlap: ingestion.chunkOverlap,
        },
        outputs: { chunkCount: chunks.length },
        status: 'success',
      }),
    )

    // Update status to chunked
    await db
      .update(aiKnowledgeIngestionRuns)
      .set({ status: 'chunked', updatedAt: new Date() })
      .where(eq(aiKnowledgeIngestionRuns.id, ingestionRun.id))

    // 5. Embed chunks in batches
    const embedStartedAt = new Date()
    let totalEmbeddings = 0

    for (let i = 0; i < chunks.length; i += ingestion.embeddingBatchSize) {
      const batch = chunks.slice(i, i + ingestion.embeddingBatchSize)
      const batchTexts = batch.map((c) => c.text)

      const embedResult = await embed({
        entityId,
        appKey: proposal.appKey,
        profileKey: proposal.profileKey,
        input: batchTexts,
        dataClass: retention.dataClass,
      })

      // Insert embeddings rows
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]
        const embeddingVector = embedResult.embeddings[j]

        await db.insert(aiEmbeddings).values({
          entityId,
          appKey: proposal.appKey,
          sourceId,
          chunkId: chunk.chunkId,
          chunkText: chunk.text,
          embedding: JSON.stringify(embeddingVector),
          metadata: {
            sourceId,
            chunkIndex: chunk.chunkIndex,
            title: source.title,
            dataClass: retention.dataClass,
            citationsRequired: citations.requireCitations,
          },
        })
        totalEmbeddings++
      }
    }

    const embedFinishedAt = new Date()
    toolCalls.push(
      createToolCallEntry({
        toolName: 'knowledgeTool.embedChunks',
        startedAt: embedStartedAt,
        finishedAt: embedFinishedAt,
        inputs: { chunkCount: chunks.length, batchSize: ingestion.embeddingBatchSize },
        outputs: { embeddingCount: totalEmbeddings },
        status: 'success',
      }),
    )

    // Update status to embedded
    await db
      .update(aiKnowledgeIngestionRuns)
      .set({ status: 'embedded', updatedAt: new Date() })
      .where(eq(aiKnowledgeIngestionRuns.id, ingestionRun.id))

    // 6. Update knowledge source status
    await db
      .update(aiKnowledgeSources)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(aiKnowledgeSources.id, sourceId))

    // 7. Create ingestion report
    const report = {
      sourceId,
      ingestionRunId: ingestionRun.id,
      entityId,
      source: { title: source.title, sourceType: source.sourceType },
      metrics: {
        textLength: sourceText.length,
        chunkCount: chunks.length,
        chunkSize: ingestion.chunkSize,
        chunkOverlap: ingestion.chunkOverlap,
        embeddingCount: totalEmbeddings,
        embeddingModel: 'text-embedding-ada-002', // from profile in production
        embeddingDimensions: 1536,
      },
      retention: { dataClass: retention.dataClass, retentionDays: retention.retentionDays },
      citations: { requireCitations: citations.requireCitations },
      timestamps: {
        startedAt: ingestionRun.createdAt.toISOString(),
        completedAt: new Date().toISOString(),
      },
    }

    const reportBuffer = Buffer.from(JSON.stringify(report, null, 2), 'utf-8')
    const reportBlobPath = `exports/${entityId}/ai/ingestion/${sourceId}/${ingestionRun.id}/report.json`

    const uploadResult = await uploadWithLogging({
      blobPath: reportBlobPath,
      buffer: reportBuffer,
      contentType: 'application/json',
    })
    toolCalls.push(uploadResult.toolCall)

    // Create documents row for the ingestion report
    const [reportDoc] = await db
      .insert(documents)
      .values({
        entityId,
        category: 'ingestion_report',
        title: `Knowledge ingestion report — ${source.title}`,
        blobContainer: 'exports',
        blobPath: uploadResult.blobPath,
        contentType: 'application/json',
        sizeBytes: BigInt(uploadResult.sizeBytes),
        sha256: uploadResult.sha256,
        uploadedBy: actorClerkUserId,
        classification: 'internal',
        linkedType: 'ai_knowledge_source',
        linkedId: sourceId,
      })
      .returning()

    // 8. Finalize ingestion run
    await db
      .update(aiKnowledgeIngestionRuns)
      .set({
        status: 'stored',
        metricsJson: report.metrics,
        updatedAt: new Date(),
      })
      .where(eq(aiKnowledgeIngestionRuns.id, ingestionRun.id))

    return {
      sourceId,
      ingestionRunId: ingestionRun.id,
      chunkCount: chunks.length,
      embeddingCount: totalEmbeddings,
      reportDocumentId: reportDoc.id,
      toolCalls,
    }
  } catch (err) {
    // Mark as failed
    await db
      .update(aiKnowledgeIngestionRuns)
      .set({
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(aiKnowledgeIngestionRuns.id, ingestionRun.id))

    throw err
  }
}

/**
 * @nzila/ai-core — Knowledge Ingestion Tool
 *
 * Deterministic text chunking, embedding, and storage into
 * aiEmbeddings + aiKnowledgeSources.
 * Idempotent by (entityId, sourceId, chunkSize, overlap).
 *
 * Moved from @nzila/tools-runtime to break the circular dependency.
 * Pure chunking utilities remain in @nzila/tools-runtime.
 */
import { db } from '@nzila/db'
import {
  aiKnowledgeSources,
  aiEmbeddings,
  aiKnowledgeIngestionRuns,
  documents,
} from '@nzila/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { embed } from '../gateway'
import { appendAiAuditEvent } from '../gateway'
import {
  uploadWithLogging,
  downloadWithLogging,
  createToolCallEntry,
} from '@nzila/tools-runtime'
import type { ToolCallEntry, TextChunk } from '@nzila/tools-runtime'
import { chunkText } from '@nzila/tools-runtime'
import type { AiIngestKnowledgeSourceProposal } from '../schemas'
import { createHash } from 'node:crypto'

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

    // 4. Chunk text (deterministic hash-based chunk IDs)
    const chunkStartedAt = new Date()
    const rawChunks = chunkText(
      sourceText,
      ingestion.chunkSize,
      ingestion.chunkOverlap,
      ingestion.maxChunks,
    )
    // Remap chunk IDs to be keyed on sourceId for cross-run deduplication
    const chunks = rawChunks.map((c) => ({
      ...c,
      chunkId: createHash('sha256').update(`${sourceId}::${c.chunkIndex}`).digest('hex').slice(0, 32),
    }))
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

    // 5. Dedup: find existing chunk IDs to avoid re-inserting
    const allChunkIds = chunks.map((c) => c.chunkId)
    const existingChunks = allChunkIds.length > 0
      ? await db
          .select({ chunkId: aiEmbeddings.chunkId })
          .from(aiEmbeddings)
          .where(
            and(
              eq(aiEmbeddings.sourceId, sourceId),
              inArray(aiEmbeddings.chunkId, allChunkIds),
            ),
          )
      : []

    const existingChunkIds = new Set(existingChunks.map((c) => c.chunkId))
    const newChunks = chunks.filter((c) => !existingChunkIds.has(c.chunkId))
    const skippedCount = chunks.length - newChunks.length

    await db
      .update(aiKnowledgeIngestionRuns)
      .set({ status: 'chunked', updatedAt: new Date() })
      .where(eq(aiKnowledgeIngestionRuns.id, ingestionRun.id))

    // 6. Embed new chunks only (dedup)
    const embedStartedAt = new Date()
    let totalEmbeddings = 0

    for (let i = 0; i < newChunks.length; i += ingestion.embeddingBatchSize) {
      const batch = newChunks.slice(i, i + ingestion.embeddingBatchSize)
      const batchTexts = batch.map((c) => c.text)

      const embedResult = await embed({
        entityId,
        appKey: proposal.appKey,
        profileKey: proposal.profileKey,
        input: batchTexts,
        dataClass: retention.dataClass,
      })

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
        inputs: { chunkCount: chunks.length, newChunks: newChunks.length, batchSize: ingestion.embeddingBatchSize },
        outputs: { embeddingCount: totalEmbeddings, skippedDuplicates: skippedCount },
        status: 'success',
      }),
    )

    await db
      .update(aiKnowledgeIngestionRuns)
      .set({ status: 'embedded', updatedAt: new Date() })
      .where(eq(aiKnowledgeIngestionRuns.id, ingestionRun.id))

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
        newChunksIngested: newChunks.length,
        skippedDuplicates: skippedCount,
        chunkSize: ingestion.chunkSize,
        chunkOverlap: ingestion.chunkOverlap,
        embeddingCount: totalEmbeddings,
        embeddingModel: 'text-embedding-ada-002',
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
    const reportSha256 = createHash('sha256').update(reportBuffer).digest('hex')
    const reportBlobPath = `exports/${entityId}/ai/ingestion/${sourceId}/${ingestionRun.id}/report.json`

    const uploadResult = await uploadWithLogging({
      blobPath: reportBlobPath,
      buffer: reportBuffer,
      contentType: 'application/json',
    })
    toolCalls.push(uploadResult.toolCall)

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

    await db
      .update(aiKnowledgeIngestionRuns)
      .set({
        status: 'stored',
        metricsJson: report.metrics,
        updatedAt: new Date(),
      })
      .where(eq(aiKnowledgeIngestionRuns.id, ingestionRun.id))

    await appendAiAuditEvent({
      entityId,
      actorClerkUserId,
      action: 'ai.knowledge_ingested',
      targetType: 'ai_knowledge_source',
      targetId: sourceId,
      afterJson: {
        sourceId,
        ingestionRunId: ingestionRun.id,
        chunkCount: chunks.length,
        newChunksIngested: newChunks.length,
        skippedDuplicates: skippedCount,
        embeddingCount: totalEmbeddings,
        reportDocumentId: reportDoc.id,
        reportSha256,
      },
    })

    return {
      sourceId,
      ingestionRunId: ingestionRun.id,
      chunkCount: chunks.length,
      embeddingCount: totalEmbeddings,
      reportDocumentId: reportDoc.id,
      toolCalls,
    }
  } catch (err) {
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

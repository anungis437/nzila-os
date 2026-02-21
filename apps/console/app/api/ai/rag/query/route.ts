/**
 * API — AI RAG Query
 * POST /api/ai/rag/query
 *
 * Vector search in aiEmbeddings scoped to entityId+appKey,
 * then optionally passes retrieved context to LLM for answer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import {
  generate,
  embed,
  AiRagQueryRequestSchema,
} from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { sql } from 'drizzle-orm'
import { asAiError } from '@/lib/catch-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiRagQueryRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { entityId, appKey, profileKey, query, topK, dataClass } = parsed.data

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    // 1. Generate embedding for query
    const queryEmbedding = await embed({
      entityId,
      appKey,
      profileKey,
      input: query,
      dataClass,
    })

    const queryVector = queryEmbedding.embeddings[0]
    if (!queryVector) {
      return NextResponse.json(
        { error: 'Failed to generate query embedding', code: 'provider_error' },
        { status: 500 },
      )
    }

    // 2. Vector similarity search (pgvector cosine distance)
    // Note: This requires the vector column to be properly typed in the database
    const vectorStr = `[${queryVector.join(',')}]`

    const chunks = await platformDb.execute(sql`
      SELECT
        e.id,
        e.chunk_id,
        e.chunk_text,
        e.source_id,
        e.metadata,
        1 - (e.embedding <=> ${vectorStr}::vector) as score
      FROM ai_embeddings e
      WHERE e.entity_id = ${entityId}
        AND e.app_key = ${appKey}
      ORDER BY e.embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `)

    // platformDb.execute() with the postgres driver returns rows directly as RowList (iterable)
    const resultChunks = (chunks as unknown as Record<string, unknown>[]).map((row) => ({
      chunkId: row.chunk_id as string,
      chunkText: row.chunk_text as string,
      score: Number(row.score),
      sourceId: row.source_id as string,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    }))

    // 3. Optionally generate answer using retrieved context
    let answer: string | undefined
    let answerTokensIn = 0
    let answerTokensOut = 0

    if (resultChunks.length > 0) {
      const context = resultChunks
        .map((c: { chunkText: string }, i: number) => `[${i + 1}] ${c.chunkText}`)
        .join('\n\n')

      const ragPrompt = `Answer the following question using ONLY the provided context. If the context doesn't contain enough information, say so.\n\nContext:\n${context}\n\nQuestion: ${query}`

      try {
        const ragResult = await generate({
          entityId,
          appKey,
          profileKey,
          input: ragPrompt,
          dataClass,
        })
        answer = ragResult.content
        answerTokensIn = ragResult.tokensIn
        answerTokensOut = ragResult.tokensOut
      } catch {
        // RAG answer is optional — return chunks without answer
      }
    }

    return NextResponse.json({
      requestId: queryEmbedding.requestId,
      chunks: resultChunks,
      answer,
      tokensIn: answerTokensIn,
      tokensOut: answerTokensOut,
    })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    console.error('[AI RAG Query Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}

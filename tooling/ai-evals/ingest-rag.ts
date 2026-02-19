/**
 * Nzila OS — RAG Ingestion Script
 *
 * Chunks documents from ai_knowledge_sources and generates embeddings
 * stored in ai_embeddings for vector search.
 *
 * Usage:
 *   npx tsx tooling/ai-evals/ingest-rag.ts --entityId <uuid> --appKey <app> --sourceId <uuid>
 */
import { db } from '@nzila/db'
import { aiKnowledgeSources, aiEmbeddings } from '@nzila/db/schema'
import { downloadBuffer } from '@nzila/blob'
import { documents } from '@nzila/db/schema'
import { eq, and, sql } from 'drizzle-orm'

// ── Config ──────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1000 // characters
const CHUNK_OVERLAP = 200

// ── CLI Args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  let entityId = ''
  let appKey = ''
  let sourceId = ''
  let baseUrl = 'http://localhost:3001'
  let token = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--entityId' && args[i + 1]) entityId = args[++i]
    if (args[i] === '--appKey' && args[i + 1]) appKey = args[++i]
    if (args[i] === '--sourceId' && args[i + 1]) sourceId = args[++i]
    if (args[i] === '--baseUrl' && args[i + 1]) baseUrl = args[++i]
    if (args[i] === '--token' && args[i + 1]) token = args[++i]
  }

  if (!entityId || !appKey || !sourceId || !token) {
    console.error('Usage: npx tsx ingest-rag.ts --entityId <uuid> --appKey <app> --sourceId <uuid> --token <token> [--baseUrl <url>]')
    process.exit(1)
  }

  return { entityId, appKey, sourceId, baseUrl, token }
}

// ── Chunking ────────────────────────────────────────────────────────────────

function chunkText(text: string): { chunkId: string; chunkText: string }[] {
  const chunks: { chunkId: string; chunkText: string }[] = []
  let start = 0
  let idx = 0

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    const chunk = text.slice(start, end)
    chunks.push({
      chunkId: `chunk-${String(idx).padStart(4, '0')}`,
      chunkText: chunk,
    })
    start = end - CHUNK_OVERLAP
    if (start >= text.length) break
    idx++
  }

  return chunks
}

// ── Embed via API ───────────────────────────────────────────────────────────

async function embedTexts(
  texts: string[],
  opts: { baseUrl: string; token: string; entityId: string; appKey: string },
): Promise<number[][]> {
  const res = await fetch(`${opts.baseUrl}/api/ai/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({
      entityId: opts.entityId,
      appKey: opts.appKey,
      profileKey: 'default',
      input: texts,
      dataClass: 'internal',
    }),
  })

  if (!res.ok) {
    throw new Error(`Embed API error: ${res.status} ${await res.text()}`)
  }

  const body = await res.json()
  return body.embeddings
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { entityId, appKey, sourceId, baseUrl, token } = parseArgs()

  // 1. Load source
  const [source] = await db
    .select()
    .from(aiKnowledgeSources)
    .where(
      and(
        eq(aiKnowledgeSources.id, sourceId),
        eq(aiKnowledgeSources.entityId, entityId),
      ),
    )
    .limit(1)

  if (!source) {
    console.error(`Source ${sourceId} not found for entity ${entityId}`)
    process.exit(1)
  }

  console.log(`📄 Ingesting source: ${source.title} (${source.sourceType})`)

  // 2. Get document content
  let text: string

  if (source.sourceType === 'blob_document' && source.documentId) {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, source.documentId))
      .limit(1)

    if (!doc) {
      console.error(`Document ${source.documentId} not found`)
      process.exit(1)
    }

    const buffer = await downloadBuffer(doc.blobContainer, doc.blobPath)
    text = buffer.toString('utf-8')
  } else if (source.sourceType === 'url' && source.url) {
    const res = await fetch(source.url)
    text = await res.text()
  } else {
    console.error('Unsupported source type or missing reference')
    process.exit(1)
  }

  // 3. Chunk
  const chunks = chunkText(text)
  console.log(`🔪 Created ${chunks.length} chunks`)

  // 4. Embed in batches of 20
  const BATCH_SIZE = 20
  let embedded = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map((c) => c.chunkText)

    const embeddings = await embedTexts(texts, { baseUrl, token, entityId, appKey })

    // 5. Insert into ai_embeddings
    for (let j = 0; j < batch.length; j++) {
      const vectorStr = `[${embeddings[j].join(',')}]`

      await db.execute(sql`
        INSERT INTO ai_embeddings (id, entity_id, app_key, source_id, chunk_id, chunk_text, embedding, metadata, created_at)
        VALUES (
          gen_random_uuid(),
          ${entityId},
          ${appKey},
          ${sourceId},
          ${batch[j].chunkId},
          ${batch[j].chunkText},
          ${vectorStr}::vector,
          ${JSON.stringify({ sourceTitle: source.title })}::jsonb,
          NOW()
        )
      `)
    }

    embedded += batch.length
    console.log(`  ✅ Embedded ${embedded}/${chunks.length} chunks`)
  }

  console.log(`\n✅ Ingestion complete: ${chunks.length} chunks from "${source.title}"`)
}

main().catch((err) => {
  console.error('Ingestion failed:', err)
  process.exit(1)
})

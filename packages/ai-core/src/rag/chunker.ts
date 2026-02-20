/**
 * @nzila/ai-core — RAG Chunker
 *
 * Deterministic text chunking with hash-based chunk IDs.
 * Re-exported from tools-runtime for convenience.
 *
 * Chunk IDs are: sha256(sourceId + "::" + chunkIndex).slice(0, 32)
 * This ensures re-ingestion produces identical chunk IDs,
 * enabling deduplication at the embedding layer.
 */
import { createHash } from 'node:crypto'

export interface ChunkOptions {
  chunkSize: number
  chunkOverlap: number
  maxChunks: number
  sourceId?: string
}

export interface TextChunk {
  chunkIndex: number
  chunkId: string
  text: string
}

/**
 * Generate a deterministic chunk ID from source + index.
 */
export function deterministicChunkId(sourceId: string, chunkIndex: number): string {
  return createHash('sha256')
    .update(`${sourceId}::${chunkIndex}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Split text into overlapping chunks deterministically.
 * Same input + same params = same chunks every time.
 */
export function chunkText(text: string, opts: ChunkOptions): TextChunk[] {
  const { chunkSize, chunkOverlap, maxChunks, sourceId } = opts
  const chunks: TextChunk[] = []
  let start = 0
  let index = 0

  while (start < text.length && index < maxChunks) {
    const end = Math.min(start + chunkSize, text.length)
    const chunkStr = text.slice(start, end)

    const chunkId = sourceId
      ? deterministicChunkId(sourceId, index)
      : `chunk-${index.toString().padStart(6, '0')}`

    chunks.push({
      chunkIndex: index,
      chunkId,
      text: chunkStr,
    })

    const nextStart = start + chunkSize - chunkOverlap
    if (nextStart <= start) {
      // Safety: avoid infinite loop if overlap >= chunkSize
      start = end
    } else {
      start = nextStart
    }
    index++
  }

  return chunks
}

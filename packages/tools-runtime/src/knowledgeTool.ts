/**
 * @nzila/tools-runtime - Deterministic Text Chunker
 *
 * Pure utility: no AI or DB dependencies.
 * Ingestion logic (embed + store) lives in @nzila/ai-core/tools/knowledgeTool.
 */
import { createHash } from 'node:crypto'

export interface TextChunk {
  chunkIndex: number
  chunkId: string
  text: string
}

/**
 * Split text into overlapping chunks deterministically.
 * Chunk IDs are hash-based: sha256(sourceId + chunkIndex) for determinism.
 * Same input + same params = same chunks every time.
 */
export function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  maxChunks: number,
  sourceId?: string,
): TextChunk[] {
  const chunks: TextChunk[] = []
  let start = 0
  let index = 0

  while (start < text.length && index < maxChunks) {
    const end = Math.min(start + chunkSize, text.length)
    const chunkStr = text.slice(start, end)

    const chunkId = sourceId
      ? createHash('sha256').update(`${sourceId}::${index}`).digest('hex').slice(0, 32)
      : `chunk-${index.toString().padStart(6, '0')}`

    chunks.push({ chunkIndex: index, chunkId, text: chunkStr })

    start += chunkSize - chunkOverlap
    if (start <= (chunks[chunks.length - 1]?.chunkIndex ?? 0) * (chunkSize - chunkOverlap) && start > 0) {
      start = end
    }
    index++
  }

  return chunks
}
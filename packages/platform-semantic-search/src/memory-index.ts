/**
 * @nzila/platform-semantic-search — In-Memory Search Index
 *
 * Production-grade in-memory index using BM25 (Okapi) for lexical scoring,
 * cosine similarity for semantic scoring, and Reciprocal Rank Fusion (RRF)
 * for hybrid mode. Production deployments should use PostgreSQL pg_tsvector +
 * pgvector for persistence and scalability; this implementation provides the
 * same algorithmic quality for tests, dev, and small-scale use.
 */
import type {
  SearchDocument,
  SearchIndex,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchMode,
} from './types'
import { createBM25Index, reciprocalRankFusion, type BM25Index } from './bm25'

// ── Cosine Similarity ───────────────────────────────────────────────────────

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dotProduct / denom
}

// ── Normalise score to [0, 1] using sigmoid ─────────────────────────────────

function sigmoidNorm(score: number, midpoint: number = 3): number {
  return 1 / (1 + Math.exp(-(score - midpoint)))
}

// ── Candidate filter ────────────────────────────────────────────────────────

function filterCandidates(
  documents: Map<string, SearchDocument>,
  query: SearchQuery,
): SearchDocument[] {
  const candidates: SearchDocument[] = []
  for (const doc of documents.values()) {
    if (doc.tenantId !== query.tenantId) continue
    if (
      query.entityTypes &&
      query.entityTypes.length > 0 &&
      !query.entityTypes.includes(doc.entityType)
    ) continue
    if (query.tags && query.tags.length > 0) {
      const hasTag = query.tags.some((t) => doc.tags.includes(t))
      if (!hasTag) continue
    }
    candidates.push(doc)
  }
  return candidates
}

// ── In-Memory Search Index ──────────────────────────────────────────────────

export function createInMemorySearchIndex(): SearchIndex {
  const documents = new Map<string, SearchDocument>()
  const bm25: BM25Index = createBM25Index({ k1: 1.2, b: 0.75, titleBoost: 1.5 })

  return {
    async indexDocument(doc) {
      documents.set(doc.id, doc)
      bm25.addDocument(doc.id, doc.title, doc.content)
    },

    async removeDocument(id) {
      documents.delete(id)
      bm25.removeDocument(id)
    },

    async getDocument(id) {
      return documents.get(id)
    },

    async reindexAll(tenantId) {
      // Rebuild BM25 index for the tenant's documents
      let count = 0
      for (const doc of documents.values()) {
        if (doc.tenantId === tenantId) {
          bm25.addDocument(doc.id, doc.title, doc.content)
          count++
        }
      }
      return count
    },

    async search(query: SearchQuery): Promise<SearchResponse> {
      const start = performance.now()
      const { mode, limit = 20, offset = 0 } = query
      const candidates = filterCandidates(documents, query)

      if (candidates.length === 0) {
        return {
          query: query.query,
          mode,
          results: [],
          totalCount: 0,
          executionTimeMs: performance.now() - start,
        }
      }

      const candidateIds = new Set(candidates.map((c) => c.id))
      let results: SearchResult[]

      if (mode === 'hybrid') {
        // ── Reciprocal Rank Fusion ──────────────────────────────────
        // Build two independent ranked lists and fuse them with RRF.
        const lexicalRanked: Array<{ id: string; score: number }> = bm25
          .scoreAll(query.query)
          .filter((r) => candidateIds.has(r.id))

        const semanticRanked: Array<{ id: string; score: number }> = []
        if (query.embedding) {
          for (const doc of candidates) {
            if (doc.embedding) {
              const sim = cosineSimilarity(query.embedding, doc.embedding)
              if (sim > 0) semanticRanked.push({ id: doc.id, score: sim })
            }
          }
          semanticRanked.sort((a, b) => b.score - a.score)
        }

        const fused = reciprocalRankFusion([lexicalRanked, semanticRanked])
        const maxFusedScore = fused.length > 0 ? fused[0].score : 1
        results = fused
          .filter((f) => candidateIds.has(f.item.id))
          .map((f) => ({
            document: documents.get(f.item.id)!,
            // Normalize fused rank scores so top-ranked hybrids are easier to threshold.
            score: maxFusedScore > 0 ? f.score / maxFusedScore : 0,
            matchType: 'hybrid' as SearchMode,
          }))
      } else if (mode === 'semantic') {
        // ── Pure semantic (cosine similarity) ───────────────────────
        const scored: SearchResult[] = []
        if (query.embedding) {
          for (const doc of candidates) {
            if (doc.embedding) {
              const sim = cosineSimilarity(query.embedding, doc.embedding)
              if (sim > 0) scored.push({ document: doc, score: sim, matchType: 'semantic' })
            }
          }
        }
        scored.sort((a, b) => b.score - a.score)
        results = scored
      } else {
        // ── Lexical (BM25) ──────────────────────────────────────────
        const bm25Scores = bm25.scoreAll(query.query)
        results = bm25Scores
          .filter((r) => candidateIds.has(r.id))
          .map((r) => ({
            document: documents.get(r.id)!,
            score: sigmoidNorm(r.score),
            matchType: 'lexical' as SearchMode,
          }))
      }

      const paged = results.slice(offset, offset + limit)
      const executionTimeMs = performance.now() - start

      return {
        query: query.query,
        mode,
        results: paged,
        totalCount: results.length,
        executionTimeMs,
      }
    },
  }
}

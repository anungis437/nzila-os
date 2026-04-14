/**
 * @nzila/platform-semantic-search
 *
 * Search across the platform — lexical (BM25), semantic (cosine similarity),
 * and hybrid (Reciprocal Rank Fusion) modes with ontology-aware filtering
 * and graph-aware expansion.
 */

// Types & schemas
export {
  SearchModes,
  SearchQuerySchema,
  IndexDocumentSchema,
} from './types'
export type {
  SearchMode,
  SearchDocument,
  SearchQuery,
  SearchResult,
  SearchResponse,
  SearchIndex,
  EmbeddingProvider,
  IndexDocumentInput,
} from './types'

// Operations
export { indexEntity, searchEntities, removeEntityFromIndex } from './operations'

// In-memory index (BM25 + cosine + RRF)
export { createInMemorySearchIndex } from './memory-index'

// BM25 & advanced retrieval primitives
export {
  createBM25Index,
  reciprocalRankFusion,
  expandQuery,
  tokenize,
  computeTermFrequency,
} from './bm25'
export type {
  BM25Index,
  BM25Params,
  BM25Document,
  TermFrequency,
  QueryExpansionResult,
} from './bm25'

// Drizzle schema
export { searchDocuments } from './schema'

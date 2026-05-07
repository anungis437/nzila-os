/**
 * @nzila/platform-semantic-search — Types
 *
 * Search types for lexical, semantic, and hybrid search with
 * ontology-aware filtering and graph-aware expansion.
 */
import { z } from 'zod'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── Search Modes ────────────────────────────────────────────────────────────

export const SearchModes = {
  LEXICAL: 'lexical',
  SEMANTIC: 'semantic',
  HYBRID: 'hybrid',
} as const

export type SearchMode = (typeof SearchModes)[keyof typeof SearchModes]

// ── Search Document ─────────────────────────────────────────────────────────

export interface SearchDocument {
  readonly id: string
  readonly tenantId: string
  readonly entityType: OntologyEntityType
  readonly resourceId: string
  readonly title: string
  readonly content: string
  readonly metadata: Record<string, unknown>
  readonly tags: readonly string[]
  readonly embedding?: readonly number[]
  readonly indexedAt: string
}

// ── Search Query ────────────────────────────────────────────────────────────

export interface SearchQuery {
  readonly tenantId: string
  readonly query: string
  readonly mode: SearchMode
  readonly entityTypes?: readonly OntologyEntityType[]
  readonly tags?: readonly string[]
  readonly limit?: number
  readonly offset?: number
  /** If true, expand results to include graph neighbors */
  readonly graphExpansion?: boolean
  readonly graphDepth?: number
  readonly embedding?: readonly number[]
}

// ── Search Result ───────────────────────────────────────────────────────────

export interface SearchResult {
  readonly document: SearchDocument
  readonly score: number
  readonly matchType: SearchMode
  /** If the result was found via graph expansion */
  readonly expandedFrom?: string
}

// ── Search Response ─────────────────────────────────────────────────────────

export interface SearchResponse {
  readonly query: string
  readonly mode: SearchMode
  readonly results: readonly SearchResult[]
  readonly totalCount: number
  readonly executionTimeMs: number
}

// ── Search Index Interface ──────────────────────────────────────────────────

export interface SearchIndex {
  indexDocument(doc: SearchDocument): Promise<void>
  removeDocument(id: string): Promise<void>
  search(query: SearchQuery): Promise<SearchResponse>
  getDocument(id: string): Promise<SearchDocument | undefined>
  reindexAll(tenantId: string): Promise<number>
}

// ── Embedding Provider Interface ────────────────────────────────────────────

export interface EmbeddingProvider {
  embed(text: string): Promise<readonly number[]>
  embedBatch(texts: readonly string[]): Promise<ReadonlyArray<readonly number[]>>
  readonly dimensions: number
  readonly modelId: string
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const SearchQuerySchema = z.object({
  tenantId: z.string().uuid(),
  query: z.string().min(1),
  mode: z.enum(Object.values(SearchModes) as [string, ...string[]]),
  entityTypes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  graphExpansion: z.boolean().default(false),
  graphDepth: z.number().int().min(1).max(3).default(1),
})

export const IndexDocumentSchema = z.object({
  tenantId: z.string().uuid(),
  entityType: z.string().min(1),
  resourceId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
})

export type IndexDocumentInput = z.infer<typeof IndexDocumentSchema>

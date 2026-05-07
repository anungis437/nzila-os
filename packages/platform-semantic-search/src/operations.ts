/**
 * @nzila/platform-semantic-search — Operations
 *
 * High-level search operations built on top of the SearchIndex interface.
 */
import type {
  SearchIndex,
  SearchDocument,
  SearchQuery,
  SearchResponse,
  IndexDocumentInput,
} from './types'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── ID Generation ───────────────────────────────────────────────────────────

let idCounter = 0
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  idCounter++
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`
}

// ── Index an Entity ─────────────────────────────────────────────────────────

export async function indexEntity(
  searchIndex: SearchIndex,
  input: IndexDocumentInput,
  embedding?: readonly number[],
): Promise<SearchDocument> {
  const doc: SearchDocument = {
    id: generateId(),
    tenantId: input.tenantId,
    entityType: input.entityType as OntologyEntityType,
    resourceId: input.resourceId,
    title: input.title,
    content: input.content,
    metadata: input.metadata,
    tags: input.tags,
    embedding,
    indexedAt: new Date().toISOString(),
  }
  await searchIndex.indexDocument(doc)
  return doc
}

// ── Search Entities ─────────────────────────────────────────────────────────

export async function searchEntities(
  searchIndex: SearchIndex,
  query: SearchQuery,
): Promise<SearchResponse> {
  return searchIndex.search(query)
}

// ── Remove Entity from Index ────────────────────────────────────────────────

export async function removeEntityFromIndex(
  searchIndex: SearchIndex,
  documentId: string,
): Promise<void> {
  await searchIndex.removeDocument(documentId)
}

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SearchModes,
  createInMemorySearchIndex,
  indexEntity,
  searchEntities,
  removeEntityFromIndex,
} from './index'
import type { SearchIndex } from './index'
import { searchDocuments } from './schema'
import { OntologyEntityTypes } from '@nzila/platform-ontology'

const TENANT = '00000000-0000-0000-0000-000000000001'

describe('platform-semantic-search', () => {
  let idx: SearchIndex

  beforeEach(() => {
    idx = createInMemorySearchIndex()
  })

  // ── Indexing ──────────────────────────────────────────────────────

  describe('indexEntity', () => {
    it('indexes a document and retrieves it', async () => {
      const doc = await indexEntity(idx, {
        tenantId: TENANT,
        entityType: OntologyEntityTypes.CLIENT,
        resourceId: '00000000-0000-0000-0000-000000000010',
        title: 'Ada Lovelace',
        content: 'First computer programmer, daughter of Lord Byron',
        metadata: { source: 'hubspot' },
        tags: ['vip', 'tech'],
      })

      expect(doc.id).toBeDefined()
      expect(doc.title).toBe('Ada Lovelace')

      const retrieved = await idx.getDocument(doc.id)
      expect(retrieved).toEqual(doc)
    })
  })

  // ── Lexical Search ────────────────────────────────────────────────

  describe('lexical search', () => {
    beforeEach(async () => {
      await indexEntity(idx, {
        tenantId: TENANT,
        entityType: OntologyEntityTypes.CLIENT,
        resourceId: '00000000-0000-0000-0000-000000000010',
        title: 'Ada Lovelace',
        content: 'First computer programmer, analytical engine expert',
        metadata: {},
        tags: ['tech'],
      })
      await indexEntity(idx, {
        tenantId: TENANT,
        entityType: OntologyEntityTypes.CLIENT,
        resourceId: '00000000-0000-0000-0000-000000000011',
        title: 'Grace Hopper',
        content: 'Computer scientist, COBOL inventor, Navy admiral',
        metadata: {},
        tags: ['tech', 'military'],
      })
      await indexEntity(idx, {
        tenantId: TENANT,
        entityType: OntologyEntityTypes.DOCUMENT,
        resourceId: '00000000-0000-0000-0000-000000000012',
        title: 'Annual Report 2024',
        content: 'Financial summary and outlook',
        metadata: {},
        tags: ['finance'],
      })
    })

    it('finds matching documents', async () => {
      const response = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'computer programmer',
        mode: SearchModes.LEXICAL,
      })
      expect(response.results.length).toBeGreaterThan(0)
      expect(response.results[0].document.title).toBe('Ada Lovelace')
    })

    it('filters by entity type', async () => {
      const response = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'computer',
        mode: SearchModes.LEXICAL,
        entityTypes: [OntologyEntityTypes.DOCUMENT],
      })
      expect(response.results).toHaveLength(0)
    })

    it('filters by tag', async () => {
      const response = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'computer',
        mode: SearchModes.LEXICAL,
        tags: ['military'],
      })
      expect(response.results).toHaveLength(1)
      expect(response.results[0].document.title).toBe('Grace Hopper')
    })

    it('respects tenant isolation', async () => {
      const response = await searchEntities(idx, {
        tenantId: '00000000-0000-0000-0000-999999999999',
        query: 'computer',
        mode: SearchModes.LEXICAL,
      })
      expect(response.results).toHaveLength(0)
    })

    it('returns no matches for tokenless queries', async () => {
      const response = await searchEntities(idx, {
        tenantId: TENANT,
        query: '... !',
        mode: SearchModes.LEXICAL,
      })

      expect(response.results).toHaveLength(0)
    })

    it('supports offset and limit pagination after sorting by score', async () => {
      const response = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'computer',
        mode: SearchModes.LEXICAL,
        offset: 1,
        limit: 1,
      })

      expect(response.totalCount).toBe(2)
      expect(response.results).toHaveLength(1)
      expect(response.results[0].document.title).toBe('Grace Hopper')
    })
  })

  // ── Semantic Search ───────────────────────────────────────────────

  describe('semantic search', () => {
    it('uses cosine similarity with embeddings', async () => {
      await indexEntity(
        idx,
        {
          tenantId: TENANT,
          entityType: OntologyEntityTypes.CLIENT,
          resourceId: '00000000-0000-0000-0000-000000000010',
          title: 'Test Doc',
          content: 'Test content',
          metadata: {},
          tags: [],
        },
        [1, 0, 0],
      )

      const response = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'test',
        mode: SearchModes.SEMANTIC,
        embedding: [1, 0, 0],
      })
      expect(response.results).toHaveLength(1)
      expect(response.results[0].score).toBeCloseTo(1.0)
    })

    it('returns no semantic matches when embeddings are missing or incompatible', async () => {
      await indexEntity(idx, {
        tenantId: TENANT,
        entityType: OntologyEntityTypes.CLIENT,
        resourceId: '00000000-0000-0000-0000-000000000013',
        title: 'Plain text only',
        content: 'No embedding stored',
        metadata: {},
        tags: [],
      })

      const missingEmbedding = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'plain',
        mode: SearchModes.SEMANTIC,
      })
      expect(missingEmbedding.results).toHaveLength(0)

      await indexEntity(
        idx,
        {
          tenantId: TENANT,
          entityType: OntologyEntityTypes.CLIENT,
          resourceId: '00000000-0000-0000-0000-000000000014',
          title: 'Short vector',
          content: 'Mismatched dimensions',
          metadata: {},
          tags: [],
        },
        [1, 0],
      )

      const mismatched = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'short',
        mode: SearchModes.SEMANTIC,
        embedding: [1, 0, 0],
      })
      expect(mismatched.results).toHaveLength(0)
    })

    it('blends lexical and semantic scores in hybrid mode', async () => {
      await indexEntity(
        idx,
        {
          tenantId: TENANT,
          entityType: OntologyEntityTypes.CLIENT,
          resourceId: '00000000-0000-0000-0000-000000000015',
          title: 'Hybrid match',
          content: 'computer language pioneer',
          metadata: {},
          tags: ['tech'],
        },
        [1, 0, 0],
      )

      const response = await searchEntities(idx, {
        tenantId: TENANT,
        query: 'computer pioneer',
        mode: SearchModes.HYBRID,
        embedding: [1, 0, 0],
      })

      expect(response.results).toHaveLength(1)
      expect(response.results[0].matchType).toBe(SearchModes.HYBRID)
      expect(response.results[0].score).toBeGreaterThan(0.5)
    })
  })

  // ── Removal ───────────────────────────────────────────────────────

  describe('removeEntityFromIndex', () => {
    it('removes a document from the index', async () => {
      const doc = await indexEntity(idx, {
        tenantId: TENANT,
        entityType: OntologyEntityTypes.CLIENT,
        resourceId: '00000000-0000-0000-0000-000000000010',
        title: 'To Remove',
        content: 'Will be removed',
        metadata: {},
        tags: [],
      })

      await removeEntityFromIndex(idx, doc.id)
      const retrieved = await idx.getDocument(doc.id)
      expect(retrieved).toBeUndefined()
    })
  })

  describe('reindexAll', () => {
    it('counts documents for the requested tenant only', async () => {
      await indexEntity(idx, {
        tenantId: TENANT,
        entityType: OntologyEntityTypes.CLIENT,
        resourceId: '00000000-0000-0000-0000-000000000016',
        title: 'Tenant one',
        content: 'Alpha tenant doc',
        metadata: {},
        tags: [],
      })
      await indexEntity(idx, {
        tenantId: '00000000-0000-0000-0000-000000000099',
        entityType: OntologyEntityTypes.CLIENT,
        resourceId: '00000000-0000-0000-0000-000000000017',
        title: 'Tenant two',
        content: 'Beta tenant doc',
        metadata: {},
        tags: [],
      })

      await expect(idx.reindexAll(TENANT)).resolves.toBe(1)
    })
  })

  describe('operations fallback paths', () => {
    it('generates deterministic IDs when crypto.randomUUID is unavailable', async () => {
      const originalCrypto = globalThis.crypto
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
      })

      try {
        const isolatedIndex = createInMemorySearchIndex()
        const doc = await indexEntity(isolatedIndex, {
          tenantId: TENANT,
          entityType: OntologyEntityTypes.CLIENT,
          resourceId: '00000000-0000-0000-0000-000000000018',
          title: 'Fallback ID',
          content: 'Generated without crypto',
          metadata: {},
          tags: [],
        })

        expect(doc.id).toMatch(/^00000000-0000-0000-0000-\d{12}$/)
      } finally {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          configurable: true,
        })
      }
    })
  })

  describe('schema and barrel exports', () => {
    it('exposes the drizzle table definition', () => {
      expect((searchDocuments as unknown as Record<symbol, unknown>)[Symbol.for('drizzle:Name')]).toBe('search_documents')
      expect(searchDocuments.title.name).toBe('title')
      expect(searchDocuments.updatedAt.name).toBe('updated_at')
    })

    it('re-exports the public search API', async () => {
      const api = await import('./index')

      expect(api.SearchModes).toBeDefined()
      expect(api.createInMemorySearchIndex).toBe(createInMemorySearchIndex)
      expect(api.indexEntity).toBe(indexEntity)
      expect(api.searchDocuments).toBe(searchDocuments)
    })
  })
})

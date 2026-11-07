import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  orgs: [] as string[],
  audit: vi.fn(),
  operation: vi.fn(),
  ready: vi.fn(),
  write: vi.fn(),
  embed: vi.fn(),
  error: vi.fn(),
}))

const tx = {
  insert: () => ({
    values: (v: Record<string, unknown>) => {
      h.inserted.push(v)
      return { returning: async () => [{ id: `kb_${h.inserted.length}` }] }
    },
  }),
}

vi.mock('@/db/schema', () => ({ knowledgeBase: { id: 'id' } }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (ctx: { organizationId: string }, fn: (t: unknown) => Promise<unknown>) => {
    h.orgs.push(ctx.organizationId)
    return fn(tx)
  },
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }))
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: h.operation }))
vi.mock('@/lib/ai/ai-client', () => ({ getAiClient: () => ({ embed: h.embed }), UE_APP_KEY: 'k', UE_PROFILES: { EMBEDDINGS: 'e' }, UE_SYSTEM_ORG_ID: 's' }))
vi.mock('@/lib/ai/knowledge-base-embeddings', () => ({ writeKnowledgeBaseEmbedding: h.write }))
vi.mock('@/lib/ai/vector-readiness', () => ({ KNOWLEDGE_BASE_EMBEDDING: {}, vectorColumnReady: h.ready }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.error } }))

import { chunkIngestedText, indexIngestedDocument, INGEST_MAX_CHUNKS, IngestTooLargeToIndexError } from '../durable-ingest-index'

const input = { organizationId: 'org_1', userId: 'u1', documentId: 'doc_1', title: 'doc.txt', content: 'hello world', source: 'manual-upload' }

// DEF-0B2-AI-RAG-INDEX-PROCESS-LOCAL
describe('indexIngestedDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.inserted = []
    h.orgs = []
    h.audit.mockResolvedValue(undefined)
    h.operation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn())
    h.embed.mockResolvedValue({ embeddings: [[0.1, 0.2]] })
  })

  it('stores the text as the organization\'s own, non-public knowledge rows with an audit record in the same transaction', async () => {
    h.ready.mockResolvedValue(false)
    const result = await indexIngestedDocument(input)
    expect(h.orgs[0]).toBe('org_1')
    expect(h.inserted).toEqual([expect.objectContaining({
      organizationId: 'org_1', sourceType: 'ai_ingest', sourceId: 'doc_1', isPublic: false, isActive: true, createdBy: 'u1', content: 'hello world',
    })])
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'ai.ingest.knowledge_base', organizationId: 'org_1' }))
    expect(result).toEqual({ status: 'stored_without_embedding', durable: true, documentId: 'doc_1', knowledgeBaseIds: ['kb_1'], chunkCount: 1, embedded: false })
    // No vector column: nothing is sent to the embedding service.
    expect(h.embed).not.toHaveBeenCalled()
    expect(h.operation).not.toHaveBeenCalled()
  })

  it('stores each chunk\'s embedding after recording the intent, when the vector column exists', async () => {
    h.ready.mockResolvedValue(true)
    const result = await indexIngestedDocument(input)
    expect(h.operation).toHaveBeenCalledWith(expect.objectContaining({ action: 'ai.ingest.embed', organizationId: 'org_1' }), expect.any(Function))
    expect(h.write).toHaveBeenCalledWith(tx, { id: 'kb_1', organizationId: 'org_1', embedding: [0.1, 0.2] })
    expect(result).toMatchObject({ status: 'indexed', embedded: true })
  })

  it('reports the rows as stored without an embedding when the embedding cannot be stored, and claims none', async () => {
    h.ready.mockResolvedValue(true)
    h.embed.mockRejectedValue(new Error('provider down'))
    const result = await indexIngestedDocument(input)
    expect(result).toMatchObject({ status: 'stored_without_embedding', embedded: false, knowledgeBaseIds: ['kb_1'] })
    expect(h.write).not.toHaveBeenCalled()
  })

  it('refuses, before writing anything, a document that needs more chunks than are indexed per document', async () => {
    const content = Array.from({ length: INGEST_MAX_CHUNKS + 1 }, () => 'x'.repeat(6000)).join('\n\n')
    await expect(indexIngestedDocument({ ...input, content })).rejects.toBeInstanceOf(IngestTooLargeToIndexError)
    expect(h.inserted).toHaveLength(0)
    expect(h.audit).not.toHaveBeenCalled()
  })

  it('a failed audit record fails the whole write', async () => {
    h.ready.mockResolvedValue(false)
    h.audit.mockRejectedValueOnce(new Error('audit down'))
    await expect(indexIngestedDocument(input)).rejects.toThrow('audit down')
  })
})

describe('chunkIngestedText', () => {
  it('keeps every character of a short text in one chunk', () => {
    expect(chunkIngestedText('  abc  ')).toEqual(['abc'])
  })

  it('splits a long text into chunks no longer than the size, preferring a line break', () => {
    const text = `${'a'.repeat(70)}\n${'b'.repeat(70)}`
    const chunks = chunkIngestedText(text, 100)
    expect(chunks).toEqual(['a'.repeat(70), 'b'.repeat(70)])
    expect(chunks.every((c) => c.length <= 100)).toBe(true)
  })
})

/**
 * Tests for evidence/generate-evidence-index.ts
 *
 * Covers buildLocalEvidencePackIndex (pure) and processEvidencePack (mocked I/O).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock external deps before importing
vi.mock('@nzila/blob', () => ({
  uploadBuffer: vi.fn().mockResolvedValue(undefined),
  computeSha256: vi.fn((buf: Buffer) => {
    const { createHash } = require('node:crypto')
    return createHash('sha256').update(buf).digest('hex')
  }),
}))

const mockInsertReturning = vi.fn()
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }))
const mockInsert = vi.fn(() => ({ values: mockInsertValues }))
const mockSelectFrom = vi.fn()
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }))
const mockUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }))
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))

vi.mock('@nzila/db', () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  },
}))

vi.mock('@nzila/db/schema', () => ({
  documents: { id: 'id', orgId: 'orgId', createdAt: 'createdAt' },
  evidencePacks: { id: 'id' },
  evidencePackArtifacts: {},
  auditEvents: { hash: 'hash', orgId: 'orgId', createdAt: 'createdAt' },
}))

import type { EvidencePackRequest } from '../types'

function makeRequest(overrides?: Partial<EvidencePackRequest>): EvidencePackRequest {
  return {
    packId: 'IR-2026-001',
    orgId: '550e8400-e29b-41d4-a716-446655440000',
    controlFamily: 'incident-response',
    eventType: 'incident',
    eventId: 'INC-001',
    blobContainer: 'evidence',
    summary: 'Incident evidence pack',
    controlsCovered: ['IR-01', 'IR-02'],
    createdBy: 'user_123',
    artifacts: [
      {
        artifactId: 'art-1',
        artifactType: 'timeline',
        filename: 'timeline.json',
        buffer: Buffer.from('{"events":[]}'),
        contentType: 'application/json',
        retentionClass: '7_YEARS',
        classification: 'INTERNAL',
      },
    ],
    ...overrides,
  } as EvidencePackRequest
}

describe('generate-evidence-index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildLocalEvidencePackIndex', () => {
    it('builds a complete evidence pack index', async () => {
      const { buildLocalEvidencePackIndex } = await import('../generate-evidence-index')
      const request = makeRequest()
      const index = buildLocalEvidencePackIndex(request, { runId: 'run-1' })

      expect(index.$schema).toBe('Evidence-Pack-Index.schema.json')
      expect(index.packId).toBe('IR-2026-001')
      expect(index.runId).toBe('run-1')
      expect(index.orgId).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(index.controlFamily).toBe('incident-response')
      expect(index.eventType).toBe('incident')
      expect(index.eventId).toBe('INC-001')
      expect(index.summary).toBe('Incident evidence pack')
      expect(index.controlsCovered).toEqual(['IR-01', 'IR-02'])
      expect(index.createdBy).toBe('user_123')
      expect(index.createdAt).toBeTruthy()
    })

    it('generates artifacts with sha256 hashes', async () => {
      const { buildLocalEvidencePackIndex } = await import('../generate-evidence-index')
      const request = makeRequest()
      const index = buildLocalEvidencePackIndex(request)

      expect(index.artifacts).toHaveLength(1)
      const art = index.artifacts[0]!
      expect(art.artifactId).toBe('art-1')
      expect(art.artifactType).toBe('timeline')
      expect(art.filename).toBe('timeline.json')
      expect(art.sha256).toHaveLength(64)
      expect(art.contentType).toBe('application/json')
      expect(art.sizeBytes).toBeGreaterThan(0)
      expect(art.retentionClass).toBe('7_YEARS')
      expect(art.classification).toBe('INTERNAL')
    })

    it('generates a basePath from orgId/controlFamily/date/packId', async () => {
      const { buildLocalEvidencePackIndex } = await import('../generate-evidence-index')
      const request = makeRequest()
      const index = buildLocalEvidencePackIndex(request)

      expect(index.basePath).toContain('550e8400-e29b-41d4-a716-446655440000')
      expect(index.basePath).toContain('incident-response')
      expect(index.basePath).toContain('IR-2026-001')
    })

    it('uses custom basePath when provided', async () => {
      const { buildLocalEvidencePackIndex } = await import('../generate-evidence-index')
      const request = makeRequest()
      const index = buildLocalEvidencePackIndex(request, { basePath: 'custom/path' })

      expect(index.basePath).toBe('custom/path')
    })

    it('includes a cryptographic seal', async () => {
      const { buildLocalEvidencePackIndex } = await import('../generate-evidence-index')
      const request = makeRequest()
      const index = buildLocalEvidencePackIndex(request)

      expect(index.seal).toBeDefined()
      expect(index.seal.packDigest).toBeTruthy()
      expect(index.seal.artifactsMerkleRoot).toBeTruthy()
    })

    it('handles multiple artifacts', async () => {
      const { buildLocalEvidencePackIndex } = await import('../generate-evidence-index')
      const request = makeRequest({
        artifacts: [
          {
            artifactId: 'art-1',
            artifactType: 'timeline',
            filename: 'timeline.json',
            buffer: Buffer.from('{"events":[]}'),
            contentType: 'application/json',
            retentionClass: '7_YEARS',
            classification: 'INTERNAL',
          },
          {
            artifactId: 'art-2',
            artifactType: 'log',
            filename: 'audit.log',
            buffer: Buffer.from('log data'),
            contentType: 'text/plain',
            retentionClass: '3_YEARS',
            classification: 'CONFIDENTIAL',
          },
        ] as EvidencePackRequest['artifacts'],
      })
      const index = buildLocalEvidencePackIndex(request)
      expect(index.artifacts).toHaveLength(2)
    })
  })

  describe('processEvidencePack', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      // Setup DB mock chain for inserts
      mockInsertReturning.mockResolvedValue([{ id: 'doc-uuid-1' }])
      mockSelectFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ hash: 'prev-hash-1' }]),
          }),
        }),
      })
    })

    it('returns complete result in dryRun mode', async () => {
      const { processEvidencePack } = await import('../generate-evidence-index')
      const request = makeRequest()
      const result = await processEvidencePack(request, {
        dryRun: true,
        runId: 'test-run-1',
      })

      expect(result.packId).toBe('IR-2026-001')
      expect(result.runId).toBe('test-run-1')
      expect(result.orgId).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.controlFamily).toBe('incident-response')
      expect(result.artifacts).toHaveLength(1)
      expect(result.seal).toBeDefined()
      expect(result.indexBlobPath).toContain('evidence-pack-index.json')
    })

    it('dryRun does not call db or blob', async () => {
      const { processEvidencePack } = await import('../generate-evidence-index')
      const { uploadBuffer } = await import('@nzila/blob')
      const request = makeRequest()
      await processEvidencePack(request, { dryRun: true })

      expect(uploadBuffer).not.toHaveBeenCalled()
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('dryRun assigns dry-run prefixed IDs', async () => {
      const { processEvidencePack } = await import('../generate-evidence-index')
      const request = makeRequest()
      const result = await processEvidencePack(request, { dryRun: true })

      expect(result.artifacts[0]!.documentId).toMatch(/^dry-run-/)
      expect(result.artifacts[0]!.auditEventId).toMatch(/^dry-run-/)
      expect(result.indexDocumentId).toMatch(/^dry-run-/)
      expect(result.evidencePackDbId).toMatch(/^dry-run-/)
    })

    it('uploads artifacts and records in DB when not dryRun', async () => {
      const { processEvidencePack } = await import('../generate-evidence-index')
      const { uploadBuffer } = await import('@nzila/blob')
      const request = makeRequest()

      // Mock for evidence_packs insert
      let insertCallCount = 0
      mockInsertReturning.mockImplementation(() => {
        insertCallCount++
        return Promise.resolve([{ id: `uuid-${insertCallCount}` }])
      })

      const result = await processEvidencePack(request, { runId: 'run-2' })

      expect(uploadBuffer).toHaveBeenCalled()
      expect(mockInsert).toHaveBeenCalled()
      expect(result.packId).toBe('IR-2026-001')
      expect(result.runId).toBe('run-2')
      expect(result.seal).toBeDefined()
    })

    it('includes correct blobPath for artifacts', async () => {
      const { processEvidencePack } = await import('../generate-evidence-index')
      const request = makeRequest()
      const result = await processEvidencePack(request, { dryRun: true })

      const art = result.artifacts[0]!
      expect(art.blobPath).toContain('timeline.json')
      expect(art.sha256).toHaveLength(64)
    })

    it('uses default blobContainer "evidence"', async () => {
      const { processEvidencePack } = await import('../generate-evidence-index')
      const request = makeRequest()
      const result = await processEvidencePack(request, { dryRun: true })

      expect(result.blobContainer).toBe('evidence')
    })
  })
})

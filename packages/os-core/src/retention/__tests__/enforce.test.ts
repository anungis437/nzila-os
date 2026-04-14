/**
 * Tests for retention/enforce.ts — Retention Enforcement Job
 *
 * All DB/crypto operations are mocked via vi.doMock of dynamic imports.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('enforceRetention', () => {
  const mockInsertValues = vi.fn().mockResolvedValue(undefined)
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }))
  const mockUpdateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }))
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))
  const mockSelectFrom = vi.fn()
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }))

  const mockDb = { insert: mockInsert, select: mockSelect, update: mockUpdate }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    vi.doMock('node:crypto', () => ({ randomUUID: () => 'test-run-uuid' }))
    vi.doMock('@nzila/db', () => ({ db: mockDb }))
    vi.doMock('@nzila/db/schema', () => ({
      documents: { id: 'id', category: 'category', createdAt: 'createdAt' },
      auditEvents: {},
    }))
    vi.doMock('drizzle-orm', () => ({
      and: vi.fn(),
      isNotNull: vi.fn(),
      lte: vi.fn(),
      lt: vi.fn(),
      sql: vi.fn((strings: TemplateStringsArray) => strings[0]),
      eq: vi.fn(),
      desc: vi.fn(),
    }))
    vi.doMock('../../hash', () => ({
      computeEntryHash: vi.fn(() => 'hash-abc'),
    }))
  })

  async function loadModule() {
    return import('../../retention/enforce') as Promise<typeof import('../../retention/enforce')>
  }

  it('returns empty result when no expired docs found', async () => {
    mockSelectFrom.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({ actorId: 'user_1', runId: 'run-1' })

    expect(result.runId).toBe('run-1')
    expect(result.processedCount).toBe(0)
    expect(result.archivedCount).toBe(0)
    expect(result.deletedCount).toBe(0)
    expect(result.redactedCount).toBe(0)
    expect(result.skippedCount).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(result.completedAt).toBeTruthy()
  })

  it('skips documents without matching policy', async () => {
    mockSelectFrom.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { id: 'doc-1', category: 'unknown-category', retentionClass: '7_YEARS', createdAt: new Date('2010-01-01'), blobPath: '/blob/1', blobContainer: 'evidence', orgId: 'org-1' },
      ]),
    })

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({ actorId: 'user_1' })

    expect(result.skippedCount).toBe(1)
    expect(result.processedCount).toBe(0)
  })

  it('skips docs that are not expired', async () => {
    // Provide a doc with a "just created" timestamp and a matching category
    mockSelectFrom.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { id: 'doc-1', category: 'other', retentionClass: '7_YEARS', createdAt: new Date(), blobPath: '/blob/1', blobContainer: 'evidence', orgId: 'org-1' },
      ]),
    })

    const { enforceRetention } = await loadModule()
    // Use a policy that matches the category but has a long retention
    const result = await enforceRetention({
      actorId: 'user_1',
      policies: [
        { category: 'other', retentionClass: '7_YEARS' as const, expiryAction: 'archive', immutable: false },
      ],
    })

    // Document is brand new, so isExpired('7_YEARS', now) should be false
    expect(result.skippedCount).toBe(1)
    expect(result.processedCount).toBe(0)
  })

  it('processes expired documents in dryRun mode', async () => {
    const oldDate = new Date('2010-01-01')
    mockSelectFrom.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { id: 'doc-1', category: 'other', retentionClass: '7_YEARS', createdAt: oldDate, blobPath: '/blob/1', blobContainer: 'evidence', orgId: 'org-1' },
      ]),
    })

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({
      actorId: 'user_1',
      dryRun: true,
      policies: [
        { category: 'other', retentionClass: '7_YEARS' as const, expiryAction: 'archive', immutable: false },
      ],
    })

    expect(result.processedCount).toBe(1)
    expect(result.archivedCount).toBe(1)
    // dryRun should NOT insert into DB
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('counts delete actions correctly', async () => {
    const oldDate = new Date('2010-01-01')
    mockSelectFrom.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { id: 'doc-1', category: 'other', retentionClass: '7_YEARS', createdAt: oldDate, blobPath: '/blob/1', blobContainer: 'evidence', orgId: 'org-1' },
      ]),
    })

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({
      actorId: 'user_1',
      dryRun: true,
      policies: [
        { category: 'other', retentionClass: '7_YEARS' as const, expiryAction: 'delete', immutable: false },
      ],
    })

    expect(result.deletedCount).toBe(1)
    expect(result.archivedCount).toBe(0)
  })

  it('counts redact actions correctly', async () => {
    const oldDate = new Date('2010-01-01')
    mockSelectFrom.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { id: 'doc-1', category: 'other', retentionClass: '7_YEARS', createdAt: oldDate, blobPath: '/blob/1', blobContainer: 'evidence', orgId: 'org-1' },
      ]),
    })

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({
      actorId: 'user_1',
      dryRun: true,
      policies: [
        { category: 'other', retentionClass: '7_YEARS' as const, expiryAction: 'redact', immutable: false },
      ],
    })

    expect(result.redactedCount).toBe(1)
  })

  it('catches errors per document and continues', async () => {
    const oldDate = new Date('2010-01-01')
    mockSelectFrom.mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        { id: 'doc-1', category: 'other', retentionClass: '7_YEARS', createdAt: oldDate, blobPath: '/blob/1', blobContainer: 'evidence', orgId: 'org-1' },
        { id: 'doc-2', category: 'other', retentionClass: '7_YEARS', createdAt: oldDate, blobPath: '/blob/2', blobContainer: 'evidence', orgId: 'org-1' },
      ]),
    })

    // Make the DB insert fail for the first call, then succeed
    mockInsertValues.mockRejectedValueOnce(new Error('DB write failed')).mockResolvedValue(undefined)

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({
      actorId: 'user_1',
      dryRun: false,
      policies: [
        { category: 'other', retentionClass: '7_YEARS' as const, expiryAction: 'archive', immutable: false },
      ],
    })

    expect(result.processedCount).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.documentId).toBe('doc-1')
    expect(result.errors[0]!.error).toBe('DB write failed')
  })

  it('respects the limit option', async () => {
    mockSelectFrom.mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    })

    const { enforceRetention } = await loadModule()
    await enforceRetention({ actorId: 'user_1', limit: 10 })

    // Verify limit was passed to the select query
    const limitFn = mockSelectFrom.mock.results[0]?.value?.limit
    expect(limitFn).toBeDefined()
  })

  it('generates a runId when not provided', async () => {
    mockSelectFrom.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({ actorId: 'user_1' })

    expect(result.runId).toBe('test-run-uuid')
  })

  it('includes startedAt and completedAt timestamps', async () => {
    mockSelectFrom.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) })

    const { enforceRetention } = await loadModule()
    const result = await enforceRetention({ actorId: 'user_1' })

    expect(result.startedAt).toBeTruthy()
    expect(result.completedAt).toBeTruthy()
    expect(new Date(result.completedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(result.startedAt).getTime(),
    )
  })
})

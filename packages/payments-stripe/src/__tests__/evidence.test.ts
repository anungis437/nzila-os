import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockWhere = vi.fn()
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  const mockLimit = vi.fn()
  const mockDownloadBuffer = vi.fn()
  return { mockWhere, mockFrom, mockSelect, mockLimit, mockDownloadBuffer }
})

vi.mock('@nzila/db', () => ({
  db: { select: mocks.mockSelect },
}))

vi.mock('@nzila/db/schema', () => ({
  stripeReports: {
    id: 'id',
    orgId: 'orgId',
    reportType: 'reportType',
    startDate: 'startDate',
    endDate: 'endDate',
    documentId: 'documentId',
    sha256: 'sha256',
  },
  documents: {
    id: 'id',
    blobContainer: 'blobContainer',
    blobPath: 'blobPath',
    contentType: 'contentType',
  },
}))

vi.mock('@nzila/blob', () => ({
  downloadBuffer: mocks.mockDownloadBuffer,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ['eq', ...args]),
  and: vi.fn((...args: unknown[]) => ['and', ...args]),
  gte: vi.fn((...args: unknown[]) => ['gte', ...args]),
  lte: vi.fn((...args: unknown[]) => ['lte', ...args]),
}))

import {
  collectStripeEvidenceArtifacts,
  buildStripeEvidencePackRequest,
  type StripeEvidencePackInput,
} from '../evidence'

// ── Helpers ─────────────────────────────────────────────────────────────────

const baseInput: StripeEvidencePackInput = {
  orgId: 'org_1',
  startDate: '2025-03-01',
  endDate: '2025-03-31',
  periodLabel: '2025-03',
  createdBy: 'user_1',
}

function setupReportsQuery(reports: Array<Record<string, unknown>>) {
  const reportsWhere = vi.fn().mockResolvedValue(reports)
  const reportsFrom = vi.fn().mockReturnValue({ where: reportsWhere })
  mocks.mockSelect.mockReturnValueOnce({ from: reportsFrom })
}

function setupDocQuery(doc: Record<string, unknown> | null) {
  const docWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(doc ? [doc] : []) })
  const docFrom = vi.fn().mockReturnValue({ where: docWhere })
  mocks.mockSelect.mockReturnValueOnce({ from: docFrom })
}

describe('collectStripeEvidenceArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no reports exist', async () => {
    setupReportsQuery([])

    const result = await collectStripeEvidenceArtifacts(baseInput)
    expect(result).toEqual([])
  })

  it('skips reports without documentId', async () => {
    setupReportsQuery([
      { id: 'r1', reportType: 'revenue_summary', startDate: '2025-03-01', endDate: '2025-03-31', documentId: null, sha256: 'abc' },
    ])

    const result = await collectStripeEvidenceArtifacts(baseInput)
    expect(result).toEqual([])
  })

  it('skips reports when document not found', async () => {
    setupReportsQuery([
      { id: 'r1', reportType: 'revenue_summary', startDate: '2025-03-01', endDate: '2025-03-31', documentId: 'doc_1', sha256: 'abc' },
    ])
    setupDocQuery(null)

    const result = await collectStripeEvidenceArtifacts(baseInput)
    expect(result).toEqual([])
  })

  it('collects artifacts from reports with documents', async () => {
    setupReportsQuery([
      { id: 'r1', reportType: 'revenue_summary', startDate: '2025-03-01', endDate: '2025-03-31', documentId: 'doc_1', sha256: 'hash1' },
    ])
    setupDocQuery({
      blobContainer: 'exports',
      blobPath: 'exports/org_1/stripe/report.json',
      contentType: 'application/json',
    })
    mocks.mockDownloadBuffer.mockResolvedValue(Buffer.from('{}'))

    const result = await collectStripeEvidenceArtifacts(baseInput)

    expect(result).toHaveLength(1)
    expect(result[0].artifactType).toBe('stripe-revenue-summary')
    expect(result[0].filename).toBe('stripe-revenue-summary-2025-03.json')
    expect(result[0].retentionClass).toBe('7_YEARS')
    expect(result[0].classification).toBe('INTERNAL')
    expect(result[0].buffer).toBeInstanceOf(Buffer)
    expect(result[0].contentType).toBe('application/json')
  })

  it('handles multiple reports', async () => {
    setupReportsQuery([
      { id: 'r1', reportType: 'revenue_summary', startDate: '2025-03-01', endDate: '2025-03-31', documentId: 'doc_1', sha256: 'h1' },
      { id: 'r2', reportType: 'payout_recon', startDate: '2025-03-01', endDate: '2025-03-31', documentId: 'doc_2', sha256: 'h2' },
    ])
    // doc for report 1
    setupDocQuery({ blobContainer: 'exports', blobPath: 'path1', contentType: 'application/json' })
    // doc for report 2
    setupDocQuery({ blobContainer: 'exports', blobPath: 'path2', contentType: 'application/json' })
    mocks.mockDownloadBuffer.mockResolvedValue(Buffer.from('data'))

    const result = await collectStripeEvidenceArtifacts(baseInput)

    expect(result).toHaveLength(2)
    expect(result[0].artifactType).toBe('stripe-revenue-summary')
    expect(result[1].artifactType).toBe('stripe-payout-recon')
  })
})

describe('buildStripeEvidencePackRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no artifacts are collected', async () => {
    setupReportsQuery([])

    const result = await buildStripeEvidencePackRequest(baseInput)
    expect(result).toBeNull()
  })

  it('builds correct pack request shape', async () => {
    setupReportsQuery([
      { id: 'r1', reportType: 'revenue_summary', startDate: '2025-03-01', endDate: '2025-03-31', documentId: 'doc_1', sha256: 'h1' },
    ])
    setupDocQuery({ blobContainer: 'exports', blobPath: 'path1', contentType: 'application/json' })
    mocks.mockDownloadBuffer.mockResolvedValue(Buffer.from('{}'))

    const result = await buildStripeEvidencePackRequest(baseInput)

    expect(result).not.toBeNull()
    expect(result!.packId).toBe('STRIPE-2025-03')
    expect(result!.orgId).toBe('org_1')
    expect(result!.controlFamily).toBe('integrity')
    expect(result!.eventType).toBe('period-close')
    expect(result!.eventId).toBe('stripe-period-close-2025-03')
    expect(result!.blobContainer).toBe('evidence')
    expect(result!.controlsCovered).toEqual(['INT-06', 'INT-07'])
    expect(result!.createdBy).toBe('user_1')
    expect(result!.summary).toContain('2025-03')
    expect(result!.artifacts).toHaveLength(1)
  })
})

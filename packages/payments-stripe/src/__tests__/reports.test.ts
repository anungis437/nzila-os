import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Chainable mock DB ───────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockInsertValues = vi.fn(() => ({ returning: mockReturning }))
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }))
  const mockSelectWhere = vi.fn()
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }))
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }))
  const mockUploadBuffer = vi.fn()
  return { mockReturning, mockInsertValues, mockInsert, mockSelectWhere, mockSelectFrom, mockSelect, mockUploadBuffer }
})

vi.mock('@nzila/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
  },
}))

vi.mock('@nzila/db/schema', () => ({
  stripePayments: { orgId: 'orgId', occurredAt: 'occurredAt' },
  stripePayouts: { orgId: 'orgId', occurredAt: 'occurredAt' },
  stripeRefunds: { orgId: 'orgId', occurredAt: 'occurredAt' },
  stripeDisputes: { orgId: 'orgId', occurredAt: 'occurredAt' },
  stripeReports: {},
  documents: { id: 'id' },
}))

vi.mock('@nzila/blob', () => ({
  uploadBuffer: mocks.mockUploadBuffer,
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}))

import { buildReportBlobPath, generateStripeReports } from '../reports'

describe('buildReportBlobPath', () => {
  it('builds correct path with year/month extracted from startDate', () => {
    const result = buildReportBlobPath(
      'entity-uuid-123',
      'revenue_summary',
      '2025-03-01',
      'artifact-uuid-456',
    )
    expect(result).toBe(
      'exports/entity-uuid-123/stripe/2025/03/revenue_summary/artifact-uuid-456/report.json',
    )
  })

  it('handles different report types', () => {
    expect(
      buildReportBlobPath('e1', 'payout_recon', '2024-12-01', 'a1'),
    ).toBe('exports/e1/stripe/2024/12/payout_recon/a1/report.json')

    expect(
      buildReportBlobPath('e1', 'refunds_summary', '2025-01-15', 'a2'),
    ).toBe('exports/e1/stripe/2025/01/refunds_summary/a2/report.json')

    expect(
      buildReportBlobPath('e1', 'disputes_summary', '2025-06-01', 'a3'),
    ).toBe('exports/e1/stripe/2025/06/disputes_summary/a3/report.json')
  })

  it('handles single-digit months with leading zero in input', () => {
    const result = buildReportBlobPath('ent', 'revenue_summary', '2025-01-05', 'art')
    expect(result).toContain('/2025/01/')
  })
})

// ── generateStripeReports ───────────────────────────────────────────────────

describe('generateStripeReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: DB select returns empty arrays (no payments/payouts/etc.)
    mocks.mockSelectWhere.mockResolvedValue([])

    // Upload mock
    mocks.mockUploadBuffer.mockResolvedValue({
      blobPath: 'exports/org/stripe/report.json',
      sha256: 'sha256_test',
      sizeBytes: 42,
    })

    // Insert document returning
    mocks.mockReturning.mockResolvedValue([{ id: 'doc_1' }])
    // On second call (stripeReports insert), return report id
    // We need alternating returns: doc insert → report insert, 4 times
    let callCount = 0
    mocks.mockReturning.mockImplementation(() => {
      callCount++
      return Promise.resolve([{ id: callCount % 2 === 1 ? `doc_${callCount}` : `rpt_${callCount}` }])
    })
  })

  it('generates all 4 report types', async () => {
    const artifacts = await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    expect(artifacts).toHaveLength(4)

    const types = artifacts.map((a) => a.reportType)
    expect(types).toContain('revenue_summary')
    expect(types).toContain('payout_recon')
    expect(types).toContain('refunds_summary')
    expect(types).toContain('disputes_summary')
  })

  it('each artifact has required fields', async () => {
    const artifacts = await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    for (const artifact of artifacts) {
      expect(artifact.blobPath).toBeDefined()
      expect(artifact.sha256).toBeDefined()
      expect(artifact.sizeBytes).toBeDefined()
      expect(artifact.documentId).toBeDefined()
      expect(artifact.reportId).toBeDefined()
    }
  })

  it('queries DB 4 times (one per report type)', async () => {
    await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    // 4 select calls for payment/payout/refund/dispute data
    expect(mocks.mockSelect).toHaveBeenCalledTimes(4)
  })

  it('uploads 4 reports to blob storage', async () => {
    await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    expect(mocks.mockUploadBuffer).toHaveBeenCalledTimes(4)
    for (const call of mocks.mockUploadBuffer.mock.calls) {
      expect(call[0].container).toBe('exports')
      expect(call[0].contentType).toBe('application/json')
    }
  })

  it('inserts 8 rows (4 documents + 4 stripeReports)', async () => {
    await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    // 8 insert calls: 4 documents + 4 report rows
    expect(mocks.mockInsert).toHaveBeenCalledTimes(8)
  })

  it('handles payments data in revenue report', async () => {
    mocks.mockSelectWhere
      .mockResolvedValueOnce([
        {
          id: 'p1',
          stripeObjectId: 'pi_1',
          objectType: 'payment_intent',
          status: 'succeeded',
          amountCents: BigInt(5000),
          currency: 'CAD',
          ventureId: null,
          occurredAt: new Date('2025-03-15'),
        },
      ])
      .mockResolvedValue([])

    const artifacts = await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    expect(artifacts).toHaveLength(4)
    // Verify that the uploaded buffer includes the payment data
    const firstUploadCall = mocks.mockUploadBuffer.mock.calls[0][0]
    const uploaded = JSON.parse(firstUploadCall.buffer.toString())
    expect(uploaded.reportType).toBe('revenue_summary')
    expect(uploaded.summary.totalPayments).toBe(1)
    expect(uploaded.summary.totalAmountCents).toBe(5000)
  })

  it('passes periodId when provided', async () => {
    await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      periodId: 'period_123',
      actorClerkUserId: 'user_1',
    })

    // Check that insert was called for stripeReports with periodId
    const insertCalls = mocks.mockInsertValues.mock.calls
    // At least one call should include periodId
    const hasperiodId = insertCalls.some(
      (call) => call[0] && (call[0] as Record<string, unknown>).periodId === 'period_123',
    )
    expect(hasperiodId).toBe(true)
  })

  it('generates payout_recon report with detail mapping', async () => {
    mocks.mockSelectWhere
      .mockResolvedValueOnce([]) // payments (revenue)
      .mockResolvedValueOnce([  // payouts
        {
          id: 'po_db_1',
          payoutId: 'po_1',
          amountCents: BigInt(15000),
          currency: 'CAD',
          status: 'paid',
          arrivalDate: '2025-03-16',
          occurredAt: new Date('2025-03-15'),
        },
      ])
      .mockResolvedValueOnce([]) // refunds
      .mockResolvedValueOnce([]) // disputes

    const artifacts = await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    expect(artifacts).toHaveLength(4)
    // Verify payout_recon report has details
    const payoutUpload = mocks.mockUploadBuffer.mock.calls[1][0]
    const report = JSON.parse(payoutUpload.buffer.toString())
    expect(report.reportType).toBe('payout_recon')
    expect(report.summary.totalPayouts).toBe(1)
    expect(report.summary.totalAmountCents).toBe(15000)
    expect(report.details).toHaveLength(1)
    expect(report.details[0].payoutId).toBe('po_1')
  })

  it('generates refunds_summary report with detail mapping', async () => {
    mocks.mockSelectWhere
      .mockResolvedValueOnce([]) // payments
      .mockResolvedValueOnce([]) // payouts
      .mockResolvedValueOnce([  // refunds
        {
          id: 'ref_db_1',
          refundId: 're_1',
          amountCents: 2000,
          status: 'succeeded',
          requestedBy: 'user_a',
          approvedBy: 'user_b',
          occurredAt: new Date('2025-03-10'),
        },
      ])
      .mockResolvedValueOnce([]) // disputes

    const artifacts = await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    expect(artifacts).toHaveLength(4)
    const refundUpload = mocks.mockUploadBuffer.mock.calls[2][0]
    const report = JSON.parse(refundUpload.buffer.toString())
    expect(report.reportType).toBe('refunds_summary')
    expect(report.summary.totalRefunds).toBe(1)
    expect(report.details).toHaveLength(1)
    expect(report.details[0].refundId).toBe('re_1')
  })

  it('generates disputes_summary report with detail mapping', async () => {
    mocks.mockSelectWhere
      .mockResolvedValueOnce([]) // payments
      .mockResolvedValueOnce([]) // payouts
      .mockResolvedValueOnce([]) // refunds
      .mockResolvedValueOnce([  // disputes
        {
          id: 'disp_db_1',
          disputeId: 'dp_1',
          amountCents: 4000,
          status: 'needs_response',
          reason: 'fraudulent',
          dueBy: new Date('2025-04-01'),
          occurredAt: new Date('2025-03-20'),
        },
      ])

    const artifacts = await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    expect(artifacts).toHaveLength(4)
    const disputeUpload = mocks.mockUploadBuffer.mock.calls[3][0]
    const report = JSON.parse(disputeUpload.buffer.toString())
    expect(report.reportType).toBe('disputes_summary')
    expect(report.summary.totalDisputes).toBe(1)
    expect(report.details).toHaveLength(1)
    expect(report.details[0].disputeId).toBe('dp_1')
    expect(report.details[0].reason).toBe('fraudulent')
    expect(report.details[0].dueBy).toBe('2025-04-01T00:00:00.000Z')
  })

  it('handles dispute with null dueBy in detail mapping', async () => {
    mocks.mockSelectWhere
      .mockResolvedValueOnce([]) // payments
      .mockResolvedValueOnce([]) // payouts
      .mockResolvedValueOnce([]) // refunds
      .mockResolvedValueOnce([  // disputes
        {
          id: 'disp_db_2',
          disputeId: 'dp_2',
          amountCents: 1000,
          status: 'won',
          reason: null,
          dueBy: null,
          occurredAt: new Date('2025-03-25'),
        },
      ])

    const artifacts = await generateStripeReports({
      orgId: 'org_1',
      startDate: '2025-03-01',
      endDate: '2025-03-31',
      actorClerkUserId: 'user_1',
    })

    const disputeUpload = mocks.mockUploadBuffer.mock.calls[3][0]
    const report = JSON.parse(disputeUpload.buffer.toString())
    expect(report.details[0].dueBy).toBeNull()
    expect(report.details[0].reason).toBeNull()
  })
})

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockNotFound,
  mockQuoteFindById,
  mockCustomerFindById,
  mockAnalyzeProfitability,
  mockGetAvailableTransitions,
  mockApprovalFindByQuoteId,
  mockRevisionFindByQuoteId,
  mockTimelineFindByQuoteId,
  mockPaymentRequirementFindByQuoteId,
  mockPaymentStatusFindByQuoteId,
  mockFindShareLinksForQuote,
  mockPredictConversion,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  mockQuoteFindById: vi.fn(),
  mockCustomerFindById: vi.fn(),
  mockAnalyzeProfitability: vi.fn(),
  mockGetAvailableTransitions: vi.fn(),
  mockApprovalFindByQuoteId: vi.fn(),
  mockRevisionFindByQuoteId: vi.fn(),
  mockTimelineFindByQuoteId: vi.fn(),
  mockPaymentRequirementFindByQuoteId: vi.fn(),
  mockPaymentStatusFindByQuoteId: vi.fn(),
  mockFindShareLinksForQuote: vi.fn(),
  mockPredictConversion: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getLocale: mockGetLocale,
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/lib/db', () => ({
  quoteRepo: { findById: mockQuoteFindById },
  customerRepo: { findById: mockCustomerFindById },
}))

vi.mock('@/app/actions/profitability', () => ({
  analyzeQuoteProfitabilityAction: mockAnalyzeProfitability,
}))

vi.mock('@/lib/workflows/quote-state-machine', () => ({
  getAvailableQuoteTransitions: mockGetAvailableTransitions,
}))

vi.mock('@/lib/repositories/workflow-repository', () => ({
  approvalRepo: { findByQuoteId: mockApprovalFindByQuoteId },
  revisionRepo: { findByQuoteId: mockRevisionFindByQuoteId },
  timelineRepo: { findByQuoteId: mockTimelineFindByQuoteId },
  paymentRequirementRepo: { findByQuoteId: mockPaymentRequirementFindByQuoteId },
  paymentStatusRepo: { findByQuoteId: mockPaymentStatusFindByQuoteId },
}))

vi.mock('@/lib/services/share-link-service', () => ({
  findShareLinksForQuote: mockFindShareLinksForQuote,
}))

vi.mock('@/lib/ai-actions', () => ({
  predictConversion: mockPredictConversion,
}))

vi.mock('@/app/(dashboard)/quotes/[id]/quote-detail-actions', () => ({
  QuoteDetailActions: ({ quoteId, status }: { quoteId: string; status: string }) =>
    React.createElement('div', { 'data-testid': 'quote-detail-actions' }, `${quoteId}:${status}`),
}))

vi.mock('@/app/(dashboard)/components', () => ({
  StatusBadge: ({ status }: { status: string }) =>
    React.createElement('span', { 'data-testid': 'status-badge' }, status),
  LifecycleTimeline: ({ events }: { events: Array<{ label: string }> }) =>
    React.createElement('div', { 'data-testid': 'timeline' }, String(events.length)),
  SystemGuidance: ({ severity, children }: { severity: string; children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': `guidance-${severity}` }, children),
  ProgressStepper: ({ currentIndex }: { currentIndex: number }) =>
    React.createElement('div', { 'data-testid': 'stepper' }, String(currentIndex)),
}))

describe('quote detail page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockQuoteFindById.mockResolvedValue({
      id: 'q-1',
      reference: 'Q-001',
      title: 'Enterprise Proposal',
      status: 'accepted',
      customerId: 'c-1',
      tier: 'enterprise',
      boxCount: 25,
      theme: 'modern',
      validUntilDays: 30,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdBy: 'owner',
      notes: 'Important quote notes',
      subtotal: 1200,
      gst: 60,
      qst: 119.7,
      total: 1379.7,
      lines: [
        { id: 'l-1', description: 'Premium Box', sku: 'PB-1', quantity: 2, unitCost: 200 },
        { id: 'l-2', description: 'Standard Box', sku: 'SB-1', quantity: 1, unitCost: 100 },
      ],
    })
    mockCustomerFindById.mockResolvedValue({ id: 'c-1', name: 'Acme Co', email: 'acme@example.com', phone: '555-0101' })
    mockApprovalFindByQuoteId.mockResolvedValue([
      {
        id: 'a-1',
        action: 'ACCEPT',
        customerName: 'Jane Doe',
        message: 'Looks good',
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ])
    mockRevisionFindByQuoteId.mockResolvedValue([
      {
        id: 'r-open',
        status: 'OPEN',
        requestedBy: 'John Smith',
        requestMessage: 'Change colors',
        createdAt: new Date('2026-06-03T00:00:00.000Z'),
      },
    ])
    mockTimelineFindByQuoteId.mockResolvedValue([
      {
        event: 'SENT_TO_CLIENT',
        description: 'Sent to client',
        timestamp: new Date('2026-06-02T00:00:00.000Z'),
        actor: 'owner',
      },
    ])
    mockPaymentRequirementFindByQuoteId.mockResolvedValue({
      depositRequired: true,
      depositPercent: 50,
      depositAmount: 500,
    })
    mockPaymentStatusFindByQuoteId.mockResolvedValue({
      status: 'PARTIAL',
      amountDue: 500,
      amountPaid: 250,
    })
    mockFindShareLinksForQuote.mockResolvedValue([])
    mockGetAvailableTransitions.mockReturnValue([{ from: 'ACCEPTED', to: 'DEPOSIT_REQUIRED', label: 'Require deposit' }])
    mockPredictConversion.mockResolvedValue({
      probability: 0.73,
      factors: [
        { name: 'Client engagement', impact: 'positive', weight: 0.4 },
        { name: 'Timeline pressure', impact: 'negative', weight: 0.2 },
      ],
      recommendation: 'Follow up this week',
    })
    mockAnalyzeProfitability.mockResolvedValue({
      ok: true,
      profitability: {
        overallStatus: 'healthy',
        totalMarginPercent: 25,
        totalMarginDollars: 300,
        totalRevenue: 1200,
        totalCost: 900,
        alerts: [{ severity: 'warning', message: 'Tight margin on shipping' }],
      },
    })
  })

  it('renders full quote detail with client/workflow/ai/payment/profitability blocks', async () => {
    const { default: QuoteDetailPage } = await import('@/app/(dashboard)/quotes/[id]/page')
    const markup = renderToStaticMarkup(await QuoteDetailPage({ params: Promise.resolve({ id: 'q-1' }) }))

    expect(markup).toContain('Back to Quotes')
    expect(markup).toContain('Q-001')
    expect(markup).toContain('Enterprise Proposal')
    expect(markup).toContain('Acme Co')
    expect(markup).toContain('Premium Box')
    expect(markup).toContain('Standard Box')
    expect(markup).toContain('Profitability')
    expect(markup).toContain('AI Conversion Score')
    expect(markup).toContain('Payment')
    expect(markup).toContain('Client Responses')
    expect(markup).toContain('Open Revisions')
    expect(markup).toContain('Timeline')
    expect(markup).toContain('Require deposit')
    expect(markup).toContain('Follow up this week')
  })

  it('renders fallback/empty paths and no transitions when optional data is absent', async () => {
    mockQuoteFindById.mockResolvedValueOnce({
      id: 'q-2',
      reference: 'Q-002',
      title: 'Minimal Quote',
      status: 'draft',
      customerId: null,
      tier: 'starter',
      boxCount: 1,
      theme: null,
      validUntilDays: 7,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdBy: null,
      notes: '',
      subtotal: 100,
      gst: 5,
      qst: 9.98,
      total: 114.98,
      lines: [{ id: 'l-min', description: 'Sample', sku: 'S-1', quantity: 1, unitCost: 100 }],
    })
    mockGetAvailableTransitions.mockReturnValueOnce([])
    mockApprovalFindByQuoteId.mockResolvedValueOnce([])
    mockRevisionFindByQuoteId.mockResolvedValueOnce([])
    mockTimelineFindByQuoteId.mockResolvedValueOnce([])
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce(null)
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce(null)
    mockPredictConversion.mockRejectedValueOnce(new Error('AI unavailable'))
    mockAnalyzeProfitability.mockResolvedValueOnce({ ok: false, error: 'No profitability data' })

    const { default: QuoteDetailPage } = await import('@/app/(dashboard)/quotes/[id]/page')
    const markup = renderToStaticMarkup(await QuoteDetailPage({ params: Promise.resolve({ id: 'q-2' }) }))

    expect(markup).toContain('Q-002')
    expect(markup).toContain('Minimal Quote')
    expect(markup).toContain('No transitions available')
    expect(markup).not.toContain('AI Conversion Score')
    expect(markup).not.toContain('Profitability')
    expect(markup).not.toContain('Client Responses')
    expect(markup).not.toContain('Open Revisions')
  })

  it('covers remaining quote-detail edge branches for status/payment/ai/profitability variants', async () => {
    const { default: QuoteDetailPage } = await import('@/app/(dashboard)/quotes/[id]/page')

    mockQuoteFindById.mockResolvedValueOnce({
      id: 'q-3',
      reference: 'Q-003',
      title: 'Edge Quote',
      status: null,
      customerId: 'c-1',
      tier: 'edge',
      boxCount: 2,
      theme: null,
      validUntilDays: 5,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdBy: null,
      notes: null,
      subtotal: 200,
      gst: 10,
      qst: 19.95,
      total: 229.95,
      lines: [{ id: 'l-edge', description: 'Edge line', sku: 'E-1', quantity: 1, unitCost: 200 }],
    })
    mockTimelineFindByQuoteId.mockResolvedValueOnce([
      {
        event: 'DRAFT',
        description: 'Created in draft',
        timestamp: new Date('2026-06-01T00:00:00.000Z'),
        actor: null,
      },
    ])
    mockApprovalFindByQuoteId.mockResolvedValueOnce([
      {
        id: 'a-rev',
        action: 'REVISION',
        customerName: 'Reviewer',
        message: '',
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ])
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({
      depositRequired: false,
      depositPercent: null,
      depositAmount: null,
    })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({
      status: 'OVERDUE',
      amountDue: 0,
      amountPaid: 50,
    })
    mockPredictConversion.mockResolvedValueOnce({
      probability: 0.5,
      factors: [{ name: 'Neutral', impact: 'negative', weight: 0.5 }],
      recommendation: 'Review quote details',
    })
    mockAnalyzeProfitability.mockResolvedValueOnce({
      ok: true,
      profitability: {
        overallStatus: 'critical',
        totalMarginPercent: 2,
        totalMarginDollars: 5,
        totalRevenue: 200,
        totalCost: 195,
        alerts: [{ severity: 'critical', message: 'Critical margin threshold' }],
      },
    })

    const criticalMarkup = renderToStaticMarkup(await QuoteDetailPage({ params: Promise.resolve({ id: 'q-3' }) }))
    expect(criticalMarkup).toContain('Revision Requested')
    expect(criticalMarkup).toContain('OVERDUE')
    expect(criticalMarkup).toContain('Critical margin threshold')
    expect(criticalMarkup).toContain('Review quote details')

    mockQuoteFindById.mockResolvedValueOnce({
      id: 'q-4',
      reference: 'Q-004',
      title: 'Warning Quote',
      status: 'unknown_status',
      customerId: 'c-1',
      tier: 'warning',
      boxCount: 2,
      theme: null,
      validUntilDays: 5,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdBy: 'owner',
      notes: null,
      subtotal: 200,
      gst: 10,
      qst: 19.95,
      total: 229.95,
      lines: [{ id: 'l-warn', description: 'Warn line', sku: 'W-1', quantity: 1, unitCost: 200 }],
    })
    mockTimelineFindByQuoteId.mockResolvedValueOnce([])
    mockApprovalFindByQuoteId.mockResolvedValueOnce([])
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce({
      depositRequired: true,
      depositPercent: 10,
      depositAmount: 20,
    })
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce({
      status: 'PAID',
      amountDue: 100,
      amountPaid: 100,
    })
    mockPredictConversion.mockResolvedValueOnce({
      probability: 0.2,
      factors: [{ name: 'Low intent', impact: 'negative', weight: 0.9 }],
      recommendation: 'Escalate outreach',
    })
    mockAnalyzeProfitability.mockResolvedValueOnce({
      ok: true,
      profitability: {
        overallStatus: 'warning',
        totalMarginPercent: 8,
        totalMarginDollars: 16,
        totalRevenue: 200,
        totalCost: 184,
        alerts: [{ severity: 'warning', message: 'Margin warning' }],
      },
    })

    const warningMarkup = renderToStaticMarkup(await QuoteDetailPage({ params: Promise.resolve({ id: 'q-4' }) }))
    expect(warningMarkup).toContain('PAID')
    expect(warningMarkup).toContain('Margin warning')

    mockQuoteFindById.mockResolvedValueOnce({
      id: 'q-5',
      reference: 'Q-005',
      title: 'Loss Quote',
      status: 'accepted',
      customerId: 'c-1',
      tier: 'loss',
      boxCount: 2,
      theme: null,
      validUntilDays: 5,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      createdBy: 'owner',
      notes: null,
      subtotal: 200,
      gst: 10,
      qst: 19.95,
      total: 229.95,
      lines: [{ id: 'l-loss', description: 'Loss line', sku: 'L-1', quantity: 1, unitCost: 200 }],
    })
    mockTimelineFindByQuoteId.mockResolvedValueOnce([])
    mockApprovalFindByQuoteId.mockResolvedValueOnce([])
    mockPaymentRequirementFindByQuoteId.mockResolvedValueOnce(null)
    mockPaymentStatusFindByQuoteId.mockResolvedValueOnce(null)
    mockPredictConversion.mockResolvedValueOnce({
      probability: 0.85,
      factors: [{ name: 'High confidence', impact: 'positive', weight: 0.8 }],
      recommendation: 'Proceed',
    })
    mockAnalyzeProfitability.mockResolvedValueOnce({
      ok: true,
      profitability: {
        overallStatus: 'loss',
        totalMarginPercent: -10,
        totalMarginDollars: -20,
        totalRevenue: 200,
        totalCost: 220,
        alerts: [],
      },
    })

    const lossMarkup = renderToStaticMarkup(await QuoteDetailPage({ params: Promise.resolve({ id: 'q-5' }) }))
    expect(lossMarkup).toContain('Profitability')
    expect(lossMarkup).toContain('-10.0%')
  })

  it('calls notFound when quote is missing', async () => {
    mockQuoteFindById.mockResolvedValueOnce(null)

    const { default: QuoteDetailPage } = await import('@/app/(dashboard)/quotes/[id]/page')
    await expect(QuoteDetailPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })
})

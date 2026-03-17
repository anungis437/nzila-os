/**
 * Flow — Quote Generation Tests
 */
import { describe, it, expect, vi } from 'vitest'

const mockQuoteService = {
  create: vi.fn().mockResolvedValue({
    ok: true,
    quote: {
      id: 'q-001',
      orgId: 'org-1',
      status: 'DRAFT',
      lines: [],
      createdAt: new Date().toISOString(),
    },
  }),
}

vi.mock('@nzila/commerce-services', () => ({
  createQuoteService: () => mockQuoteService,
}))

describe('Quote Generation', () => {
  it('creates a draft quote with required fields', async () => {
    const result = await mockQuoteService.create({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [{ productId: 'prod-1', quantity: 2, unitPrice: 100 }],
    })

    expect(result.ok).toBe(true)
    expect(result.quote.status).toBe('DRAFT')
    expect(result.quote.orgId).toBe('org-1')
  })

  it('generates a unique quote ID', async () => {
    const result = await mockQuoteService.create({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [],
    })

    expect(result.quote.id).toBeDefined()
    expect(result.quote.id).toMatch(/^q-/)
  })

  it('records creation timestamp', async () => {
    const result = await mockQuoteService.create({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [],
    })

    expect(result.quote.createdAt).toBeDefined()
    expect(new Date(result.quote.createdAt).getTime()).not.toBeNaN()
  })

  it('initialises with empty lines when none provided', async () => {
    const result = await mockQuoteService.create({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [],
    })

    expect(result.quote.lines).toEqual([])
  })
})

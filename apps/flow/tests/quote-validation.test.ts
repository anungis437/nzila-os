/**
 * Flow — Quote Validation Tests
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const quoteLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  description: z.string().optional(),
})

const createQuoteSchema = z.object({
  orgId: z.string().min(1),
  customerId: z.string().min(1),
  lines: z.array(quoteLineSchema).min(0),
  currency: z.enum(['CAD', 'USD']).default('CAD'),
  notes: z.string().max(1000).optional(),
})

describe('Quote Validation', () => {
  it('accepts valid quote input', () => {
    const input = {
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [{ productId: 'prod-1', quantity: 2, unitPrice: 49.99 }],
    }

    const result = createQuoteSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects missing orgId', () => {
    const result = createQuoteSchema.safeParse({
      customerId: 'cust-1',
      lines: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = createQuoteSchema.safeParse({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [{ productId: 'prod-1', quantity: -1, unitPrice: 10 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative unit price', () => {
    const result = createQuoteSchema.safeParse({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [{ productId: 'prod-1', quantity: 1, unitPrice: -5 }],
    })
    expect(result.success).toBe(false)
  })

  it('enforces notes max length', () => {
    const result = createQuoteSchema.safeParse({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [],
      notes: 'x'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it('defaults currency to CAD', () => {
    const result = createQuoteSchema.parse({
      orgId: 'org-1',
      customerId: 'cust-1',
      lines: [],
    })
    expect(result.currency).toBe('CAD')
  })
})

/**
 * Flow — Export Service Tests
 */
import { describe, it, expect } from 'vitest'

interface QuoteExport {
  id: string
  orgId: string
  status: string
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>
  subtotal: number
  taxes: { gst: number; qst: number }
  total: number
  exportedAt: string
  format: 'json' | 'csv' | 'pdf'
}

function exportQuoteToJSON(quote: Omit<QuoteExport, 'exportedAt' | 'format'>): QuoteExport {
  return {
    ...quote,
    exportedAt: new Date().toISOString(),
    format: 'json',
  }
}

function exportQuoteToCSV(quote: Omit<QuoteExport, 'exportedAt' | 'format'>): string {
  const header = 'productId,quantity,unitPrice'
  const rows = quote.lines.map(l => `${l.productId},${l.quantity},${l.unitPrice}`)
  return [header, ...rows].join('\n')
}

describe('Export Service', () => {
  const sampleQuote = {
    id: 'q-001',
    orgId: 'org-1',
    status: 'ACCEPTED',
    lines: [
      { productId: 'prod-1', quantity: 2, unitPrice: 100 },
      { productId: 'prod-2', quantity: 1, unitPrice: 50 },
    ],
    subtotal: 250,
    taxes: { gst: 12.5, qst: 24.94 },
    total: 287.44,
  }

  it('exports quote as JSON with timestamp', () => {
    const result = exportQuoteToJSON(sampleQuote)
    expect(result.format).toBe('json')
    expect(result.exportedAt).toBeDefined()
    expect(result.id).toBe('q-001')
  })

  it('exports quote as CSV with header row', () => {
    const csv = exportQuoteToCSV(sampleQuote)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('productId,quantity,unitPrice')
    expect(lines).toHaveLength(3) // header + 2 data rows
  })

  it('preserves all line data in CSV', () => {
    const csv = exportQuoteToCSV(sampleQuote)
    expect(csv).toContain('prod-1,2,100')
    expect(csv).toContain('prod-2,1,50')
  })

  it('includes tax breakdown in JSON export', () => {
    const result = exportQuoteToJSON(sampleQuote)
    expect(result.taxes.gst).toBe(12.5)
    expect(result.taxes.qst).toBe(24.94)
  })
})

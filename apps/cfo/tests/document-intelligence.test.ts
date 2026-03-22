/**
 * Tests — Document Intelligence
 *
 * Pure-function tests for document classification, field extraction,
 * normalization, and validation logic. Does NOT test HTTP calls (Azure/AWS).
 */
import { describe, it, expect } from 'vitest'
import {
  classifyDocument,
  normalizeExtraction,
  validateExtraction,
  type ExtractionResult,
  type DocumentType,
} from '@/lib/document-intelligence'

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function buildResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    documentId: 'doc-001',
    documentType: 'invoice',
    provider: 'azure',
    confidence: 0.95,
    fields: [
      { name: 'VendorName', value: 'SupplierCo', confidence: 0.97 },
      { name: 'InvoiceDate', value: '2026-01-15', confidence: 0.95 },
      { name: 'InvoiceTotal', value: '1150.00', confidence: 0.92 },
      { name: 'TotalTax', value: '150.00', confidence: 0.91 },
      { name: 'InvoiceId', value: 'INV-2026-001', confidence: 0.98 },
    ],
    lineItems: [
      {
        description: 'Consulting services',
        quantity: 10,
        unitPrice: 100,
        totalAmount: 1000,
        taxAmount: 150,
        confidence: 0.93,
      },
    ],
    rawText: 'Invoice from SupplierCo...',
    pageCount: 1,
    processedAt: new Date().toISOString(),
    processingTimeMs: 2340,
    ...overrides,
  }
}

/* ── 1. Document Classification ──────────────────────────────────────────── */

describe('classifyDocument', () => {
  const cases: [string, string, DocumentType][] = [
    ['receipt-2026-01-15.pdf', 'application/pdf', 'receipt'],
    ['RCPT_starbucks.jpg', 'image/jpeg', 'receipt'],
    ['invoice-acme-001.pdf', 'application/pdf', 'invoice'],
    ['INV_2026_Q1.pdf', 'application/pdf', 'invoice'],
    ['bank-statement-jan.pdf', 'application/pdf', 'bank_statement'],
    ['stmt_2026.csv', 'text/csv', 'bank_statement'],
    ['t4-2025.pdf', 'application/pdf', 'tax_form'],
    ['t2-corporate-2025.pdf', 'application/pdf', 'tax_form'],
    ['1099-misc.pdf', 'application/pdf', 'tax_form'],
    ['w-2-2025.pdf', 'application/pdf', 'tax_form'],
    ['contract-engagement.pdf', 'application/pdf', 'contract'],
    ['service-agreement.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'contract'],
    ['po-12345.pdf', 'application/pdf', 'purchase_order'],
    ['purchase-order.pdf', 'application/pdf', 'purchase_order'],
    ['expense-report-march.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'expense_report'],
    ['payslip-march-2026.pdf', 'application/pdf', 'payslip'],
    ['paystub_2026_03.pdf', 'application/pdf', 'payslip'],
  ]

  for (const [filename, mime, expected] of cases) {
    it(`classifies "${filename}" as ${expected}`, () => {
      const result = classifyDocument(filename, mime)
      expect(result.documentType).toBe(expected)
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.suggestedTypes.length).toBeGreaterThan(0)
    })
  }

  it('defaults image to receipt with low confidence', () => {
    const result = classifyDocument('img_20260315.png', 'image/png')
    expect(result.documentType).toBe('receipt')
    expect(result.confidence).toBe(0.5)
  })

  it('defaults non-image to invoice with low confidence', () => {
    const result = classifyDocument('document.pdf', 'application/pdf')
    expect(result.documentType).toBe('invoice')
    expect(result.confidence).toBe(0.4)
  })

  it('sorts suggestions by confidence descending', () => {
    const result = classifyDocument('invoice-receipt.pdf', 'application/pdf')
    for (let i = 1; i < result.suggestedTypes.length; i++) {
      expect(result.suggestedTypes[i - 1].confidence).toBeGreaterThanOrEqual(
        result.suggestedTypes[i].confidence,
      )
    }
  })

  it('tax forms have highest confidence (0.95)', () => {
    const result = classifyDocument('t4-summary.pdf', 'application/pdf')
    expect(result.confidence).toBe(0.95)
  })
})

/* ── 2. Normalize extraction ─────────────────────────────────────────────── */

describe('normalizeExtraction', () => {
  it('extracts supplier from VendorName field', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.supplier).toBe('SupplierCo')
  })

  it('extracts date from InvoiceDate field', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.date).toBe('2026-01-15')
  })

  it('calculates subtotal correctly', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.subtotal).toBe(1000) // 1150 - 150
  })

  it('extracts tax amount', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.taxAmount).toBe(150)
  })

  it('extracts total amount', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.totalAmount).toBe(1150)
  })

  it('extracts reference from InvoiceId', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.reference).toBe('INV-2026-001')
  })

  it('preserves line items', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.lineItems).toHaveLength(1)
    expect(normalized.lineItems[0].description).toBe('Consulting services')
  })

  it('defaults currency to CAD', () => {
    const normalized = normalizeExtraction(buildResult())
    expect(normalized.currency).toBe('CAD')
  })

  it('defaults supplier to Unknown when field missing', () => {
    const result = buildResult({ fields: [] })
    const normalized = normalizeExtraction(result)
    expect(normalized.supplier).toBe('Unknown')
  })

  it('falls back to MerchantName for receipts', () => {
    const result = buildResult({
      documentType: 'receipt',
      fields: [
        { name: 'MerchantName', value: 'Starbucks', confidence: 0.9 },
        { name: 'Total', value: '5.75', confidence: 0.95 },
      ],
    })
    const normalized = normalizeExtraction(result)
    expect(normalized.supplier).toBe('Starbucks')
  })

  it('handles TransactionDate for receipts', () => {
    const result = buildResult({
      fields: [
        { name: 'TransactionDate', value: '2026-03-15', confidence: 0.88 },
        { name: 'Total', value: '42.00', confidence: 0.95 },
      ],
    })
    const normalized = normalizeExtraction(result)
    expect(normalized.date).toBe('2026-03-15')
  })
})

/* ── 3. Extraction validation ────────────────────────────────────────────── */

describe('validateExtraction', () => {
  it('returns no issues for high-confidence complete result', () => {
    const issues = validateExtraction(buildResult())
    expect(issues).toEqual([])
  })

  it('warns when overall confidence below threshold', () => {
    const result = buildResult({ confidence: 0.5 })
    const issues = validateExtraction(result)
    const overall = issues.find((i) => i.field === 'overall')
    expect(overall).toBeDefined()
    expect(overall!.severity).toBe('warning')
    expect(overall!.issue).toContain('50.0%')
  })

  it('flags low-confidence fields', () => {
    const result = buildResult({
      fields: [
        { name: 'VendorName', value: 'Maybe Corp', confidence: 0.3 },
        { name: 'InvoiceDate', value: '2026-01-15', confidence: 0.95 },
        { name: 'Total', value: '100', confidence: 0.95 },
      ],
    })
    const issues = validateExtraction(result)
    const vendor = issues.find((i) => i.field === 'VendorName')
    expect(vendor).toBeDefined()
    expect(vendor!.severity).toBe('error') // < 0.5 → error
  })

  it('marks confidence 0.5-0.8 as warning, <0.5 as error', () => {
    const result = buildResult({
      fields: [
        { name: 'VendorName', value: 'X', confidence: 0.6 },
        { name: 'Date', value: '2026', confidence: 0.3 },
        { name: 'Total', value: '100', confidence: 0.95 },
      ],
    })
    const issues = validateExtraction(result)
    const vendorIssue = issues.find((i) => i.field === 'VendorName')
    const dateIssue = issues.find((i) => i.field === 'Date')
    expect(vendorIssue!.severity).toBe('warning')
    expect(dateIssue!.severity).toBe('error')
  })

  it('reports missing required fields', () => {
    const result = buildResult({ fields: [] })
    const issues = validateExtraction(result)
    const missing = issues.filter((i) => i.issue.includes('Required field'))
    expect(missing.length).toBeGreaterThanOrEqual(3) // Total, Date, VendorName
  })

  it('does not flag present required fields', () => {
    const result = buildResult({
      fields: [
        { name: 'Total', value: '100', confidence: 0.95 },
        { name: 'InvoiceDate', value: '2026-01-15', confidence: 0.95 },
        { name: 'VendorName', value: 'Acme', confidence: 0.95 },
      ],
    })
    const issues = validateExtraction(result)
    const missing = issues.filter((i) => i.issue.includes('Required field'))
    expect(missing).toHaveLength(0)
  })
})

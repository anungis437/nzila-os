/**
 * Flow — Price Calculation Tests
 */
import { describe, it, expect } from 'vitest'

const GST_RATE = 0.05
const QST_RATE = 0.09975

function calculateQuebecTaxes(subtotal: number) {
  const gst = Math.round(subtotal * GST_RATE * 100) / 100
  const qst = Math.round(subtotal * QST_RATE * 100) / 100
  return { gst, qst, total: Math.round((subtotal + gst + qst) * 100) / 100 }
}

function calculateLineTotal(quantity: number, unitPrice: number, discountPct = 0): number {
  const gross = quantity * unitPrice
  const discount = Math.round(gross * (discountPct / 100) * 100) / 100
  return Math.round((gross - discount) * 100) / 100
}

function calculateQuoteSubtotal(lines: Array<{ quantity: number; unitPrice: number; discountPct?: number }>): number {
  return lines.reduce((sum, l) => sum + calculateLineTotal(l.quantity, l.unitPrice, l.discountPct), 0)
}

describe('Price Calculation', () => {
  it('calculates line total without discount', () => {
    expect(calculateLineTotal(3, 100)).toBe(300)
  })

  it('calculates line total with discount', () => {
    expect(calculateLineTotal(2, 100, 10)).toBe(180)
  })

  it('calculates Quebec GST', () => {
    const { gst } = calculateQuebecTaxes(1000)
    expect(gst).toBe(50)
  })

  it('calculates Quebec QST', () => {
    const { qst } = calculateQuebecTaxes(1000)
    expect(qst).toBe(99.75)
  })

  it('calculates total with taxes', () => {
    const { total } = calculateQuebecTaxes(1000)
    expect(total).toBe(1149.75)
  })

  it('handles zero subtotal', () => {
    const { gst, qst, total } = calculateQuebecTaxes(0)
    expect(gst).toBe(0)
    expect(qst).toBe(0)
    expect(total).toBe(0)
  })

  it('calculates multi-line subtotal', () => {
    const lines = [
      { quantity: 2, unitPrice: 50 },
      { quantity: 1, unitPrice: 200 },
    ]
    expect(calculateQuoteSubtotal(lines)).toBe(300)
  })

  it('handles fractional cents correctly', () => {
    // 3 * 33.33 = 99.99
    expect(calculateLineTotal(3, 33.33)).toBe(99.99)
  })
})

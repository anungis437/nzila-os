/**
 * CFO — BI Connector Tests
 *
 * Tests for the BI push connector schemas.
 */
import { describe, it, expect } from 'vitest'
import { CFO_BI_TABLES, type BIProvider } from '../lib/bi-connector'

// ── BI Table Schema ─────────────────────────────────────────────────────────

describe('BI Connector Schema', () => {
  it('defines 6 standard financial tables', () => {
    expect(CFO_BI_TABLES.length).toBe(6)
  })

  it('includes required table names', () => {
    const names = CFO_BI_TABLES.map((t) => t.name)
    expect(names).toContain('TrialBalance')
    expect(names).toContain('ProfitAndLoss')
    expect(names).toContain('BalanceSheet')
    expect(names).toContain('KPIs')
  })

  it('every table has typed columns', () => {
    for (const table of CFO_BI_TABLES) {
      expect(table.columns.length).toBeGreaterThan(0)
      for (const col of table.columns) {
        expect(col.name).toBeTruthy()
        expect(['string', 'number', 'date', 'boolean', 'decimal']).toContain(col.dataType)
      }
    }
  })

  it('TrialBalance has account and amount columns', () => {
    const tb = CFO_BI_TABLES.find((t) => t.name === 'TrialBalance')!
    const colNames = tb.columns.map((c) => c.name)
    expect(colNames).toContain('AccountCode')
    expect(colNames).toContain('Debit')
    expect(colNames).toContain('Credit')
  })
})

// ── BI Provider Types ───────────────────────────────────────────────────────

describe('BI Provider types', () => {
  it('accepts valid providers', () => {
    const providers: BIProvider[] = ['powerbi', 'tableau', 'metabase', 'odata']
    expect(providers).toHaveLength(4)
  })
})

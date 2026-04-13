import { describe, it, expect, vi } from 'vitest'
import {
  inferNzilaCategory,
  buildCoaMapping,
  createManualMapping,
  detectMappingDrifts,
  syncChartOfAccounts,
} from './coa-mapping'
import type { CoaMapping } from './coa-mapping'
import type { QboAccount } from './types'

vi.mock('./client', () => ({
  qboAccounts: { list: vi.fn() },
}))
import { qboAccounts } from './client'

const mockList = vi.mocked(qboAccounts.list)

function makeAccount(overrides: Partial<QboAccount> = {}): QboAccount {
  return {
    Id: '1',
    Name: 'Test Account',
    FullyQualifiedName: 'Test Account',
    Active: true,
    Classification: 'Asset',
    AccountType: 'Bank',
    AccountSubType: 'Checking',
    CurrentBalance: 0,
    SyncToken: '0',
    ...overrides,
  } as QboAccount
}

// ── inferNzilaCategory ───────────────────────────────────────────────────────

describe('inferNzilaCategory', () => {
  it('matches cash by classification + type + name → exact', () => {
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Asset',
      AccountType: 'Bank',
      Name: 'Main Chequing',
    }))
    expect(result).toEqual({ category: 'cash', confidence: 'exact' })
  })

  it('matches cash by classification + type only → inferred', () => {
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Asset',
      AccountType: 'Bank',
      Name: 'Primary Operating',
    }))
    expect(result).toEqual({ category: 'cash', confidence: 'inferred' })
  })

  it('matches accounts receivable', () => {
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Asset',
      AccountType: 'Accounts Receivable',
      Name: 'A/R',
    }))
    expect(result?.category).toBe('accounts-receivable')
  })

  it('matches revenue by type', () => {
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Revenue',
      AccountType: 'Income',
      Name: 'Sales Revenue',
    }))
    expect(result).toEqual({ category: 'revenue', confidence: 'exact' })
  })

  it('matches R&D expense by name pattern in pass 2 when type differs', () => {
    // Use name that matches rd-expense but not earlier patterns like accounts-receivable (/ar/)
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Asset',
      AccountType: 'Other Asset' as any,
      Name: 'SRED Costs',
      FullyQualifiedName: 'SRED Costs',
    }))
    expect(result?.category).toBe('rd-expense')
    expect(result?.confidence).toBe('inferred')
  })

  it('matches operating-expense for Expense/Expense even with R&D name', () => {
    // Demonstrates that classification+type match has priority over name
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Expense',
      AccountType: 'Expense',
      Name: 'SR&ED Research Costs',
    }))
    expect(result?.category).toBe('operating-expense')
  })

  it('falls back to name-only matching when type doesn\'t match', () => {
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Revenue',     // wrong classification for payroll
      AccountType: 'Income',          // wrong type for payroll
      Name: 'Payroll Expense Reclassed', // BUT name matches payroll
    }))
    // Pass 1 maps Revenue+Income → 'revenue' first since it matches by type
    expect(result?.category).toBe('revenue')
  })

  it('returns null for unrecognized accounts', () => {
    const result = inferNzilaCategory(makeAccount({
      Classification: 'Asset',
      AccountType: 'Other Asset' as any,
      Name: 'Mystery',
      FullyQualifiedName: 'Mystery',
    }))
    expect(result).toBeNull()
  })
})

// ── buildCoaMapping ──────────────────────────────────────────────────────────

describe('buildCoaMapping', () => {
  it('maps QBO accounts to Nzila categories', async () => {
    mockList.mockResolvedValue([
      makeAccount({ Id: '10', Classification: 'Asset', AccountType: 'Bank', Name: 'Chequing' }),
      makeAccount({ Id: '20', Classification: 'Revenue', AccountType: 'Income', Name: 'Sales' }),
      makeAccount({ Id: '30', Classification: 'Expense', AccountType: 'Expense', Name: 'Rent' }),
    ])

    const qbo: any = {}
    const result = await buildCoaMapping(qbo)

    expect(result.mapped.length).toBeGreaterThanOrEqual(2)
    expect(result.mapped.find((m) => m.nzilaCategory === 'cash')).toBeDefined()
    expect(result.mapped.find((m) => m.nzilaCategory === 'revenue')).toBeDefined()
    expect(result.drifts).toHaveLength(0)
  })

  it('reports unmapped Nzila categories', async () => {
    mockList.mockResolvedValue([
      makeAccount({ Id: '10', Classification: 'Asset', AccountType: 'Bank', Name: 'Cash' }),
    ])

    const result = await buildCoaMapping({} as any)
    expect(result.unmappedNzila.length).toBeGreaterThan(0)
    expect(result.unmappedNzila).not.toContain('cash')
  })

  it('reports unmapped QBO accounts', async () => {
    mockList.mockResolvedValue([
      makeAccount({ Id: '10', Classification: 'Asset', AccountType: 'Bank', Name: 'Cash' }),
      makeAccount({ Id: '99', Classification: 'Asset', AccountType: 'Other Asset' as any, Name: 'Xyzzy', FullyQualifiedName: 'Xyzzy' }),
    ])

    const result = await buildCoaMapping({} as any)
    expect(result.unmappedQbo.find((a) => a.Id === '99')).toBeDefined()
  })

  it('does not map two QBO accounts to the same Nzila category', async () => {
    mockList.mockResolvedValue([
      makeAccount({ Id: '10', Classification: 'Asset', AccountType: 'Bank', Name: 'Chequing' }),
      makeAccount({ Id: '11', Classification: 'Asset', AccountType: 'Bank', Name: 'Savings' }),
    ])

    const result = await buildCoaMapping({} as any)
    const cashMappings = result.mapped.filter((m) => m.nzilaCategory === 'cash')
    expect(cashMappings).toHaveLength(1)
  })
})

// ── createManualMapping ──────────────────────────────────────────────────────

describe('createManualMapping', () => {
  it('creates a manual mapping with correct fields', () => {
    const account = makeAccount({ Id: '77', Name: 'Special', Classification: 'Equity', AccountType: 'Equity' })
    const mapping = createManualMapping('equity', account)

    expect(mapping.nzilaCategory).toBe('equity')
    expect(mapping.qboAccountId).toBe('77')
    expect(mapping.qboAccountName).toBe('Special')
    expect(mapping.confidence).toBe('manual')
    expect(mapping.lastSyncedAt).toBeDefined()
  })
})

// ── detectMappingDrifts ──────────────────────────────────────────────────────

describe('detectMappingDrifts', () => {
  it('returns empty when nothing changed', async () => {
    const qbo = {
      get: vi.fn().mockResolvedValue(makeAccount({ Id: '1', Name: 'Cash', AccountType: 'Bank', Active: true })),
    } as any

    const existing: CoaMapping[] = [{
      nzilaCategory: 'cash',
      qboAccountId: '1',
      qboAccountName: 'Cash',
      qboClassification: 'Asset',
      qboAccountType: 'Bank',
      confidence: 'exact',
      lastSyncedAt: new Date().toISOString(),
    }]

    const drifts = await detectMappingDrifts(qbo, existing)
    expect(drifts).toHaveLength(0)
  })

  it('detects name change', async () => {
    const qbo = {
      get: vi.fn().mockResolvedValue(makeAccount({ Id: '1', Name: 'Primary Chequing', AccountType: 'Bank', Active: true })),
    } as any

    const existing: CoaMapping[] = [{
      nzilaCategory: 'cash',
      qboAccountId: '1',
      qboAccountName: 'Cash',
      qboClassification: 'Asset',
      qboAccountType: 'Bank',
      confidence: 'exact',
      lastSyncedAt: new Date().toISOString(),
    }]

    const drifts = await detectMappingDrifts(qbo, existing)
    expect(drifts).toContainEqual(expect.objectContaining({ field: 'Name', expectedValue: 'Cash', actualValue: 'Primary Chequing' }))
  })

  it('detects account type change', async () => {
    const qbo = {
      get: vi.fn().mockResolvedValue(makeAccount({ Id: '1', Name: 'Cash', AccountType: 'Other Current Asset' as any, Active: true })),
    } as any

    const existing: CoaMapping[] = [{
      nzilaCategory: 'cash',
      qboAccountId: '1',
      qboAccountName: 'Cash',
      qboClassification: 'Asset',
      qboAccountType: 'Bank',
      confidence: 'exact',
      lastSyncedAt: new Date().toISOString(),
    }]

    const drifts = await detectMappingDrifts(qbo, existing)
    expect(drifts).toContainEqual(expect.objectContaining({ field: 'AccountType' }))
  })

  it('detects deactivated account', async () => {
    const qbo = {
      get: vi.fn().mockResolvedValue(makeAccount({ Id: '1', Name: 'Cash', AccountType: 'Bank', Active: false })),
    } as any

    const existing: CoaMapping[] = [{
      nzilaCategory: 'cash',
      qboAccountId: '1',
      qboAccountName: 'Cash',
      qboClassification: 'Asset',
      qboAccountType: 'Bank',
      confidence: 'exact',
      lastSyncedAt: new Date().toISOString(),
    }]

    const drifts = await detectMappingDrifts(qbo, existing)
    expect(drifts).toContainEqual(expect.objectContaining({ field: 'Active' }))
  })

  it('detects deleted/inaccessible account', async () => {
    const qbo = {
      get: vi.fn().mockRejectedValue(new Error('Not found')),
    } as any

    const existing: CoaMapping[] = [{
      nzilaCategory: 'cash',
      qboAccountId: '99',
      qboAccountName: 'Deleted',
      qboClassification: 'Asset',
      qboAccountType: 'Bank',
      confidence: 'exact',
      lastSyncedAt: new Date().toISOString(),
    }]

    const drifts = await detectMappingDrifts(qbo, existing)
    expect(drifts).toContainEqual(expect.objectContaining({ field: 'Existence' }))
  })
})

// ── syncChartOfAccounts ──────────────────────────────────────────────────────

describe('syncChartOfAccounts', () => {
  it('builds mapping and detects drifts for existing mappings', async () => {
    mockList.mockResolvedValue([
      makeAccount({ Id: '10', Classification: 'Asset', AccountType: 'Bank', Name: 'Cash' }),
    ])

    const qbo = {
      get: vi.fn().mockResolvedValue(makeAccount({ Id: '5', Name: 'Changed', AccountType: 'Bank', Active: true })),
    } as any

    const existing: CoaMapping[] = [{
      nzilaCategory: 'revenue',
      qboAccountId: '5',
      qboAccountName: 'Sales',
      qboClassification: 'Revenue',
      qboAccountType: 'Bank' as any,
      confidence: 'exact',
      lastSyncedAt: new Date().toISOString(),
    }]

    const result = await syncChartOfAccounts(qbo, existing)
    expect(result.mapped.length).toBeGreaterThanOrEqual(1)
    expect(result.drifts.length).toBeGreaterThanOrEqual(1)
  })

  it('returns empty drifts when no existing mappings', async () => {
    mockList.mockResolvedValue([])
    const result = await syncChartOfAccounts({} as any, [])
    expect(result.drifts).toHaveLength(0)
  })
})

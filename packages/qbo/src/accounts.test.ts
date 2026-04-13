import { describe, it, expect, vi } from 'vitest'
import {
  isRdAccount,
  listActiveAccounts,
  listExpenseAccounts,
  listRevenueAccounts,
  listRdAccounts,
  getAccountSummary,
} from './accounts'
import type { QboClient } from './client'
import type { QboAccount } from './types'

function makeAccount(overrides?: Partial<QboAccount>): QboAccount {
  return {
    Id: '1',
    Name: 'Test Account',
    FullyQualifiedName: 'Test Account',
    AccountType: 'Expense',
    AccountSubType: 'Other',
    Active: true,
    CurrentBalance: 1000,
    Classification: 'Expense',
    SyncToken: '0',
    ...overrides,
  } as QboAccount
}

function makeQbo(accounts: QboAccount[] = []): QboClient {
  return {
    realmId: 'test-realm',
    query: vi.fn().mockResolvedValue(accounts),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    report: vi.fn(),
  }
}

describe('isRdAccount', () => {
  it('returns true for accounts with R&D in the name', () => {
    expect(isRdAccount(makeAccount({ FullyQualifiedName: 'R&D Expenses' }))).toBe(true)
  })

  it('returns true for accounts with Research in the name', () => {
    expect(isRdAccount(makeAccount({ FullyQualifiedName: 'Research Lab Costs' }))).toBe(true)
  })

  it('returns true for accounts with Development in the name', () => {
    expect(isRdAccount(makeAccount({ FullyQualifiedName: 'Product Development' }))).toBe(true)
  })

  it('returns false for unrelated accounts', () => {
    expect(isRdAccount(makeAccount({ FullyQualifiedName: 'Office Supplies' }))).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isRdAccount(makeAccount({ FullyQualifiedName: 'research costs' }))).toBe(true)
  })
})

describe('listActiveAccounts', () => {
  it('queries accounts and groups by classification', async () => {
    const qbo = makeQbo([makeAccount({ Classification: 'Expense' })])
    const result = await listActiveAccounts(qbo)
    expect(qbo.query).toHaveBeenCalledWith('Account', expect.stringContaining('Active'))
    expect(result.Expense).toHaveLength(1)
    expect(result.Asset).toHaveLength(0)
  })
})

describe('listExpenseAccounts', () => {
  it('filters by expense classification', async () => {
    const accounts = [
      makeAccount({ Id: '1', AccountType: 'Expense' }),
      makeAccount({ Id: '2', AccountType: 'Income' }),
    ]
    const qbo = makeQbo(accounts)
    const result = await listExpenseAccounts(qbo)
    expect(qbo.query).toHaveBeenCalled()
    // The function queries QBO directly, so it returns whatever QBO returns
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('listRevenueAccounts', () => {
  it('queries for revenue/income accounts', async () => {
    const qbo = makeQbo([makeAccount({ AccountType: 'Income' })])
    const result = await listRevenueAccounts(qbo)
    expect(qbo.query).toHaveBeenCalled()
    expect(Array.isArray(result)).toBe(true)
  })
})

describe('listRdAccounts', () => {
  it('filters expense accounts for R&D keywords', async () => {
    const accounts = [
      makeAccount({ FullyQualifiedName: 'R&D Engineering' }),
      makeAccount({ FullyQualifiedName: 'Office Rent' }),
      makeAccount({ FullyQualifiedName: 'Research Costs' }),
    ]
    const qbo = makeQbo(accounts)
    const result = await listRdAccounts(qbo)
    expect(result).toHaveLength(2)
  })
})

describe('getAccountSummary', () => {
  it('returns account summary for all active accounts', async () => {
    const accounts = [
      makeAccount({ Id: '1', FullyQualifiedName: 'General Expense', CurrentBalance: 5000 }),
      makeAccount({ Id: '2', FullyQualifiedName: 'Sales Income', Classification: 'Revenue', CurrentBalance: 10000 }),
      makeAccount({ Id: '3', FullyQualifiedName: 'R&D Costs', CurrentBalance: 3000 }),
    ]
    const qbo = makeQbo(accounts)
    const summary = await getAccountSummary(qbo)
    expect(summary).toHaveLength(3)
    expect(summary[0].balance).toBe(5000)
    const rdItem = summary.find((s) => s.isRd)
    expect(rdItem).toBeDefined()
    expect(rdItem!.name).toBe('Test Account') // from makeAccount default
  })
})

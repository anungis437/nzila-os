import { describe, it, expect, vi } from 'vitest'
import {
  validateJournalBalance,
  postJournalEntry,
  postAdjustingEntry,
  postReversingEntry,
  postTaxAccrualEntry,
} from './journal-write'
import type { JournalLineInput } from './journal-write'

function makeQbo() {
  return {
    realmId: 'test-realm',
    query: vi.fn(),
    get: vi.fn(),
    create: vi.fn().mockResolvedValue({ Id: '1', SyncToken: '0' }),
    update: vi.fn(),
    report: vi.fn(),
  }
}

function debitLine(amount: number, id = '1'): JournalLineInput {
  return { accountId: id, accountName: 'Debit', amount, type: 'debit' }
}

function creditLine(amount: number, id = '2'): JournalLineInput {
  return { accountId: id, accountName: 'Credit', amount, type: 'credit' }
}

describe('validateJournalBalance', () => {
  it('returns balanced for equal debits and credits', () => {
    const result = validateJournalBalance([debitLine(100), creditLine(100)])
    expect(result.balanced).toBe(true)
    expect(result.totalDebit).toBe(100)
    expect(result.totalCredit).toBe(100)
  })

  it('returns unbalanced for mismatched amounts', () => {
    const result = validateJournalBalance([debitLine(100), creditLine(50)])
    expect(result.balanced).toBe(false)
  })

  it('handles floating-point rounding', () => {
    const result = validateJournalBalance([debitLine(33.33), debitLine(33.34), creditLine(66.67)])
    expect(result.balanced).toBe(true)
  })

  it('handles empty lines', () => {
    const result = validateJournalBalance([])
    expect(result.totalDebit).toBe(0)
    expect(result.totalCredit).toBe(0)
    expect(result.balanced).toBe(true)
  })

  it('uses absolute amounts', () => {
    const result = validateJournalBalance([debitLine(-100), creditLine(-100)])
    expect(result.balanced).toBe(true)
  })
})

describe('postJournalEntry', () => {
  it('posts a balanced entry to QBO', async () => {
    const qbo = makeQbo()
    const result = await postJournalEntry(qbo, {
      txnDate: '2025-01-15',
      lines: [debitLine(500), creditLine(500)],
      memo: 'Test JE',
    })

    expect(qbo.create).toHaveBeenCalledWith('JournalEntry', expect.objectContaining({
      TxnDate: '2025-01-15',
    }))
    expect(result.id).toBe('1')
    expect(result.totalDebit).toBe(500)
    expect(result.totalCredit).toBe(500)
    expect(result.lineCount).toBe(2)
    expect(result.entryType).toBe('standard')
  })

  it('throws for unbalanced entries', async () => {
    const qbo = makeQbo()
    await expect(
      postJournalEntry(qbo, {
        txnDate: '2025-01-15',
        lines: [debitLine(500), creditLine(300)],
      }),
    ).rejects.toThrow(/Unbalanced/)
  })

  it('throws for fewer than 2 lines', async () => {
    const qbo = makeQbo()
    // Empty lines are "balanced" (0=0) but fail the minimum line check
    await expect(
      postJournalEntry(qbo, {
        txnDate: '2025-01-15',
        lines: [],
      }),
    ).rejects.toThrow(/at least 2 lines/)
  })

  it('includes entity data in lines when provided', async () => {
    const qbo = makeQbo()
    const lines: JournalLineInput[] = [
      { accountId: '1', amount: 100, type: 'debit', entity: { type: 'Vendor', id: 'v1', name: 'Acme' } },
      { accountId: '2', amount: 100, type: 'credit' },
    ]
    await postJournalEntry(qbo, { txnDate: '2025-01-01', lines })
    const body = (qbo.create as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(body.Line[0].JournalEntryLineDetail.Entity).toBeDefined()
  })

  it('includes class and department refs', async () => {
    const qbo = makeQbo()
    const lines: JournalLineInput[] = [
      { accountId: '1', amount: 200, type: 'debit', classId: 'c1', className: 'Eng', departmentId: 'd1' },
      { accountId: '2', amount: 200, type: 'credit' },
    ]
    await postJournalEntry(qbo, { txnDate: '2025-01-01', lines })
    const body = (qbo.create as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(body.Line[0].JournalEntryLineDetail.ClassRef).toEqual({ value: 'c1', name: 'Eng' })
    expect(body.Line[0].JournalEntryLineDetail.DepartmentRef).toEqual({ value: 'd1' })
  })
})

describe('postAdjustingEntry', () => {
  it('posts with adjusting entry type', async () => {
    const qbo = makeQbo()
    const result = await postAdjustingEntry(qbo, {
      txnDate: '2025-06-30',
      lines: [debitLine(1000), creditLine(1000)],
    })
    expect(result.entryType).toBe('adjusting')
    expect(qbo.create).toHaveBeenCalled()
  })
})

describe('postReversingEntry', () => {
  it('flips debits to credits and vice-versa', async () => {
    const qbo = makeQbo()
    const original: JournalLineInput[] = [debitLine(500), creditLine(500)]
    const result = await postReversingEntry(qbo, original, '2025-07-01', 'June accrual')

    const body = (qbo.create as ReturnType<typeof vi.fn>).mock.calls[0][1]
    // original debit becomes credit, original credit becomes debit
    expect(body.Line[0].JournalEntryLineDetail.PostingType).toBe('Credit')
    expect(body.Line[1].JournalEntryLineDetail.PostingType).toBe('Debit')
    expect(result.entryType).toBe('reversing')
  })
})

describe('postTaxAccrualEntry', () => {
  it('creates a balanced tax accrual with DR expense / CR payable', async () => {
    const qbo = makeQbo()
    const result = await postTaxAccrualEntry(qbo, '30', '40', 2500, '2025-12-31')
    expect(result.entryType).toBe('tax-accrual')

    const body = (qbo.create as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(body.Line).toHaveLength(2)
    expect(body.Line[0].JournalEntryLineDetail.PostingType).toBe('Debit')
    expect(body.Line[1].JournalEntryLineDetail.PostingType).toBe('Credit')
  })

  it('accepts a custom description', async () => {
    const qbo = makeQbo()
    await postTaxAccrualEntry(qbo, '30', '40', 1000, '2025-12-31', 'Q4 provision')
    const body = (qbo.create as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(body.PrivateNote).toContain('Q4 provision')
  })
})

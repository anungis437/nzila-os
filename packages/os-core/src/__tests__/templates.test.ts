/**
 * @nzila/os-core — Resolution template tests
 */
import { describe, it, expect } from 'vitest'
import { getResolutionTemplate, listAvailableTemplates } from '../templates'

describe('listAvailableTemplates', () => {
  it('returns array of template names', () => {
    const templates = listAvailableTemplates()
    expect(Array.isArray(templates)).toBe(true)
    expect(templates.length).toBeGreaterThan(0)
  })

  it('includes known governance actions', () => {
    const templates = listAvailableTemplates()
    expect(templates).toContain('issue_shares')
    expect(templates).toContain('transfer_shares')
    expect(templates).toContain('borrow_funds')
    expect(templates).toContain('elect_directors')
    expect(templates).toContain('amend_constitution')
    expect(templates).toContain('dividend')
  })
})

describe('getResolutionTemplate', () => {
  it('returns null for unknown action', () => {
    const result = getResolutionTemplate('not_a_real_action' as never)
    expect(result).toBeNull()
  })

  it('returns template for issue_shares', () => {
    const tpl = getResolutionTemplate('issue_shares', {
      quantity: '100',
      className: 'Class A',
      recipientName: 'Alice',
      pricePerShare: '10.00',
      effectiveDate: '2025-01-01',
    })
    expect(tpl).not.toBeNull()
    expect(tpl!.title).toContain('100')
    expect(tpl!.title).toContain('Class A')
    expect(tpl!.bodyMarkdown).toContain('Alice')
    expect(tpl!.bodyMarkdown).toContain('10.00')
    expect(tpl!.bodyMarkdown).toContain('2025-01-01')
  })

  it('renders placeholders when params are missing', () => {
    const tpl = getResolutionTemplate('issue_shares')
    expect(tpl).not.toBeNull()
    expect(tpl!.title).toContain('___')
    expect(tpl!.bodyMarkdown).toContain('___')
  })

  it('returns template for transfer_shares', () => {
    const tpl = getResolutionTemplate('transfer_shares', {
      quantity: '50',
      className: 'Common',
      fromName: 'Bob',
      toName: 'Carol',
      effectiveDate: '2025-03-15',
    })
    expect(tpl).not.toBeNull()
    expect(tpl!.bodyMarkdown).toContain('Bob')
    expect(tpl!.bodyMarkdown).toContain('Carol')
  })

  it('returns template for borrow_funds', () => {
    const tpl = getResolutionTemplate('borrow_funds', {
      amount: '500000',
      currency: 'USD',
      lenderName: 'Bank A',
      effectiveDate: '2025-06-01',
    })
    expect(tpl).not.toBeNull()
    expect(tpl!.title).toContain('500000')
    expect(tpl!.bodyMarkdown).toContain('USD')
    expect(tpl!.bodyMarkdown).toContain('Bank A')
  })

  it('returns template for elect_directors', () => {
    const tpl = getResolutionTemplate('elect_directors', {
      directorNames: 'Alice, Bob',
      effectiveDate: '2025-01-01',
    })
    expect(tpl).not.toBeNull()
    expect(tpl!.bodyMarkdown).toContain('Alice, Bob')
  })

  it('returns template for amend_constitution', () => {
    const tpl = getResolutionTemplate('amend_constitution', {
      articleNumber: '4.1',
      amendmentText: 'Changed quorum to 3',
      effectiveDate: '2025-01-01',
    })
    expect(tpl).not.toBeNull()
    expect(tpl!.bodyMarkdown).toContain('4.1')
    expect(tpl!.bodyMarkdown).toContain('Changed quorum to 3')
  })

  it('returns template for dividend', () => {
    const tpl = getResolutionTemplate('dividend', {
      amountPerShare: '2.50',
      className: 'Preferred',
      recordDate: '2025-06-01',
      paymentDate: '2025-07-01',
      effectiveDate: '2025-06-01',
    })
    expect(tpl).not.toBeNull()
    expect(tpl!.bodyMarkdown).toContain('2.50')
    expect(tpl!.bodyMarkdown).toContain('Preferred')
    expect(tpl!.bodyMarkdown).toContain('2025-07-01')
  })
})

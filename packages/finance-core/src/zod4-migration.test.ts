import { describe, expect, it } from 'vitest'
import { FinanceAccountSchema, TransactionSchema, PaymentIntentSchema } from './schemas.js'

describe('Zod 4 finance schema compatibility', () => {
  const account = { id:'a', orgId:'org-a', accountType:'member', status:'pending', ownerId:'u',
    displayName:'Member', currency:'CAD', balanceCents:100, createdAt:'2026-11-02', updatedAt:'2026-11-02' }
  it('preserves metadata and organization coordinates', () => {
    const parsed = FinanceAccountSchema.parse({ ...account, metadata:{ nested:{ values:[1,2] } } })
    expect(parsed.orgId).toBe('org-a')
    expect(parsed.metadata).toEqual({ nested:{ values:[1,2] } })
  })
  it('rejects malformed records and amounts without coercion', () => {
    for (const metadata of [[], 'text', 5])
      expect(FinanceAccountSchema.safeParse({ ...account, metadata }).success).toBe(false)
    expect(FinanceAccountSchema.safeParse({ ...account, balanceCents:'100' }).success).toBe(false)
    expect(FinanceAccountSchema.safeParse({ ...account, accountType:'invalid' }).success).toBe(false)
  })
  it('preserves transaction and payment dictionaries', () => {
    const tx={id:'tx',orgId:'org-a',type:'transfer',status:'pending',amountCents:100,
      currency:'CAD',description:'Transfer',idempotencyKey:'key',createdAt:'2026-11-02',metadata:{source:'api'}}
    expect(TransactionSchema.parse(tx).metadata).toEqual({source:'api'})
    expect(TransactionSchema.safeParse({...tx,metadata:[]}).success).toBe(false)
    const payment={id:'pay',orgId:'org-a',accountId:'a',amountCents:100,currency:'CAD',
      status:'pending',createdAt:'2026-11-02',metadata:{batch:1}}
    expect(PaymentIntentSchema.parse(payment).metadata).toEqual({batch:1})
    expect(PaymentIntentSchema.safeParse({...payment,amountCents:1.5}).success).toBe(false)
  })
})

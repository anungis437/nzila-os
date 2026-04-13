import { describe, it, expect } from 'vitest'
import {
  QuoteWorkflowStatus,
  ShareLinkStatus,
  QuoteShareLinkSchema,
  CreateShareLinkInput,
  ApprovalAction,
  SubmitApprovalInput,
  RevisionStatus,
  QuoteRevisionSchema,
  QuotePaymentRequirementSchema,
  PaymentStatusValue,
  QuotePaymentStatusSchema,
  PaymentEventType,
  RecordPaymentEventInput,
  TimelineEventSchema,
} from '../schemas/workflow-schemas'

const uuid = '00000000-0000-4000-8000-000000000001'
const now = new Date().toISOString()

describe('QuoteWorkflowStatus', () => {
  it('accepts valid statuses', () => {
    expect(QuoteWorkflowStatus.parse('DRAFT')).toBe('DRAFT')
    expect(QuoteWorkflowStatus.parse('ACCEPTED')).toBe('ACCEPTED')
    expect(QuoteWorkflowStatus.parse('CANCELLED')).toBe('CANCELLED')
  })

  it('rejects unknown status', () => {
    expect(() => QuoteWorkflowStatus.parse('INVALID')).toThrow()
  })
})

describe('ShareLinkStatus', () => {
  it('accepts ACTIVE, EXPIRED, REVOKED, USED', () => {
    for (const s of ['ACTIVE', 'EXPIRED', 'REVOKED', 'USED']) {
      expect(ShareLinkStatus.parse(s)).toBe(s)
    }
  })
})

describe('QuoteShareLinkSchema', () => {
  const valid = {
    id: uuid,
    quoteId: uuid,
    tokenHash: 'abc123',
    expiresAt: now,
    createdAt: now,
    createdBy: 'user-1',
    status: 'ACTIVE',
    accessCount: 0,
    lastAccessedAt: null,
  }

  it('parses a valid share link', () => {
    const result = QuoteShareLinkSchema.parse(valid)
    expect(result.status).toBe('ACTIVE')
    expect(result.accessCount).toBe(0)
    expect(result.lastAccessedAt).toBeNull()
  })

  it('defaults accessCount to 0', () => {
    const { accessCount: _, ...without } = valid
    const result = QuoteShareLinkSchema.parse(without)
    expect(result.accessCount).toBe(0)
  })

  it('rejects non-uuid id', () => {
    expect(() => QuoteShareLinkSchema.parse({ ...valid, id: 'not-a-uuid' })).toThrow()
  })
})

describe('CreateShareLinkInput', () => {
  it('defaults expiresInDays to 7', () => {
    const result = CreateShareLinkInput.parse({ quoteId: uuid, createdBy: 'user-1' })
    expect(result.expiresInDays).toBe(7)
  })

  it('rejects expiresInDays > 90', () => {
    expect(() => CreateShareLinkInput.parse({ quoteId: uuid, createdBy: 'user-1', expiresInDays: 91 })).toThrow()
  })

  it('rejects expiresInDays < 1', () => {
    expect(() => CreateShareLinkInput.parse({ quoteId: uuid, createdBy: 'user-1', expiresInDays: 0 })).toThrow()
  })
})

describe('ApprovalAction', () => {
  it('accepts ACCEPT and REQUEST_REVISION', () => {
    expect(ApprovalAction.parse('ACCEPT')).toBe('ACCEPT')
    expect(ApprovalAction.parse('REQUEST_REVISION')).toBe('REQUEST_REVISION')
  })
})

describe('SubmitApprovalInput', () => {
  it('parses valid approval', () => {
    const result = SubmitApprovalInput.parse({
      action: 'ACCEPT',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
    })
    expect(result.message).toBe('')
    expect(result.action).toBe('ACCEPT')
  })

  it('rejects invalid email', () => {
    expect(() => SubmitApprovalInput.parse({
      action: 'ACCEPT',
      customerName: 'Jane',
      customerEmail: 'not-an-email',
    })).toThrow()
  })

  it('rejects message over 2000 chars', () => {
    expect(() => SubmitApprovalInput.parse({
      action: 'ACCEPT',
      customerName: 'Jane',
      customerEmail: 'jane@example.com',
      message: 'x'.repeat(2001),
    })).toThrow()
  })
})

describe('RevisionStatus', () => {
  it('accepts OPEN, ADDRESSED, CLOSED', () => {
    for (const s of ['OPEN', 'ADDRESSED', 'CLOSED']) {
      expect(RevisionStatus.parse(s)).toBe(s)
    }
  })
})

describe('QuoteRevisionSchema', () => {
  const valid = {
    id: uuid,
    quoteId: uuid,
    requestedBy: 'user-1',
    requestMessage: 'Please update pricing',
    createdAt: now,
    resolvedAt: null,
    status: 'OPEN',
  }

  it('parses a valid revision', () => {
    const result = QuoteRevisionSchema.parse(valid)
    expect(result.status).toBe('OPEN')
    expect(result.resolvedAt).toBeNull()
  })

  it('rejects empty requestMessage', () => {
    expect(() => QuoteRevisionSchema.parse({ ...valid, requestMessage: '' })).toThrow()
  })
})

describe('QuotePaymentRequirementSchema', () => {
  const valid = {
    id: uuid,
    quoteId: uuid,
    depositRequired: true,
    depositPercent: 30,
    depositAmount: 500,
    dueBeforeProduction: true,
    createdAt: now,
  }

  it('parses valid payment requirement', () => {
    const result = QuotePaymentRequirementSchema.parse(valid)
    expect(result.depositRequired).toBe(true)
    expect(result.depositPercent).toBe(30)
  })

  it('rejects depositPercent > 100', () => {
    expect(() => QuotePaymentRequirementSchema.parse({ ...valid, depositPercent: 101 })).toThrow()
  })

  it('defaults dueBeforeProduction to true', () => {
    const { dueBeforeProduction: _, ...without } = valid
    const result = QuotePaymentRequirementSchema.parse(without)
    expect(result.dueBeforeProduction).toBe(true)
  })
})

describe('PaymentStatusValue', () => {
  it('accepts all expected statuses', () => {
    for (const s of ['NOT_REQUIRED', 'PENDING_DEPOSIT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']) {
      expect(PaymentStatusValue.parse(s)).toBe(s)
    }
  })
})

describe('QuotePaymentStatusSchema', () => {
  it('parses valid payment status', () => {
    const result = QuotePaymentStatusSchema.parse({
      id: uuid,
      quoteId: uuid,
      status: 'PAID',
      amountDue: 1000,
      amountPaid: 1000,
      updatedAt: now,
    })
    expect(result.status).toBe('PAID')
    expect(result.amountPaid).toBe(1000)
  })

  it('defaults amountPaid to 0', () => {
    const result = QuotePaymentStatusSchema.parse({
      id: uuid,
      quoteId: uuid,
      status: 'PENDING_DEPOSIT',
      amountDue: 500,
      updatedAt: now,
    })
    expect(result.amountPaid).toBe(0)
  })
})

describe('PaymentEventType', () => {
  it('accepts all event types', () => {
    for (const t of ['INVOICE_CREATED', 'DEPOSIT_REQUESTED', 'PAYMENT_RECORDED', 'PAYMENT_CONFIRMED']) {
      expect(PaymentEventType.parse(t)).toBe(t)
    }
  })
})

describe('RecordPaymentEventInput', () => {
  it('parses minimal valid input', () => {
    const result = RecordPaymentEventInput.parse({
      quoteId: uuid,
      eventType: 'PAYMENT_RECORDED',
      amount: 250,
    })
    expect(result.amount).toBe(250)
    expect(result.providerRef).toBeUndefined()
  })

  it('rejects negative amount', () => {
    expect(() => RecordPaymentEventInput.parse({
      quoteId: uuid,
      eventType: 'PAYMENT_RECORDED',
      amount: -1,
    })).toThrow()
  })
})

describe('TimelineEventSchema', () => {
  it('parses valid timeline event', () => {
    const result = TimelineEventSchema.parse({
      id: 'evt-1',
      quoteId: uuid,
      event: 'quote_created',
      description: 'Quote was created',
      timestamp: now,
    })
    expect(result.event).toBe('quote_created')
    expect(result.actor).toBeUndefined()
  })

  it('accepts optional actor and metadata', () => {
    const result = TimelineEventSchema.parse({
      id: 'evt-2',
      quoteId: uuid,
      event: 'quote_sent',
      description: 'Sent to client',
      actor: 'user-1',
      timestamp: now,
      metadata: { sentTo: 'client@example.com' },
    })
    expect(result.actor).toBe('user-1')
    expect(result.metadata?.sentTo).toBe('client@example.com')
  })
})

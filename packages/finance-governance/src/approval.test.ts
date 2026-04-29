import { describe, it, expect } from 'vitest'
import {
  createApprovalRequest,
  recordApproval,
  recordDenial,
  isFullyApproved,
  checkThreshold,
} from './approval.js'
import type { SpendingControl } from './types.js'

const mockControl: SpendingControl = {
  id: 'ctrl-1',
  orgId: 'org-1',
  dailyLimitCents: 1000000,
  monthlyLimitCents: 5000000,
  perTransactionLimitCents: 100000,
  requiresDualApprovalAboveCents: 50000,
  currency: 'ZAR',
  createdBy: 'admin-1',
  updatedAt: new Date().toISOString(),
}

describe('createApprovalRequest', () => {
  it('creates a pending request', () => {
    const req = createApprovalRequest({
      orgId: 'org-1',
      requestedBy: 'user-1',
      subject: 'transfer',
      subjectId: 'txn-1',
      amountCents: 20000,
      currency: 'ZAR',
      threshold: 10000,
      requiredApprovers: 1,
    })
    expect(req.status).toBe('pending')
    expect(req.approvals).toHaveLength(0)
  })
})

describe('recordApproval', () => {
  it('approves with single approver when requiredApprovers is 1', () => {
    let req = createApprovalRequest({
      orgId: 'org-1',
      requestedBy: 'user-1',
      subject: 'transfer',
      subjectId: 'txn-1',
      amountCents: 20000,
      currency: 'ZAR',
      threshold: 10000,
      requiredApprovers: 1,
    })
    req = recordApproval(req, 'approver-1')
    expect(req.status).toBe('approved')
    expect(isFullyApproved(req)).toBe(true)
  })

  it('stays pending until enough approvers', () => {
    let req = createApprovalRequest({
      orgId: 'org-1',
      requestedBy: 'user-1',
      subject: 'transfer',
      subjectId: 'txn-1',
      amountCents: 60000,
      currency: 'ZAR',
      threshold: 50000,
      requiredApprovers: 2,
    })
    req = recordApproval(req, 'approver-1')
    expect(req.status).toBe('pending')
    req = recordApproval(req, 'approver-2')
    expect(req.status).toBe('approved')
  })
})

describe('recordDenial', () => {
  it('immediately rejects the request', () => {
    let req = createApprovalRequest({
      orgId: 'org-1',
      requestedBy: 'user-1',
      subject: 'transfer',
      subjectId: 'txn-1',
      requiredApprovers: 2,
      threshold: 50000,
    })
    req = recordDenial(req, 'approver-1', 'Policy violation')
    expect(req.status).toBe('rejected')
    expect(req.resolvedAt).toBeTruthy()
  })
})

describe('checkThreshold', () => {
  it('returns auto_approve for small amounts', () => {
    expect(checkThreshold(10000, mockControl)).toBe('auto_approve')
  })

  it('returns dual_approval for amounts above dual approval threshold', () => {
    expect(checkThreshold(60000, mockControl)).toBe('dual_approval')
  })
})

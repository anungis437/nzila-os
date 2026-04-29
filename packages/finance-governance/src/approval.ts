import { createHash } from 'node:crypto'
import type { ApprovalRequest, Approval, SpendingControl } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export interface CreateApprovalInput {
  orgId: string
  requestedBy: string
  subject: string
  subjectId: string
  amountCents?: number
  currency?: string
  threshold: number
  requiredApprovers: number
  expiresAt?: string
}

export function createApprovalRequest(input: CreateApprovalInput): ApprovalRequest {
  const now = new Date().toISOString()
  return {
    id: generateId(`approval:${input.orgId}:${input.subjectId}:${now}`),
    orgId: input.orgId,
    requestedBy: input.requestedBy,
    subject: input.subject,
    subjectId: input.subjectId,
    amountCents: input.amountCents,
    currency: input.currency,
    threshold: input.threshold,
    requiredApprovers: input.requiredApprovers,
    approvals: [],
    denials: [],
    status: 'pending',
    createdAt: now,
    expiresAt: input.expiresAt,
  }
}

export function recordApproval(request: ApprovalRequest, approverId: string, note?: string): ApprovalRequest {
  if (request.status !== 'pending') {
    throw new Error(`Cannot approve a request with status: ${request.status}`)
  }
  const approval: Approval = {
    approverId,
    note,
    approvedAt: new Date().toISOString(),
  }
  const updatedApprovals = [...request.approvals, approval]
  const fullyApproved = updatedApprovals.length >= request.requiredApprovers
  return {
    ...request,
    approvals: updatedApprovals,
    status: fullyApproved ? 'approved' : 'pending',
    resolvedAt: fullyApproved ? new Date().toISOString() : undefined,
  }
}

export function recordDenial(request: ApprovalRequest, approverId: string, reason: string): ApprovalRequest {
  if (request.status !== 'pending') {
    throw new Error(`Cannot deny a request with status: ${request.status}`)
  }
  const denial: Approval = {
    approverId,
    note: reason,
    approvedAt: new Date().toISOString(),
  }
  return {
    ...request,
    denials: [...request.denials, denial],
    status: 'rejected',
    resolvedAt: new Date().toISOString(),
  }
}

export function isFullyApproved(request: ApprovalRequest): boolean {
  return request.approvals.length >= request.requiredApprovers
}

export type ApprovalLevel = 'auto_approve' | 'single_approval' | 'dual_approval'

/**
 * Determines the governance approval tier required for a transaction amount.
 * This is separate from checkSpendingControl (which enforces hard limits).
 * Use both: spending controls to gate whether a transaction proceeds at all,
 * and checkThreshold to determine how many approvers are required when it does.
 */
export function checkThreshold(amountCents: number, control: SpendingControl): ApprovalLevel {
  if (amountCents > control.requiresDualApprovalAboveCents) return 'dual_approval'
  if (amountCents > control.perTransactionLimitCents) return 'single_approval'
  return 'auto_approve'
}

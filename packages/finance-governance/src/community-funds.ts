import { createHash } from 'node:crypto'
import type { CommunityFund, FundContribution, HardshipDisbursement, ApprovalRequest, ApprovalStatus } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export interface CreateFundInput {
  orgId: string
  name: string
  purpose: string
  currency: string
  createdBy: string
}

export interface DisbursementInput {
  orgId: string
  fundId: string
  recipientId: string
  amountCents: number
  currency: string
  approvalRequestId: string
}

export function createFund(input: CreateFundInput): CommunityFund {
  const now = new Date().toISOString()
  return {
    id: generateId(`fund:${input.orgId}:${input.name}:${now}`),
    orgId: input.orgId,
    name: input.name,
    purpose: input.purpose,
    balanceCents: 0,
    currency: input.currency,
    createdBy: input.createdBy,
    status: 'active',
    createdAt: now,
  }
}

export function addContribution(fund: CommunityFund, contribution: FundContribution): CommunityFund {
  if (fund.status !== 'active') {
    throw new Error('Cannot add contributions to a closed fund')
  }
  return {
    ...fund,
    balanceCents: fund.balanceCents + contribution.amountCents,
  }
}

export function requestDisbursement(input: DisbursementInput): HardshipDisbursement {
  const now = new Date().toISOString()
  return {
    id: generateId(`disbursement:${input.orgId}:${input.recipientId}:${now}`),
    orgId: input.orgId,
    fundId: input.fundId,
    recipientId: input.recipientId,
    amountCents: input.amountCents,
    currency: input.currency,
    approvalRequestId: input.approvalRequestId,
    status: 'pending',
  }
}

export function approveDisbursement(
  disbursement: HardshipDisbursement,
  approvalRequest: ApprovalRequest,
): HardshipDisbursement {
  const status: ApprovalStatus = approvalRequest.status === 'approved' ? 'approved' : 'rejected'
  return {
    ...disbursement,
    status,
    disbursedAt: status === 'approved' ? new Date().toISOString() : undefined,
  }
}

export function getFundBalance(fund: CommunityFund): { balanceCents: number; currency: string } {
  return { balanceCents: fund.balanceCents, currency: fund.currency }
}

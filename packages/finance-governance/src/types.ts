export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'

export interface Approval {
  approverId: string
  note?: string
  approvedAt: string
}

export interface ApprovalRequest {
  id: string
  orgId: string
  requestedBy: string
  subject: string
  subjectId: string
  amountCents?: number
  currency?: string
  threshold: number
  requiredApprovers: number
  approvals: Approval[]
  denials: Approval[]
  status: ApprovalStatus
  createdAt: string
  resolvedAt?: string
  expiresAt?: string
}

export interface SpendingControl {
  id: string
  orgId: string
  dailyLimitCents: number
  monthlyLimitCents: number
  perTransactionLimitCents: number
  requiresDualApprovalAboveCents: number
  currency: string
  createdBy: string
  updatedAt: string
}

export type ProposalStatus = 'draft' | 'voting' | 'approved' | 'rejected' | 'executed'

export interface TreasuryProposal {
  id: string
  orgId: string
  proposedBy: string
  title: string
  description: string
  requestedAmountCents: number
  currency: string
  status: ProposalStatus
  voteDeadline: string
  createdAt: string
  executedAt?: string
}

export type VoteChoice = 'for' | 'against' | 'abstain'

export interface VoteRecord {
  id: string
  orgId: string
  proposalId: string
  voterId: string
  vote: VoteChoice
  votedAt: string
  rationale?: string
}

export type FundStatus = 'active' | 'closed'

export interface CommunityFund {
  id: string
  orgId: string
  name: string
  purpose: string
  balanceCents: number
  currency: string
  createdBy: string
  status: FundStatus
  createdAt: string
}

export interface FundContribution {
  id: string
  orgId: string
  fundId: string
  contributorId: string
  amountCents: number
  currency: string
  contributedAt: string
  notes?: string
}

export interface HardshipDisbursement {
  id: string
  orgId: string
  fundId: string
  recipientId: string
  amountCents: number
  currency: string
  approvalRequestId: string
  disbursedAt?: string
  status: ApprovalStatus
}

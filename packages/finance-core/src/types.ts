export type FinanceStatus =
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'settled'
  | 'reversed'
  | 'cancelled'
  | 'suspended'
  | 'archived'

export type AccountType =
  | 'customer'
  | 'member'
  | 'organisation'
  | 'sub_account'
  | 'treasury'
  | 'community_fund'

export interface FinanceAccount {
  id: string
  orgId: string
  accountType: AccountType
  status: FinanceStatus
  ownerId: string
  displayName: string
  currency: string
  balanceCents: number
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface BalanceSnapshot {
  id: string
  orgId: string
  accountId: string
  balanceCents: number
  currency: string
  snapshotAt: string
  runId: string
}

export type TransactionStatus = FinanceStatus

export type TransactionType =
  | 'transfer'
  | 'payout'
  | 'collection'
  | 'subscription'
  | 'adjustment'
  | 'refund'
  | 'fee'

export interface Transaction {
  id: string
  orgId: string
  type: TransactionType
  status: TransactionStatus
  fromAccountId?: string
  toAccountId?: string
  amountCents: number
  currency: string
  description: string
  idempotencyKey: string
  createdAt: string
  settledAt?: string
  metadata?: Record<string, unknown>
}

export interface PaymentIntent {
  id: string
  orgId: string
  accountId: string
  amountCents: number
  currency: string
  status: FinanceStatus
  externalRef?: string
  createdAt: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

export interface TransferRequest {
  id: string
  orgId: string
  fromAccountId: string
  toAccountId: string
  amountCents: number
  currency: string
  requestedBy: string
  status: FinanceStatus
  approvalRequestId?: string
  createdAt: string
}

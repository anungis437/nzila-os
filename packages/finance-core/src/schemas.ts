import { z } from 'zod'

export const FinanceStatusSchema = z.enum([
  'pending',
  'submitted',
  'approved',
  'rejected',
  'failed',
  'settled',
  'reversed',
  'cancelled',
  'suspended',
  'archived',
])

export const AccountTypeSchema = z.enum([
  'customer',
  'member',
  'organisation',
  'sub_account',
  'treasury',
  'community_fund',
])

export const FinanceAccountSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  accountType: AccountTypeSchema,
  status: FinanceStatusSchema,
  ownerId: z.string(),
  displayName: z.string(),
  currency: z.string(),
  balanceCents: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
})

export const BalanceSnapshotSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  accountId: z.string(),
  balanceCents: z.number().int(),
  currency: z.string(),
  snapshotAt: z.string(),
  runId: z.string(),
})

export const TransactionTypeSchema = z.enum([
  'transfer',
  'payout',
  'collection',
  'subscription',
  'adjustment',
  'refund',
  'fee',
])

export const TransactionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  type: TransactionTypeSchema,
  status: FinanceStatusSchema,
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  amountCents: z.number().int(),
  currency: z.string(),
  description: z.string(),
  idempotencyKey: z.string(),
  createdAt: z.string(),
  settledAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const PaymentIntentSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  accountId: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  status: FinanceStatusSchema,
  externalRef: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const TransferRequestSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  fromAccountId: z.string(),
  toAccountId: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  requestedBy: z.string(),
  status: FinanceStatusSchema,
  approvalRequestId: z.string().optional(),
  createdAt: z.string(),
})

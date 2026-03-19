import { z } from 'zod'

// ─── Event Envelope ─────────────────────────────────────────────────────────

export const eventMetadataSchema = z.object({
  tenantId: z.string().min(1),
  actorId: z.string().min(1),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  source: z.string().min(1),
})

export type EventMetadata = z.infer<typeof eventMetadataSchema>

export const domainEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  version: z.number().int().positive(),
  payload: z.record(z.unknown()),
  metadata: eventMetadataSchema,
  timestamp: z.string().datetime(),
})

export type DomainEvent = z.infer<typeof domainEventSchema>

// ─── Domain Event Contracts (Versioned) ─────────────────────────────────────

// Claims Domain
export const ClaimCreated_v1 = z.object({
  claimId: z.string().uuid(),
  claimType: z.string().min(1),
  claimantId: z.string().min(1),
  amount: z.number().nonnegative().optional(),
  description: z.string(),
})
export type ClaimCreated_v1 = z.infer<typeof ClaimCreated_v1>

export const ClaimUpdated_v1 = z.object({
  claimId: z.string().uuid(),
  changes: z.record(z.unknown()),
  updatedBy: z.string().min(1),
})
export type ClaimUpdated_v1 = z.infer<typeof ClaimUpdated_v1>

export const ClaimResolved_v1 = z.object({
  claimId: z.string().uuid(),
  resolution: z.enum(['approved', 'denied', 'withdrawn']),
  resolvedBy: z.string().min(1),
  notes: z.string().optional(),
})
export type ClaimResolved_v1 = z.infer<typeof ClaimResolved_v1>

// User Domain
export const UserAssigned_v1 = z.object({
  userId: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  role: z.string().min(1),
  assignedBy: z.string().min(1),
})
export type UserAssigned_v1 = z.infer<typeof UserAssigned_v1>

export const UserDeactivated_v1 = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1),
  deactivatedBy: z.string().min(1),
})
export type UserDeactivated_v1 = z.infer<typeof UserDeactivated_v1>

// Commerce Domain
export const OrderCreated_v1 = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
  })),
  totalAmount: z.number().nonnegative(),
  currency: z.string().length(3),
})
export type OrderCreated_v1 = z.infer<typeof OrderCreated_v1>

export const PaymentProcessed_v1 = z.object({
  paymentId: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  method: z.string().min(1),
  status: z.enum(['success', 'failed', 'pending']),
})
export type PaymentProcessed_v1 = z.infer<typeof PaymentProcessed_v1>

// Governance Domain
export const PolicyEvaluated_v1 = z.object({
  policyId: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  decision: z.enum(['allow', 'deny']),
  reason: z.string(),
  evaluatedBy: z.string().min(1),
})
export type PolicyEvaluated_v1 = z.infer<typeof PolicyEvaluated_v1>

// AI Domain
export const AIRequestCompleted_v1 = z.object({
  requestId: z.string().uuid(),
  model: z.string().min(1),
  tokensUsed: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  classification: z.enum(['safe', 'warning', 'restricted']),
  durationMs: z.number().nonnegative(),
})
export type AIRequestCompleted_v1 = z.infer<typeof AIRequestCompleted_v1>

// ─── Contract Registry Type ─────────────────────────────────────────────────

export const EVENT_CONTRACTS = {
  'ClaimCreated': { v1: ClaimCreated_v1 },
  'ClaimUpdated': { v1: ClaimUpdated_v1 },
  'ClaimResolved': { v1: ClaimResolved_v1 },
  'UserAssigned': { v1: UserAssigned_v1 },
  'UserDeactivated': { v1: UserDeactivated_v1 },
  'OrderCreated': { v1: OrderCreated_v1 },
  'PaymentProcessed': { v1: PaymentProcessed_v1 },
  'PolicyEvaluated': { v1: PolicyEvaluated_v1 },
  'AIRequestCompleted': { v1: AIRequestCompleted_v1 },
} as const

export type EventType = keyof typeof EVENT_CONTRACTS

/**
 * ShopMoiCa Workflow Schemas
 *
 * Zod schemas and TypeScript types for the quote approval, revision,
 * share link, payment, and gating data models.
 */
import { z } from 'zod'

// ── Quote Statuses ─────────────────────────────────────────────────────────

export const QuoteWorkflowStatus = z.enum([
  'DRAFT',
  'INTERNAL_REVIEW',
  'SENT_TO_CLIENT',
  'REVISION_REQUESTED',
  'ACCEPTED',
  'DEPOSIT_REQUIRED',
  'READY_FOR_PO',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'CLOSED',
  'EXPIRED',
  'CANCELLED',
])
export type QuoteWorkflowStatus = z.infer<typeof QuoteWorkflowStatus>

// ── Share Link ─────────────────────────────────────────────────────────────

export const ShareLinkStatus = z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'USED'])
export type ShareLinkStatus = z.infer<typeof ShareLinkStatus>

export const QuoteShareLinkSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  tokenHash: z.string().min(1),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  createdBy: z.string().min(1),
  status: ShareLinkStatus,
  accessCount: z.number().int().min(0).default(0),
  lastAccessedAt: z.coerce.date().nullable().default(null),
})
export type QuoteShareLink = z.infer<typeof QuoteShareLinkSchema>

export const CreateShareLinkInput = z.object({
  quoteId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(90).default(7),
  createdBy: z.string().min(1),
})
export type CreateShareLinkInput = z.infer<typeof CreateShareLinkInput>

// ── Quote Approval ─────────────────────────────────────────────────────────

export const ApprovalAction = z.enum(['ACCEPT', 'REQUEST_REVISION'])
export type ApprovalAction = z.infer<typeof ApprovalAction>

export const QuoteApprovalSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  action: ApprovalAction,
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  message: z.string().max(2000).optional().default(''),
  createdAt: z.coerce.date(),
  sourceIpHash: z.string().nullable().default(null),
  shareLinkId: z.string().uuid(),
})
export type QuoteApproval = z.infer<typeof QuoteApprovalSchema>

export const SubmitApprovalInput = z.object({
  action: ApprovalAction,
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(320),
  message: z.string().max(2000).optional().default(''),
})
export type SubmitApprovalInput = z.infer<typeof SubmitApprovalInput>

// ── Quote Revision ─────────────────────────────────────────────────────────

export const RevisionStatus = z.enum(['OPEN', 'ADDRESSED', 'CLOSED'])
export type RevisionStatus = z.infer<typeof RevisionStatus>

export const QuoteRevisionSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  requestedBy: z.string().min(1),
  requestMessage: z.string().min(1).max(2000),
  createdAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable().default(null),
  status: RevisionStatus,
})
export type QuoteRevision = z.infer<typeof QuoteRevisionSchema>

// ── Payment Requirements ───────────────────────────────────────────────────

export const QuotePaymentRequirementSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  depositRequired: z.boolean(),
  depositPercent: z.number().min(0).max(100).nullable().default(null),
  depositAmount: z.number().min(0).nullable().default(null),
  dueBeforeProduction: z.boolean().default(true),
  createdAt: z.coerce.date(),
})
export type QuotePaymentRequirement = z.infer<typeof QuotePaymentRequirementSchema>

export const SetPaymentRequirementInput = z.object({
  quoteId: z.string().uuid(),
  depositRequired: z.boolean(),
  depositPercent: z.number().min(0).max(100).optional(),
  depositAmount: z.number().min(0).optional(),
  dueBeforeProduction: z.boolean().default(true),
})
export type SetPaymentRequirementInput = z.infer<typeof SetPaymentRequirementInput>

// ── Payment Status ─────────────────────────────────────────────────────────

export const PaymentStatusValue = z.enum([
  'NOT_REQUIRED',
  'PENDING_DEPOSIT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
])
export type PaymentStatusValue = z.infer<typeof PaymentStatusValue>

export const QuotePaymentStatusSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  status: PaymentStatusValue,
  amountDue: z.number().min(0),
  amountPaid: z.number().min(0).default(0),
  updatedAt: z.coerce.date(),
})
export type QuotePaymentStatus = z.infer<typeof QuotePaymentStatusSchema>

// ── Payment Events ─────────────────────────────────────────────────────────

export const PaymentEventType = z.enum([
  'INVOICE_CREATED',
  'DEPOSIT_REQUESTED',
  'PAYMENT_RECORDED',
  'PAYMENT_CONFIRMED',
])
export type PaymentEventType = z.infer<typeof PaymentEventType>

export const PaymentEventSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  eventType: PaymentEventType,
  amount: z.number().min(0),
  providerRef: z.string().nullable().default(null),
  metadataJson: z.record(z.unknown()).nullable().default(null),
  createdAt: z.coerce.date(),
})
export type PaymentEvent = z.infer<typeof PaymentEventSchema>

export const RecordPaymentEventInput = z.object({
  quoteId: z.string().uuid(),
  eventType: PaymentEventType,
  amount: z.number().min(0),
  providerRef: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type RecordPaymentEventInput = z.infer<typeof RecordPaymentEventInput>

// ── Timeline Event (for UI) ───────────────────────────────────────────────

export const TimelineEventSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  event: z.string(),
  description: z.string(),
  actor: z.string().optional(),
  timestamp: z.coerce.date(),
  metadata: z.record(z.unknown()).optional(),
})
export type TimelineEvent = z.infer<typeof TimelineEventSchema>

// ── Audit Event Types ──────────────────────────────────────────────────────

export const WorkflowAuditEvent = z.enum([
  'quote_submitted_for_review',
  'quote_sent_to_client',
  'quote_share_link_created',
  'quote_share_link_viewed',
  'quote_accepted_by_client',
  'quote_revision_requested',
  'quote_revision_addressed',
  'deposit_required_set',
  'deposit_request_created',
  'payment_status_changed',
  'quote_blocked_by_payment_policy',
  'quote_unblocked_for_po',
  'po_created_from_quote',
  'production_started',
  'order_shipped',
  'order_delivered',
  'quote_closed',
])
export type WorkflowAuditEvent = z.infer<typeof WorkflowAuditEvent>

// ── PO Readiness Check ─────────────────────────────────────────────────────

export interface POReadinessResult {
  ready: boolean
  blockers: string[]
  quoteId: string
  quoteStatus: QuoteWorkflowStatus
  paymentCleared: boolean
  supplierSelected: boolean
  requiredFieldsComplete: boolean
}

// ── Production Readiness Check ─────────────────────────────────────────────

export interface ProductionReadinessResult {
  ready: boolean
  blockers: string[]
  orderId: string
  poValid: boolean
  paymentCleared: boolean
  detailsComplete: boolean
}

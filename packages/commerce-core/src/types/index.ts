/**
 * @nzila/commerce-core — Domain Types
 *
 * All commerce domain types. No DB, no framework — pure TypeScript.
 * These types represent the canonical shape of commerce orgs.
 * Nzila convention: org scoping uses "orgId" (the Nzila org_id column).
 *
 * @module @nzila/commerce-core/types
 */
import type {
  QuoteStatus,
  OrderStatus,
  InvoiceStatus,
  FulfillmentStatus,
  ApprovalDecision,
  PricingTier,
  OpportunityStatus,
  EvidenceType,
  CancellationReason,
  DisputeReason,
  OrgRole,
} from '../enums'

// ── Utility Types ───────────────────────────────────────────────────────────

/** Branded string for idempotency keys. */
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' }

/** Org-scoped public reference number (e.g., QUO-ENT-000123). */
export type PublicRef = string & { readonly __brand: 'PublicRef' }

/**
 * Strategy for generating org-scoped public reference numbers.
 *
 * Pattern: {PREFIX}-{ORG_SHORT}-{SEQUENCE}
 * - PREFIX: entity type (QUO, ORD, INV, FUL, CRN)
 * - ORG_SHORT: first 3 chars of org slug, uppercased
 * - SEQUENCE: zero-padded 6-digit counter, per org per entity type
 *
 * Implementation deferred until DB layer (requires atomic counter).
 */
export interface RefNumberStrategy {
  prefix: string
  orgSlug: string
  nextSequence: number
}

// ── Context ─────────────────────────────────────────────────────────────────

/**
 * Org context carried through every request.
 *
 * `orgId` is the canonical field (aligns with @nzila/org).
 *
 * @see {@link @nzila/org OrgContext} for the canonical base type.
 */
export interface OrgContext {
  /** Organisation UUID — canonical field. */
  readonly orgId: string
  /** Authenticated user performing the action. */
  readonly actorId: string
  /** User's role within this org. */
  readonly role: OrgRole
  /** Granular permission keys. */
  readonly permissions: readonly string[]
  /** Request-level correlation ID for tracing. */
  readonly requestId: string
}

// ── Customer ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  /** @deprecated Use OrgContext.orgId — entity-level orgId will be removed. */
  orgId: string
  name: string
  email: string | null
  phone: string | null
  address: CustomerAddress | null
  externalIds: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface CustomerAddress {
  line1: string
  line2?: string
  city: string
  province: string
  postalCode: string
  country: string
}

// ── Opportunity ─────────────────────────────────────────────────────────────

export interface Opportunity {
  id: string
  orgId: string
  customerId: string
  title: string
  status: OpportunityStatus
  estimatedValue: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ── Quote ───────────────────────────────────────────────────────────────────

export interface Quote {
  id: string
  orgId: string
  ref: PublicRef
  customerId: string
  opportunityId: string | null
  status: QuoteStatus
  currentVersionId: string | null
  validUntil: string | null
  sentAt: string | null
  idempotencyKey: IdempotencyKey | null
  createdAt: string
  updatedAt: string
}

export interface QuoteVersion {
  id: string
  orgId: string
  quoteId: string
  versionNumber: number
  tier: PricingTier
  lines: QuoteLine[]
  subtotal: number
  discountTotal: number
  taxBreakdown: TaxBreakdown
  grandTotal: number
  approvalFlags: ApprovalFlag[]
  explanation: PricingExplanation
  snapshotHash: string
  createdAt: string
}

export interface QuoteLine {
  id: string
  orgId: string
  quoteVersionId: string
  itemName: string
  itemSku: string | null
  quantity: number
  unitCost: number
  unitPrice: number
  lineTotal: number
  discountPercent: number
  discountAmount: number
  sortOrder: number
}

// ── Pricing ─────────────────────────────────────────────────────────────────

export interface TaxBreakdown {
  jurisdiction: string
  lines: TaxLine[]
  totalTax: number
}

export interface TaxLine {
  name: string
  rate: number
  baseAmount: number
  taxAmount: number
}

export interface ApprovalFlag {
  reason: string
  threshold: number
  actualValue: number
}

export interface PricingExplanation {
  tier: PricingTier
  marginPercent: number
  discountApplied: boolean
  volumeDiscount: number
  taxJurisdiction: string
}

// ── Approval ────────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string
  orgId: string
  quoteVersionId: string
  requestedBy: string
  decision: ApprovalDecision
  decidedBy: string | null
  reason: string | null
  decidedAt: string | null
  createdAt: string
}

// ── Order ───────────────────────────────────────────────────────────────────

export interface Order {
  id: string
  orgId: string
  ref: PublicRef
  customerId: string
  quoteId: string
  quoteVersionId: string
  status: OrderStatus
  lines: OrderLine[]
  subtotal: number
  discountTotal: number
  taxBreakdown: TaxBreakdown
  grandTotal: number
  lockedSnapshot: string
  idempotencyKey: IdempotencyKey | null
  createdAt: string
  updatedAt: string
}

export interface OrderLine {
  id: string
  orgId: string
  orderId: string
  itemName: string
  itemSku: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  sortOrder: number
}

// ── Fulfilment ──────────────────────────────────────────────────────────────

export interface FulfillmentTask {
  id: string
  orgId: string
  orderId: string
  orderLineId: string | null
  status: FulfillmentStatus
  assignedTo: string | null
  notes: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Delivery {
  id: string
  orgId: string
  orderId: string
  trackingNumber: string | null
  carrier: string | null
  shippedAt: string | null
  deliveredAt: string | null
  proofOfDelivery: string | null
  createdAt: string
}

export interface Return {
  id: string
  orgId: string
  orderId: string
  orderLineId: string | null
  reason: string
  status: 'requested' | 'approved' | 'received' | 'refunded' | 'rejected'
  quantity: number
  createdAt: string
  updatedAt: string
}

// ── Invoice ─────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string
  orgId: string
  ref: PublicRef
  orderId: string
  customerId: string
  status: InvoiceStatus
  lines: InvoiceLine[]
  subtotal: number
  taxBreakdown: TaxBreakdown
  grandTotal: number
  amountPaid: number
  amountDue: number
  dueDate: string
  issuedAt: string | null
  paidAt: string | null
  idempotencyKey: IdempotencyKey | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceLine {
  id: string
  orgId: string
  invoiceId: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  sortOrder: number
}

export interface Payment {
  id: string
  orgId: string
  invoiceId: string
  amount: number
  method: string
  reference: string | null
  paidAt: string
  createdAt: string
}

export interface CreditNote {
  id: string
  orgId: string
  invoiceId: string
  ref: PublicRef
  amount: number
  reason: string
  issuedAt: string
  createdAt: string
}

export interface Refund {
  id: string
  orgId: string
  paymentId: string
  invoiceId: string
  amount: number
  reason: string
  status: 'pending' | 'processed' | 'failed'
  processedAt: string | null
  createdAt: string
}

export interface Dispute {
  id: string
  orgId: string
  invoiceId: string
  reason: DisputeReason
  description: string
  status: 'open' | 'investigating' | 'resolved' | 'escalated'
  resolution: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string
  orgId: string
  actorId: string
  entityType: string
  targetEntityId: string
  action: string
  fromState: string | null
  toState: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

// ── Evidence ────────────────────────────────────────────────────────────────

export interface EvidenceArtifact {
  id: string
  orgId: string
  type: EvidenceType
  targetEntityType: string
  targetEntityId: string
  storageKey: string
  hash: string
  createdAt: string
}

// ── Sync ────────────────────────────────────────────────────────────────────

export interface SyncJob {
  id: string
  orgId: string
  provider: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  payload: Record<string, unknown>
  attempts: number
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export interface SyncReceipt {
  id: string
  orgId: string
  syncJobId: string
  provider: string
  recordsSynced: number
  recordsFailed: number
  snapshot: Record<string, unknown>
  createdAt: string
}

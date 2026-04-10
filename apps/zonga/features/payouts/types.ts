/**
 * Zonga — Payout Domain Types
 *
 * Revenue attribution, split computation, payout lifecycle.
 */

// ── Earnings ────────────────────────────────────────────────────────────────

export type EarningsSource = 'streaming' | 'download' | 'ticket_sale' | 'subscription_share' | 'tip'

export interface EarningsEntry {
  id: string
  orgId: string
  creatorId: string
  source: EarningsSource
  referenceId: string        // track/event/order ID
  referenceType: string      // 'track' | 'event' | 'order'
  grossAmount: number
  platformFee: number
  netAmount: number
  currency: string
  period: string             // YYYY-MM format
  settledAt?: Date
  createdAt: Date
}

export interface EarningsBalance {
  creatorId: string
  orgId: string
  currency: string
  totalEarned: number
  totalPaid: number
  pendingBalance: number
  availableBalance: number   // pendingBalance minus any holds
}

// ── Revenue Splits ──────────────────────────────────────────────────────────

export interface RevenueSplitRule {
  id: string
  contentId: string          // track ID or event ID
  contentType: 'track' | 'event'
  recipientId: string        // creator/collaborator user ID
  recipientRole: string      // 'primary_artist' | 'featured_artist' | 'producer' | 'songwriter' | 'organizer'
  splitPercentage: number    // 0-100, all splits must sum to 100
  orgId: string
}

// ── Payouts ─────────────────────────────────────────────────────────────────

export type PayoutStatus = 'requested' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface PayoutRequest {
  id: string
  creatorId: string
  orgId: string
  amount: number
  currency: string
  status: PayoutStatus
  stripeTransferId?: string
  failureReason?: string
  requestedAt: Date
  processedAt?: Date
}

export interface PayoutBatch {
  id: string
  orgId: string
  payoutCount: number
  totalAmount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'partial_failure'
  processedAt?: Date
  createdAt: Date
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Platform fee percentages by source */
export const PLATFORM_FEE_PCT: Record<EarningsSource, number> = {
  streaming: 30,
  download: 20,
  ticket_sale: 5,
  subscription_share: 25,
  tip: 5,
}

/** Minimum payout threshold per currency */
export const MIN_PAYOUT_THRESHOLD: Record<string, number> = {
  USD: 25,
  ZAR: 500,
  NGN: 10000,
  KES: 2500,
  GHS: 200,
  XOF: 15000,
  XAF: 15000,
  EUR: 20,
  GBP: 20,
}

export const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  requested: ['approved', 'cancelled'],
  approved: ['processing', 'cancelled'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: ['requested'],  // retry
  cancelled: [],
}

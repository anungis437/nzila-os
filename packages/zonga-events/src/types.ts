/**
 * @nzila/zonga-events — Types
 *
 * Platform-grade event engine types.
 * Events, venues, sessions, ticketing, check-in, promo codes, refunds.
 */
import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const EventStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ON_SALE: 'on_sale',
  SOLD_OUT: 'sold_out',
  DOORS_OPEN: 'doors_open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  POSTPONED: 'postponed',
} as const
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus]

export const EventType = {
  CONCERT: 'concert',
  FESTIVAL: 'festival',
  ALBUM_LAUNCH: 'album_launch',
  VIRTUAL: 'virtual',
  MEET_AND_GREET: 'meet_and_greet',
  CLUB_NIGHT: 'club_night',
  SHOWCASE: 'showcase',
  WORKSHOP: 'workshop',
  LISTENING_PARTY: 'listening_party',
} as const
export type EventType = (typeof EventType)[keyof typeof EventType]

export const SessionStatus = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus]

export const TicketStatus = {
  RESERVED: 'reserved',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  TRANSFERRED: 'transferred',
  EXPIRED: 'expired',
} as const
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus]

export const TicketTier = {
  EARLY_BIRD: 'early_bird',
  GENERAL: 'general',
  VIP: 'vip',
  VVIP: 'vvip',
  COMP: 'comp',
  PRESALE: 'presale',
  STANDARD: 'standard',
} as const
export type TicketTier = (typeof TicketTier)[keyof typeof TicketTier]

export const ScanResult = {
  VALID: 'valid',
  ALREADY_SCANNED: 'already_scanned',
  INVALID: 'invalid',
  TRANSFERRED: 'transferred',
  FRAUDULENT: 'fraudulent',
  EXPIRED: 'expired',
  WRONG_EVENT: 'wrong_event',
  WRONG_SESSION: 'wrong_session',
} as const
export type ScanResult = (typeof ScanResult)[keyof typeof ScanResult]

export const TransferStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus]

export const RefundReason = {
  EVENT_CANCELLED: 'event_cancelled',
  EVENT_POSTPONED: 'event_postponed',
  CUSTOMER_REQUEST: 'customer_request',
  DUPLICATE_PURCHASE: 'duplicate_purchase',
  FRAUD: 'fraud',
  OTHER: 'other',
} as const
export type RefundReason = (typeof RefundReason)[keyof typeof RefundReason]

export const RefundStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSED: 'processed',
  CANCELLED: 'cancelled',
} as const
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus]

export const PromoCodeType = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  FREE_TICKET: 'free_ticket',
} as const
export type PromoCodeType = (typeof PromoCodeType)[keyof typeof PromoCodeType]

// ── Core Entities ─────────────────────────────────────────────────────────

export interface Venue {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly address: string
  readonly city: string
  readonly country: string
  readonly latitude: number | null
  readonly longitude: number | null
  readonly totalCapacity: number
  readonly zones: readonly VenueZone[]
  readonly amenities: readonly string[]
  readonly contactEmail: string | null
  readonly contactPhone: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface VenueZone {
  readonly id: string
  readonly name: string
  readonly capacity: number
  readonly tier: TicketTier
}

export interface Event {
  readonly id: string
  readonly orgId: string
  readonly type: EventType
  readonly status: EventStatus
  readonly title: string
  readonly description: string
  readonly venueId: string
  readonly venueName: string
  readonly city: string
  readonly country: string
  readonly startsAt: Date
  readonly endsAt: Date
  readonly doorsOpenAt: Date | null
  readonly timezone: string
  readonly imageUrl: string | null
  readonly artistIds: readonly string[]
  readonly promoterId: string | null
  readonly sessions: readonly EventSession[]
  readonly metadata: Record<string, unknown>
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface EventSession {
  readonly id: string
  readonly eventId: string
  readonly title: string
  readonly status: SessionStatus
  readonly startsAt: Date
  readonly endsAt: Date
  readonly artistIds: readonly string[]
  readonly stageOrZone: string | null
}

export interface CapacityModel {
  readonly eventId: string
  readonly totalCapacity: number
  readonly tiers: readonly TierCapacity[]
}

export interface TierCapacity {
  readonly tier: TicketTier
  readonly totalQuantity: number
  readonly soldQuantity: number
  readonly reservedQuantity: number
  readonly availableQuantity: number
  readonly price: number
  readonly currency: string
}

export interface TicketInventory {
  readonly eventId: string
  readonly tierId: string
  readonly tier: TicketTier
  readonly totalQuantity: number
  readonly soldQuantity: number
  readonly reservedQuantity: number
  readonly maxPerOrder: number
  readonly salesStartAt: Date
  readonly salesEndAt: Date
  readonly isOnSale: boolean
}

export interface TicketOrder {
  readonly id: string
  readonly orgId: string
  readonly eventId: string
  readonly buyerId: string
  readonly buyerEmail: string
  readonly items: readonly TicketOrderItem[]
  readonly subtotal: number
  readonly discount: number
  readonly total: number
  readonly currency: string
  readonly promoCodeId: string | null
  readonly paymentRef: string | null
  readonly status: 'pending' | 'confirmed' | 'failed' | 'refunded' | 'cancelled'
  readonly createdAt: Date
  readonly confirmedAt: Date | null
}

export interface TicketOrderItem {
  readonly ticketId: string
  readonly tier: TicketTier
  readonly price: number
  readonly holderName: string
  readonly holderEmail: string
}

export interface TicketHolder {
  readonly id: string
  readonly orderId: string
  readonly eventId: string
  readonly tier: TicketTier
  readonly status: TicketStatus
  readonly holderName: string
  readonly holderEmail: string
  readonly qrCode: string
  readonly scannedAt: Date | null
  readonly scannedBy: string | null
  readonly transferredTo: string | null
  readonly createdAt: Date
}

export interface TicketScan {
  readonly id: string
  readonly ticketId: string
  readonly eventId: string
  readonly sessionId: string | null
  readonly result: ScanResult
  readonly scannedBy: string
  readonly scannedAt: Date
  readonly deviceId: string | null
  readonly offlineSync: boolean
  readonly conflictResolved: boolean
}

export interface TicketTransfer {
  readonly id: string
  readonly ticketId: string
  readonly fromHolderId: string
  readonly toEmail: string
  readonly toName: string
  readonly status: TransferStatus
  readonly transferReason: string | null
  readonly createdAt: Date
  readonly acceptedAt: Date | null
  readonly expiresAt: Date
}

export interface PromoCode {
  readonly id: string
  readonly eventId: string
  readonly orgId: string
  readonly code: string
  readonly type: PromoCodeType
  readonly value: number
  readonly maxUses: number
  readonly usedCount: number
  readonly applicableTiers: readonly TicketTier[]
  readonly expiresAt: Date
  readonly isActive: boolean
  readonly createdAt: Date
}

export interface RefundRequest {
  readonly id: string
  readonly orderId: string
  readonly ticketId: string | null
  readonly reason: RefundReason
  readonly status: RefundStatus
  readonly amount: number
  readonly currency: string
  readonly requestedBy: string
  readonly processedBy: string | null
  readonly notes: string | null
  readonly createdAt: Date
  readonly processedAt: Date | null
}

// ── Event Settlement ──────────────────────────────────────────────────────

export interface EventSettlement {
  readonly eventId: string
  readonly grossTicketSales: number
  readonly totalRefunds: number
  readonly totalChargebacks: number
  readonly platformFees: number
  readonly promoterShare: number
  readonly artistShares: readonly { artistId: string; amount: number }[]
  readonly netRevenue: number
  readonly currency: string
  readonly settledAt: Date | null
}

// ── Zod Schemas ───────────────────────────────────────────────────────────

export const CreateEventSchema = z.object({
  orgId: z.string().min(1),
  type: z.enum([
    'concert', 'festival', 'album_launch', 'virtual',
    'meet_and_greet', 'club_night', 'showcase', 'workshop', 'listening_party',
  ]),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(''),
  venueId: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  doorsOpenAt: z.coerce.date().nullish(),
  timezone: z.string().default('UTC'),
  imageUrl: z.string().url().nullish(),
  artistIds: z.array(z.string().min(1)).min(1),
  promoterId: z.string().nullish(),
})
export type CreateEventInput = z.infer<typeof CreateEventSchema>

export const CreateVenueSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(200),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(2).max(3),
  totalCapacity: z.number().int().positive(),
  zones: z.array(z.object({
    name: z.string().min(1),
    capacity: z.number().int().positive(),
    tier: z.enum(['early_bird', 'general', 'vip', 'vvip', 'comp', 'presale', 'standard']),
  })).default([]),
  contactEmail: z.string().email().nullish(),
  contactPhone: z.string().nullish(),
})
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>

export const PurchaseTicketSchema = z.object({
  eventId: z.string().min(1),
  buyerId: z.string().min(1),
  buyerEmail: z.string().email(),
  items: z.array(z.object({
    tier: z.enum(['early_bird', 'general', 'vip', 'vvip', 'comp', 'presale', 'standard']),
    quantity: z.number().int().positive().max(10),
    holderName: z.string().min(1),
    holderEmail: z.string().email(),
  })).min(1),
  promoCode: z.string().nullish(),
})
export type PurchaseTicketInput = z.infer<typeof PurchaseTicketSchema>

export const TransferTicketSchema = z.object({
  ticketId: z.string().min(1),
  toEmail: z.string().email(),
  toName: z.string().min(1),
  reason: z.string().max(500).default(''),
})
export type TransferTicketInput = z.infer<typeof TransferTicketSchema>

export const RefundRequestSchema = z.object({
  orderId: z.string().min(1),
  ticketId: z.string().nullish(),
  reason: z.enum([
    'event_cancelled', 'event_postponed', 'customer_request',
    'duplicate_purchase', 'fraud', 'other',
  ]),
  notes: z.string().max(2000).nullish(),
})
export type RefundRequestInput = z.infer<typeof RefundRequestSchema>

export const ScanTicketSchema = z.object({
  ticketId: z.string().min(1),
  eventId: z.string().min(1),
  sessionId: z.string().nullish(),
  scannedBy: z.string().min(1),
  deviceId: z.string().nullish(),
  offlineSync: z.boolean().default(false),
})
export type ScanTicketInput = z.infer<typeof ScanTicketSchema>

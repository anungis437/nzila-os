/**
 * @nzila/zonga-events — Platform-grade events engine
 *
 * Venues, events, ticketing, capacity management,
 * check-in, settlement, and offline sync.
 */

// ── Types & Schemas ───────────────────────────────────────────────────────
export {
  // Enums
  EventStatus,
  EventType,
  SessionStatus,
  TicketStatus,
  TicketTier,
  ScanResult,
  TransferStatus,
  RefundReason,
  RefundStatus,
  PromoCodeType,

  // Interfaces
  type Venue,
  type VenueZone,
  type Event,
  type EventSession,
  type CapacityModel,
  type TierCapacity,
  type TicketInventory,
  type TicketOrder,
  type TicketOrderItem,
  type TicketHolder,
  type TicketScan,
  type TicketTransfer,
  type PromoCode,
  type RefundRequest,
  type EventSettlement,

  // Schemas
  CreateEventSchema,
  CreateVenueSchema,
  PurchaseTicketSchema,
  TransferTicketSchema,
  RefundRequestSchema,
  ScanTicketSchema,
} from './types'

// ── Capacity Engine ───────────────────────────────────────────────────────
export {
  checkCapacity,
  buildCapacityModel,
  computeSellThrough,
  type CapacityCheck,
} from './capacity'

// ── Ticketing Engine ──────────────────────────────────────────────────────
export {
  validatePromoCode,
  computeOrderTotal,
  validateTransfer,
  checkRefundEligibility,
  type PromoValidation,
  type OrderTotal,
  type TransferValidation,
  type RefundEligibility,
} from './ticketing'

// ── Check-in Engine ───────────────────────────────────────────────────────
export {
  validateScan,
  resolveOfflineConflicts,
  buildOfflineCache,
  computeCheckInStats,
  type CheckInResult,
  type OfflineScanRecord,
  type ConflictResolution,
  type CheckInStats,
} from './checkin'

// ── Event Settlement ──────────────────────────────────────────────────────
export {
  checkSettlementReadiness,
  computeEventRevenue,
  buildEventSettlement,
  DEFAULT_EVENT_SPLITS,
  TICKET_FEE_RULES,
  type EventRevenueBreakdown,
  type SettlementReadiness,
} from './event-settlement'

// ── Event Economics ───────────────────────────────────────────────────────
export {
  DEFAULT_EVENT_FEE_MODEL,
  PREMIUM_EVENT_FEE_MODEL,
  DEFAULT_REFUND_POLICY,
  feeModelToRules,
  computeTicketClassRevenue,
  calculateRefund,
  computeEventRevenueSummary,
  type EventFeeModel,
  type TicketClassConfig,
  type TicketClassRevenue,
  type RefundPolicy,
  type RefundCalculation,
  type EventRevenueSummary,
} from './event-economics'

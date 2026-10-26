/**
 * @nzila/trade-core — Zod Validation Schemas
 *
 * Used at API/action boundaries for input validation.
 */

import { z } from 'zod'
import { partialWithoutDefaults } from './partial-without-defaults'
import {
  TradePartyRole,
  TradePartyStatus,
  TradeListingType,
  TradeListingStatus,
  TradeMediaType,
  TradeDealStage,
  TradeQuoteStatus,
  TradeDocType,
} from '../enums'

// ── Shared ──────────────────────────────────────────────────────────────────

export const uuidSchema = z.guid()

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export const currencySchema = z.string().length(3).toUpperCase()

// ── Party ───────────────────────────────────────────────────────────────────

export const createPartySchema = z.object({
  role: z.enum([
    TradePartyRole.SELLER,
    TradePartyRole.BUYER,
    TradePartyRole.BROKER,
    TradePartyRole.AGENT,
  ]),
  name: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).nullable().optional(),
  companyName: z.string().min(1).max(200),
  country: z.string().length(3),
  metadata: z.record(z.string(), z.unknown()).optional().prefault({}),
})

export const updatePartySchema = partialWithoutDefaults(createPartySchema).extend({
  id: uuidSchema,
  status: z
    .enum([TradePartyStatus.ACTIVE, TradePartyStatus.SUSPENDED, TradePartyStatus.ARCHIVED])
    .optional(),
})

// ── Listing ─────────────────────────────────────────────────────────────────

export const createListingSchema = z.object({
  partyId: uuidSchema,
  listingType: z.enum([TradeListingType.GENERIC, TradeListingType.VEHICLE]),
  title: z.string().min(1).max(300),
  description: z.string().max(10_000).optional().default(''),
  currency: currencySchema,
  askingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  quantity: z.number().int().min(1).default(1),
  metadata: z.record(z.string(), z.unknown()).optional().prefault({}),
})

export const updateListingSchema = partialWithoutDefaults(createListingSchema).extend({
  id: uuidSchema,
  status: z
    .enum([
      TradeListingStatus.DRAFT,
      TradeListingStatus.ACTIVE,
      TradeListingStatus.RESERVED,
      TradeListingStatus.SOLD,
      TradeListingStatus.ARCHIVED,
    ])
    .optional(),
})

// ── Listing Media ───────────────────────────────────────────────────────────

export const addListingMediaSchema = z.object({
  listingId: uuidSchema,
  mediaType: z.enum([TradeMediaType.IMAGE, TradeMediaType.VIDEO, TradeMediaType.DOCUMENT]),
  storageKey: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
})

// ── Deal ────────────────────────────────────────────────────────────────────

export const createDealSchema = z.object({
  sellerPartyId: uuidSchema,
  buyerPartyId: uuidSchema,
  listingId: uuidSchema.nullable().optional(),
  totalValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: currencySchema,
  notes: z.string().max(5_000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().prefault({}),
})

export const transitionDealSchema = z.object({
  dealId: uuidSchema,
  toStage: z.enum([
    TradeDealStage.LEAD,
    TradeDealStage.QUALIFIED,
    TradeDealStage.QUOTED,
    TradeDealStage.ACCEPTED,
    TradeDealStage.FUNDED,
    TradeDealStage.SHIPPED,
    TradeDealStage.DELIVERED,
    TradeDealStage.CLOSED,
    TradeDealStage.CANCELLED,
  ]),
  metadata: z.record(z.string(), z.unknown()).optional().prefault({}),
})

// ── Quote ───────────────────────────────────────────────────────────────────

export const createQuoteSchema = z.object({
  dealId: uuidSchema,
  terms: z.record(z.string(), z.unknown()),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  quantity: z.number().int().min(1),
  currency: currencySchema,
  validUntil: z.string().datetime().nullable().optional(),
})

export const transitionQuoteSchema = z.object({
  quoteId: uuidSchema,
  toStatus: z.enum([
    TradeQuoteStatus.DRAFT,
    TradeQuoteStatus.SENT,
    TradeQuoteStatus.ACCEPTED,
    TradeQuoteStatus.DECLINED,
    TradeQuoteStatus.EXPIRED,
    TradeQuoteStatus.REVISED,
  ]),
  metadata: z.record(z.string(), z.unknown()).optional().prefault({}),
})

// ── Financing ───────────────────────────────────────────────────────────────

export const createFinancingSchema = z.object({
  dealId: uuidSchema,
  terms: z.record(z.string(), z.unknown()),
  provider: z.string().max(200).nullable().optional(),
})

// ── Shipment ────────────────────────────────────────────────────────────────

export const createShipmentSchema = z.object({
  dealId: uuidSchema,
  originCountry: z.string().length(3),
  destinationCountry: z.string().length(3),
  lane: z.string().max(100).nullable().optional(),
  carrier: z.string().max(200).nullable().optional(),
  trackingNumber: z.string().max(100).nullable().optional(),
  estimatedDeparture: z.string().datetime().nullable().optional(),
  estimatedArrival: z.string().datetime().nullable().optional(),
})

export const updateShipmentMilestoneSchema = z.object({
  shipmentId: uuidSchema,
  milestoneName: z.string().min(1),
  completedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2_000).nullable().optional(),
})

// ── Document ────────────────────────────────────────────────────────────────

export const uploadDocumentSchema = z.object({
  dealId: uuidSchema,
  docType: z.enum([
    TradeDocType.BILL_OF_SALE,
    TradeDocType.INVOICE,
    TradeDocType.PACKING_LIST,
    TradeDocType.CERTIFICATE_OF_ORIGIN,
    TradeDocType.CUSTOMS_DECLARATION,
    TradeDocType.INSPECTION_REPORT,
    TradeDocType.EXPORT_CERTIFICATE,
    TradeDocType.INSURANCE,
    TradeDocType.OTHER,
  ]),
  title: z.string().min(1).max(300),
  storageKey: z.string().min(1),
  contentHash: z.string().min(1),
})

// ── Commission ──────────────────────────────────────────────────────────────

export const createCommissionSchema = z.object({
  dealId: uuidSchema,
  partyId: uuidSchema,
  policy: z.record(z.string(), z.unknown()),
  currency: currencySchema,
})

export const finalizeCommissionSchema = z.object({
  commissionId: uuidSchema,
  calculatedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
})

/**
 * Nzila OS — Agricultural tables
 *
 * Domain tables for the agricultural supply chain: producers, cooperatives,
 * crops, harvests, lots, quality inspections, warehouses, batches, shipments,
 * payments, certifications, traceability, and intelligence outputs.
 *
 * Every table is scoped by org_id (org identity).
 * Follows existing patterns from trade.ts and commerce.ts.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  numeric,
  varchar,
  date,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

// ══════════════════════════════════════════════════════════════════════════════
// ── Agri Enums ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export const agriCropTypeEnum = pgEnum('agri_crop_type', [
  'coffee', 'cocoa', 'cashew', 'cotton', 'sesame', 'soy', 'palm_oil', 'spice', 'other',
])

export const agriUnitOfMeasureEnum = pgEnum('agri_unit_of_measure', [
  'kg', 'lb', 'mt', 'bag_60kg', 'bag_69kg', 'liter',
])

export const agriProducerStatusEnum = pgEnum('agri_producer_status', [
  'active', 'inactive', 'suspended',
])

export const agriLotStatusEnum = pgEnum('agri_lot_status', [
  'pending', 'inspected', 'graded', 'certified', 'rejected',
])

export const agriBatchStatusEnum = pgEnum('agri_batch_status', [
  'available', 'allocated', 'depleted',
])

export const agriWarehouseStatusEnum = pgEnum('agri_warehouse_status', [
  'active', 'inactive',
])

export const agriShipmentStatusEnum = pgEnum('agri_shipment_status', [
  'planned', 'packed', 'dispatched', 'arrived', 'closed',
])

export const agriPaymentPlanStatusEnum = pgEnum('agri_payment_plan_status', [
  'draft', 'approved', 'executing', 'completed',
])

export const agriPaymentStatusEnum = pgEnum('agri_payment_status', [
  'pending', 'executed', 'failed', 'reversed',
])

export const agriPaymentMethodEnum = pgEnum('agri_payment_method', [
  'mobile_money', 'bank_transfer', 'cash', 'check', 'stripe',
])

export const agriCertificationTypeEnum = pgEnum('agri_certification_type', [
  'organic', 'fairtrade', 'rainforest_alliance', 'utz', 'internal_quality', 'export_grade',
])

export const agriEvidenceTypeEnum = pgEnum('agri_evidence_type', [
  'lot_certification', 'shipment_manifest', 'payment_distribution', 'traceability_chain',
])

export const agriTraceabilityEntityTypeEnum = pgEnum('agri_traceability_entity_type', [
  'lot', 'batch', 'shipment', 'payment', 'harvest',
])

export const agriForecastTypeEnum = pgEnum('agri_forecast_type', [
  'yield', 'price', 'demand', 'cost', 'climate', 'production', 'logistics',
])

export const agriRiskTypeEnum = pgEnum('agri_risk_type', [
  'climate', 'market', 'operational',
])

export const agriRiskScopeEnum = pgEnum('agri_risk_scope', [
  'cooperative', 'region', 'crop',
])

// ══════════════════════════════════════════════════════════════════════════════
// ── Core Agri Tables ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── 1) agri_producers ───────────────────────────────────────────────────────

export const agriProducers = pgTable('agri_producers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  name: text('name').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  location: jsonb('location'),
  cooperativeId: uuid('cooperative_id'),
  status: agriProducerStatusEnum('status').notNull().default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 2) agri_cooperatives ────────────────────────────────────────────────────

export const agriCooperatives = pgTable('agri_cooperatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  name: text('name').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  location: jsonb('location'),
  memberCount: integer('member_count').notNull().default(0),
  status: agriProducerStatusEnum('status').notNull().default('active'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 3) agri_crops ───────────────────────────────────────────────────────────

export const agriCrops = pgTable('agri_crops', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  name: text('name').notNull(),
  cropType: agriCropTypeEnum('crop_type').notNull(),
  unitOfMeasure: agriUnitOfMeasureEnum('unit_of_measure').notNull(),
  baselineYieldPerHectare: numeric('baseline_yield_per_hectare', { precision: 12, scale: 2 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 4) agri_harvests ────────────────────────────────────────────────────────

export const agriHarvests = pgTable('agri_harvests', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  producerId: uuid('producer_id')
    .notNull()
    .references(() => agriProducers.id),
  cropId: uuid('crop_id')
    .notNull()
    .references(() => agriCrops.id),
  season: varchar('season', { length: 20 }).notNull(),
  harvestDate: date('harvest_date').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull(),
  geoPoint: jsonb('geo_point'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 5) agri_lots ────────────────────────────────────────────────────────────

export const agriLots = pgTable('agri_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  ref: varchar('ref', { length: 30 }).notNull(),
  cropId: uuid('crop_id')
    .notNull()
    .references(() => agriCrops.id),
  season: varchar('season', { length: 20 }).notNull(),
  totalWeight: numeric('total_weight', { precision: 14, scale: 4 }).notNull(),
  status: agriLotStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 6) agri_lot_contributions ───────────────────────────────────────────────

export const agriLotContributions = pgTable('agri_lot_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => agriLots.id),
  harvestId: uuid('harvest_id')
    .notNull()
    .references(() => agriHarvests.id),
  weight: numeric('weight', { precision: 14, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 7) agri_inspections ─────────────────────────────────────────────────────

export const agriInspections = pgTable('agri_inspections', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => agriLots.id),
  inspectorId: uuid('inspector_id').notNull(),
  grade: text('grade'),
  score: numeric('score', { precision: 5, scale: 2 }),
  defects: jsonb('defects').default({}),
  notes: text('notes'),
  inspectedAt: timestamp('inspected_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 8) agri_warehouses ──────────────────────────────────────────────────────

export const agriWarehouses = pgTable('agri_warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  name: text('name').notNull(),
  location: jsonb('location'),
  capacity: numeric('capacity', { precision: 14, scale: 2 }),
  status: agriWarehouseStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 9) agri_batches ─────────────────────────────────────────────────────────

export const agriBatches = pgTable('agri_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  ref: varchar('ref', { length: 30 }).notNull(),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => agriWarehouses.id),
  cropId: uuid('crop_id')
    .notNull()
    .references(() => agriCrops.id),
  totalWeight: numeric('total_weight', { precision: 14, scale: 4 }).notNull(),
  availableWeight: numeric('available_weight', { precision: 14, scale: 4 }).notNull(),
  status: agriBatchStatusEnum('status').notNull().default('available'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 10) agri_batch_allocations ──────────────────────────────────────────────

export const agriBatchAllocations = pgTable('agri_batch_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => agriBatches.id),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => agriLots.id),
  weight: numeric('weight', { precision: 14, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 11) agri_shipments ──────────────────────────────────────────────────────

export const agriShipments = pgTable('agri_shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  ref: varchar('ref', { length: 30 }).notNull(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => agriBatches.id),
  destination: jsonb('destination').notNull(),
  allocatedWeight: numeric('allocated_weight', { precision: 14, scale: 4 }).notNull(),
  status: agriShipmentStatusEnum('status').notNull().default('planned'),
  plannedDeparture: timestamp('planned_departure', { withTimezone: true }),
  plannedArrival: timestamp('planned_arrival', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 12) agri_shipment_milestones ────────────────────────────────────────────

export const agriShipmentMilestones = pgTable('agri_shipment_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  shipmentId: uuid('shipment_id')
    .notNull()
    .references(() => agriShipments.id),
  milestone: text('milestone').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  actorId: uuid('actor_id').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 13) agri_payment_plans ──────────────────────────────────────────────────

export const agriPaymentPlans = pgTable('agri_payment_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => agriLots.id),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: agriPaymentPlanStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 14) agri_payments ───────────────────────────────────────────────────────

export const agriPayments = pgTable('agri_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  planId: uuid('plan_id')
    .notNull()
    .references(() => agriPaymentPlans.id),
  producerId: uuid('producer_id')
    .notNull()
    .references(() => agriProducers.id),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  method: agriPaymentMethodEnum('method').notNull(),
  reference: text('reference'),
  status: agriPaymentStatusEnum('status').notNull().default('pending'),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 15) agri_certifications ─────────────────────────────────────────────────

export const agriCertifications = pgTable('agri_certifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  lotId: uuid('lot_id')
    .notNull()
    .references(() => agriLots.id),
  certificationType: agriCertificationTypeEnum('certification_type').notNull(),
  certificateRef: text('certificate_ref'),
  contentHash: text('content_hash').notNull(),
  storageKey: text('storage_key'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 16) agri_traceability_links ─────────────────────────────────────────────

export const agriTraceabilityLinks = pgTable('agri_traceability_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  sourceType: agriTraceabilityEntityTypeEnum('source_type').notNull(),
  sourceId: uuid('source_id').notNull(),
  targetType: agriTraceabilityEntityTypeEnum('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  linkMetadata: jsonb('link_metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 17) agri_evidence_artifacts ─────────────────────────────────────────────

export const agriEvidenceArtifacts = pgTable('agri_evidence_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  evidenceType: agriEvidenceTypeEnum('evidence_type').notNull(),
  targetEntityId: uuid('entity_id').notNull(),
  packDigest: text('pack_digest').notNull(),
  artifactsMerkleRoot: text('artifacts_merkle_root').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ══════════════════════════════════════════════════════════════════════════════
// ── Intelligence Tables ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── 18) agri_forecasts ──────────────────────────────────────────────────────

export const agriForecasts = pgTable('agri_forecasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  cropId: uuid('crop_id')
    .notNull()
    .references(() => agriCrops.id),
  season: varchar('season', { length: 20 }).notNull(),
  forecastType: agriForecastTypeEnum('forecast_type').notNull(),
  value: numeric('value', { precision: 18, scale: 4 }).notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  modelVersion: text('model_version').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 19) agri_price_signals ──────────────────────────────────────────────────

export const agriPriceSignals = pgTable('agri_price_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  cropType: text('crop_type').notNull(),
  market: text('market').notNull(),
  price: numeric('price', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  source: text('source').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 20) agri_risk_scores ────────────────────────────────────────────────────

export const agriRiskScores = pgTable('agri_risk_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  scope: agriRiskScopeEnum('scope').notNull(),
  scopeId: uuid('scope_id').notNull(),
  riskType: agriRiskTypeEnum('risk_type').notNull(),
  score: numeric('score', { precision: 5, scale: 2 }).notNull(),
  factors: jsonb('factors').default({}),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

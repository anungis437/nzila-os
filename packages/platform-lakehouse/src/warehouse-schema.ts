/**
 * @nzila/platform-lakehouse — Unified Warehouse Schema
 *
 * Zod schemas for the Nzila Knowledge Lakehouse unified reporting layer.
 * These schemas define the canonical shape of data in the warehouse —
 * cross-product metrics, deal pipeline, funding applications, partner map,
 * and data source sync metadata.
 *
 * These are designed to map to a unified PostgreSQL reporting schema
 * (separate from per-app transactional schemas) for analytics and intelligence.
 *
 * Table mapping:
 *   warehouseProductMetric  → lh_product_metrics
 *   warehouseDealEntry      → lh_deal_pipeline
 *   warehouseFundingApp     → lh_funding_applications
 *   warehousePartner        → lh_partner_map
 *   warehouseDataSourceSync → lh_data_source_syncs
 *   warehousePublicDataDoc  → lh_public_data_documents
 */
import { z } from 'zod'

// ── Product Metrics ─────────────────────────────────────────────────────────
// lh_product_metrics: unified cross-app usage metrics

export const warehouseProductMetricSchema = z.object({
  /** UUID */
  id: z.string().uuid(),
  /** Nzila product (union-eyes, flow, zonga, etc.) */
  domain: z.enum(['union-eyes', 'flow', 'zonga', 'faircase', 'agrimo', 'mobility', 'cfo', 'platform']),
  /** Organization/tenant ID */
  orgId: z.string(),
  /** Metric name (e.g. "active_members", "grievances_filed", "transactions_processed") */
  metricName: z.string(),
  /** Numeric value */
  value: z.number(),
  /** ISO date string for the reporting period (start of period) */
  periodStart: z.string().datetime(),
  /** ISO date string for the reporting period (end of period) */
  periodEnd: z.string().datetime(),
  /** Granularity of the period */
  periodGranularity: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']),
  /** Additional context / dimensions */
  dimensions: z.record(z.string(), z.unknown()).optional(),
  /** When this metric was computed */
  computedAt: z.string().datetime(),
})

export type WarehouseProductMetric = z.infer<typeof warehouseProductMetricSchema>

// ── Deal Pipeline Entry ─────────────────────────────────────────────────────
// lh_deal_pipeline: augmented deal view including non-commercial agreements

export const warehouseDealEntrySchema = z.object({
  id: z.string().uuid(),
  /** Deal or agreement name */
  name: z.string(),
  /** Source system (deal-engine, manual, hubspot) */
  sourceSystem: z.enum(['deal-engine', 'manual', 'hubspot']),
  /** Reference ID in source system */
  sourceId: z.string().nullable(),
  /** Nzila product domain */
  domain: z.enum(['union-eyes', 'flow', 'zonga', 'faircase', 'agrimo', 'mobility', 'cfo', 'platform']),
  /** Agreement type */
  agreementType: z.enum([
    'saas',
    'pilot',
    'distribution',
    'white_label',
    'joint_venture',
    'research',
    'data_sharing',
    'sponsorship',
    'procurement',
    'grant',
  ]),
  /** Counter-party organization name */
  counterpartyName: z.string(),
  /** Counter-party type */
  counterpartyType: z.enum([
    'union',
    'employer',
    'government',
    'foundation',
    'insurer',
    'bank',
    'university',
    'ngo',
    'sme',
    'enterprise',
    'other',
  ]),
  /** Current stage */
  stage: z.enum([
    'prospect',
    'qualified',
    'proposal',
    'negotiation',
    'legal_review',
    'signed',
    'active',
    'closed_won',
    'closed_lost',
  ]),
  /** Estimated CAD value (may be 0 for non-commercial agreements) */
  estimatedValueCad: z.number().min(0),
  /** Deal owner / responsible Nzila person */
  owner: z.string(),
  /** Probability of close (0–100) */
  probability: z.number().min(0).max(100).nullable(),
  /** Expected close date */
  expectedCloseDate: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type WarehouseDealEntry = z.infer<typeof warehouseDealEntrySchema>

// ── Funding Application ─────────────────────────────────────────────────────
// lh_funding_applications: tracks all funding applications in flight or planned

export const warehouseFundingApplicationSchema = z.object({
  id: z.string().uuid(),
  /** Reference to a FundingProgram.id in the funding-radar catalog */
  programId: z.string(),
  programName: z.string(),
  agency: z.string(),
  /** Nzila products this application covers */
  domains: z.array(
    z.enum(['union-eyes', 'flow', 'zonga', 'faircase', 'agrimo', 'mobility', 'cfo', 'platform']),
  ),
  /** Application lifecycle stage */
  status: z.enum([
    'identified',
    'researching',
    'drafting',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'withdrawn',
    'deferred',
  ]),
  /** Requested amount in CAD */
  requestedAmountCad: z.number().nullable(),
  /** Awarded amount (populated after decision) */
  awardedAmountCad: z.number().nullable(),
  /** Application submission deadline */
  deadline: z.string().datetime().nullable(),
  /** Date submitted */
  submittedAt: z.string().datetime().nullable(),
  /** Decision date */
  decisionAt: z.string().datetime().nullable(),
  /** Lead person responsible for this application */
  lead: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type WarehouseFundingApplication = z.infer<typeof warehouseFundingApplicationSchema>

// ── Partner Map Entry ───────────────────────────────────────────────────────
// lh_partner_map: strategic partners, sponsors, resellers, research orgs

export const warehousePartnerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** Partner type */
  partnerType: z.enum([
    'reseller',
    'white_label_customer',
    'sponsor',
    'research',
    'data_partner',
    'integration',
    'channel',
    'ecosystem',
  ]),
  /** Primary Nzila domain this partnership serves */
  primaryDomain: z.enum([
    'union-eyes',
    'flow',
    'zonga',
    'faircase',
    'agrimo',
    'mobility',
    'cfo',
    'platform',
  ]),
  /** Relationship status */
  status: z.enum(['prospect', 'engaged', 'active', 'paused', 'terminated']),
  /** Annual CAD value of this partnership (sponsorship, revenue share, etc.) */
  annualValueCad: z.number().nullable(),
  /** Primary contact name */
  contactName: z.string().nullable(),
  contactEmail: z.string().email().nullable(),
  /** Nzila relationship owner */
  owner: z.string(),
  /** Relevant agreement types in play */
  agreementTypes: z.array(
    z.enum([
      'pilot',
      'distribution',
      'white_label',
      'joint_venture',
      'research',
      'data_sharing',
      'sponsorship',
      'procurement',
    ]),
  ),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type WarehousePartner = z.infer<typeof warehousePartnerSchema>

// ── Data Source Sync Metadata ───────────────────────────────────────────────
// lh_data_source_syncs: metadata catalog — tracks what was ingested and when

export const warehouseDataSourceSyncSchema = z.object({
  id: z.string().uuid(),
  /** Reference to DataSourceDescriptor.id in the catalog */
  sourceId: z.string(),
  sourceName: z.string(),
  sourceCategory: z.enum([
    'open_government',
    'procurement',
    'labour',
    'legal',
    'corporate',
    'cultural',
    'financial',
    'app_telemetry',
    'crm',
    'market_intelligence',
  ]),
  /** Ingestion run result */
  status: z.enum(['success', 'partial', 'failed', 'skipped']),
  /** Total records ingested in this run */
  recordsIngested: z.number().int().min(0),
  /** Bytes stored */
  bytesIngested: z.number().int().min(0).nullable(),
  /** Storage destination (e.g. "azure-blob:nzilacanadastore/lakehouse/labour/") */
  storageDestination: z.string().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
})

export type WarehouseDataSourceSync = z.infer<typeof warehouseDataSourceSyncSchema>

// ── Public Data Document ────────────────────────────────────────────────────
// lh_public_data_documents: document index for public data ingested

export const warehousePublicDataDocSchema = z.object({
  id: z.string().uuid(),
  /** Source the document came from */
  sourceId: z.string(),
  sourceName: z.string(),
  /** Unique identifier within the source */
  externalId: z.string(),
  /** Document title */
  title: z.string(),
  /** Plain text content (for search indexing) */
  textContent: z.string(),
  /** Structured metadata extracted from the document */
  structuredData: z.record(z.string(), z.unknown()).optional(),
  /** Source URL or path */
  sourceUrl: z.string().nullable(),
  /** Document date (publication or effective date) */
  documentDate: z.string().datetime().nullable(),
  /** Category for routing to intelligence pipelines */
  category: z.enum([
    'open_government',
    'procurement',
    'labour',
    'legal',
    'corporate',
    'cultural',
    'financial',
    'app_telemetry',
    'crm',
    'market_intelligence',
  ]),
  /** Which Nzila domains this document is relevant to */
  relevantDomains: z.array(
    z.enum(['union-eyes', 'flow', 'zonga', 'faircase', 'agrimo', 'mobility', 'cfo', 'platform']),
  ),
  ingestedAt: z.string().datetime(),
})

export type WarehousePublicDataDoc = z.infer<typeof warehousePublicDataDocSchema>

// ── PostgreSQL DDL Hints ────────────────────────────────────────────────────
// These are the canonical table names for the unified reporting schema.
// Migrations should live in a dedicated lakehouse migration set.

export const WAREHOUSE_TABLES = {
  PRODUCT_METRICS: 'lh_product_metrics',
  DEAL_PIPELINE: 'lh_deal_pipeline',
  FUNDING_APPLICATIONS: 'lh_funding_applications',
  PARTNER_MAP: 'lh_partner_map',
  DATA_SOURCE_SYNCS: 'lh_data_source_syncs',
  PUBLIC_DATA_DOCUMENTS: 'lh_public_data_documents',
} as const

export type WarehouseTable = (typeof WAREHOUSE_TABLES)[keyof typeof WAREHOUSE_TABLES]

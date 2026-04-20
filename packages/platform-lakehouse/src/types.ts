/**
 * @nzila/platform-lakehouse — Core Types
 *
 * The Nzila Knowledge Lakehouse is the unified data intelligence layer that
 * aggregates app telemetry, public data sources, funding intelligence,
 * deal pipeline, and partner data into a single queryable warehouse.
 *
 * Architecture:
 *   Sources → Ingestion (ingestion-core) → Data Fabric (platform-data-fabric)
 *           → Warehouse Schema (this package) → Intelligence (platform-intelligence)
 */
import { z } from 'zod'

// ── Product Domains ─────────────────────────────────────────────────────────

export const WarehouseDomains = {
  UNION_EYES: 'union-eyes',
  FLOW: 'flow',
  ZONGA: 'zonga',
  FAIRCASE: 'faircase',
  AGRIMO: 'agrimo',
  MOBILITY: 'mobility',
  CFO: 'cfo',
  PLATFORM: 'platform',
} as const

export type WarehouseDomain =
  (typeof WarehouseDomains)[keyof typeof WarehouseDomains]

// ── Data Source Categories ──────────────────────────────────────────────────

export const DataSourceCategories = {
  OPEN_GOVERNMENT: 'open_government',
  PROCUREMENT: 'procurement',
  LABOUR: 'labour',
  LEGAL: 'legal',
  CORPORATE: 'corporate',
  CULTURAL: 'cultural',
  FINANCIAL: 'financial',
  APP_TELEMETRY: 'app_telemetry',
  CRM: 'crm',
  MARKET_INTELLIGENCE: 'market_intelligence',
} as const

export type DataSourceCategory =
  (typeof DataSourceCategories)[keyof typeof DataSourceCategories]

// ── Data Source Formats ─────────────────────────────────────────────────────

export const DataSourceFormats = {
  CSV: 'csv',
  JSON: 'json',
  XML: 'xml',
  API: 'api',
  RSS: 'rss',
  HTML: 'html',
  PARQUET: 'parquet',
  PDF: 'pdf',
} as const

export type DataSourceFormat =
  (typeof DataSourceFormats)[keyof typeof DataSourceFormats]

// ── Refresh Cadences ────────────────────────────────────────────────────────

export const RefreshCadences = {
  REAL_TIME: 'real_time',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ON_DEMAND: 'on_demand',
} as const

export type RefreshCadence =
  (typeof RefreshCadences)[keyof typeof RefreshCadences]

// ── Funding Types ───────────────────────────────────────────────────────────

export const FundingTypes = {
  GRANT: 'grant',
  TAX_CREDIT: 'tax_credit',
  REPAYABLE_CONTRIBUTION: 'repayable_contribution',
  NON_REPAYABLE_CONTRIBUTION: 'non_repayable_contribution',
  LOAN: 'loan',
  SPONSORSHIP: 'sponsorship',
} as const

export type FundingType = (typeof FundingTypes)[keyof typeof FundingTypes]

// ── Funding Governments ─────────────────────────────────────────────────────

export const FundingGovernments = {
  FEDERAL: 'federal',
  ONTARIO: 'ontario',
  QUEBEC: 'quebec',
  BC: 'bc',
  ALBERTA: 'alberta',
  OTHER_PROVINCIAL: 'other_provincial',
  MUNICIPAL: 'municipal',
  FOUNDATION: 'foundation',
} as const

export type FundingGovernment =
  (typeof FundingGovernments)[keyof typeof FundingGovernments]

// ── Strategic Agreement Types ───────────────────────────────────────────────

export const StrategicAgreementTypes = {
  PILOT: 'pilot',
  DISTRIBUTION: 'distribution',
  WHITE_LABEL: 'white_label',
  JOINT_VENTURE: 'joint_venture',
  RESEARCH: 'research',
  DATA_SHARING: 'data_sharing',
  SPONSORSHIP: 'sponsorship',
  PROCUREMENT: 'procurement',
} as const

export type StrategicAgreementType =
  (typeof StrategicAgreementTypes)[keyof typeof StrategicAgreementTypes]

// ── Sponsor Categories ──────────────────────────────────────────────────────

export const SponsorCategories = {
  INSURANCE: 'insurance',
  BENEFITS_ADMIN: 'benefits_admin',
  PENSION: 'pension',
  TELECOM: 'telecom',
  BEVERAGE: 'beverage',
  BANKING: 'banking',
  REMITTANCE: 'remittance',
  PAYMENTS: 'payments',
  ACCOUNTING: 'accounting',
  APPAREL: 'apparel',
  AIRLINE: 'airline',
  SHIPPING: 'shipping',
  LABOUR_SERVICES: 'labour_services',
} as const

export type SponsorCategory =
  (typeof SponsorCategories)[keyof typeof SponsorCategories]

// ── Data Source Descriptor ──────────────────────────────────────────────────

export interface DataSourceDescriptor {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: DataSourceCategory
  readonly format: DataSourceFormat
  readonly cadence: RefreshCadence
  readonly url: string
  readonly licenseNote: string
  /** Which Nzila product domains benefit from this source */
  readonly relevantDomains: readonly WarehouseDomain[]
  /** What intelligence it enables (e.g. "grievance benchmarks") */
  readonly intelligenceUse: readonly string[]
  readonly requiresAuth: boolean
  readonly isPublic: boolean
}

// ── Funding Program ─────────────────────────────────────────────────────────

export interface FundingProgram {
  readonly id: string
  readonly name: string
  readonly agency: string
  readonly government: FundingGovernment
  readonly fundingType: FundingType
  readonly description: string
  /** Typical funding range in CAD */
  readonly typicalMinCad: number | null
  readonly typicalMaxCad: number | null
  readonly eligibilitySummary: string
  /** Eligibility notes specific to Nzila products */
  readonly nzilaFit: string
  readonly url: string
  /** Which Nzila domains this funding applies to */
  readonly relevantDomains: readonly WarehouseDomain[]
  /** Whether this is a recurring or one-time opportunity */
  readonly isRecurring: boolean
  /** Intake timing if known (e.g. "rolling" or "annual Q3") */
  readonly intakeTiming: string
}

// ── Sponsor Target ──────────────────────────────────────────────────────────

export interface SponsorTarget {
  readonly id: string
  readonly category: SponsorCategory
  readonly rationale: string
  /** Which Nzila products to sponsor */
  readonly targetDomains: readonly WarehouseDomain[]
  /** Suggested activation formats */
  readonly activationFormats: readonly string[]
}

// ── Lakehouse Ingestion Job ─────────────────────────────────────────────────

export const LakehouseIngestionStatuses = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  STALE: 'stale',
} as const

export type LakehouseIngestionStatus =
  (typeof LakehouseIngestionStatuses)[keyof typeof LakehouseIngestionStatuses]

export interface LakehouseIngestionJob {
  readonly id: string
  readonly sourceId: string
  readonly sourceName: string
  readonly sourceCategory: DataSourceCategory
  readonly status: LakehouseIngestionStatus
  readonly recordsIngested: number
  readonly startedAt: string
  readonly completedAt: string | null
  readonly errorMessage: string | null
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const dataSourceDescriptorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
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
  format: z.enum(['csv', 'json', 'xml', 'api', 'rss', 'html', 'parquet', 'pdf']),
  cadence: z.enum(['real_time', 'daily', 'weekly', 'monthly', 'quarterly', 'on_demand']),
  url: z.string().url(),
  licenseNote: z.string(),
  relevantDomains: z.array(
    z.enum(['union-eyes', 'flow', 'zonga', 'faircase', 'agrimo', 'mobility', 'cfo', 'platform']),
  ),
  intelligenceUse: z.array(z.string()),
  requiresAuth: z.boolean(),
  isPublic: z.boolean(),
})

export const fundingProgramSchema = z.object({
  id: z.string(),
  name: z.string(),
  agency: z.string(),
  government: z.enum([
    'federal',
    'ontario',
    'quebec',
    'bc',
    'alberta',
    'other_provincial',
    'municipal',
    'foundation',
  ]),
  fundingType: z.enum([
    'grant',
    'tax_credit',
    'repayable_contribution',
    'non_repayable_contribution',
    'loan',
    'sponsorship',
  ]),
  description: z.string(),
  typicalMinCad: z.number().nullable(),
  typicalMaxCad: z.number().nullable(),
  eligibilitySummary: z.string(),
  nzilaFit: z.string(),
  url: z.string().url(),
  relevantDomains: z.array(
    z.enum(['union-eyes', 'flow', 'zonga', 'faircase', 'agrimo', 'mobility', 'cfo', 'platform']),
  ),
  isRecurring: z.boolean(),
  intakeTiming: z.string(),
})

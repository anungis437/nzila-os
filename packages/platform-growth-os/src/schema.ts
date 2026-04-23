/**
 * @nzila/platform-growth-os — Drizzle schema (Phase-2 wiring stub)
 *
 * Mirrors the precedent set by `@nzila/platform-cognition-core/schema`:
 * canonical column shapes for the persistent growth-os store, NOT yet bound
 * to runtime IO (the runtime store is file-backed under `ops/growth-{entity}/`).
 *
 * The shape is fixed today so:
 *   1. Phase-2 migration is mechanical (file -> table swap).
 *   2. Other packages (`@nzila/db` introspection, governance audits) can
 *      reason about growth tables.
 *   3. DBAs can review and approve column types BEFORE migrations are
 *      authored under `migrations/`.
 *
 * No `relations()`, no `$inferSelect` / `$inferInsert` re-exports — pure shape.
 *
 * @module @nzila/platform-growth-os/schema
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// ── Brand voice ─────────────────────────────────────────────────────────────

export const growthBrandVoices = pgTable(
  'growth_brand_voices',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    label: text('label').notNull(),
    tone: text('tone').array().notNull().default(sql`ARRAY[]::text[]`),
    forbiddenPhrases: text('forbidden_phrases').array().notNull().default(sql`ARRAY[]::text[]`),
    trustPosture: text('trust_posture').notNull(),
    requiredDisclosures: text('required_disclosures').array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byScope: index('growth_brand_voice_scope_idx').on(t.tenantId, t.orgId),
  }),
)

// ── Audience segments ───────────────────────────────────────────────────────

export const growthAudienceSegments = pgTable(
  'growth_audience_segments',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    label: text('label').notNull(),
    description: text('description').notNull().default(''),
    predicates: jsonb('predicates').notNull(),
    estimatedSize: integer('estimated_size'),
    estimatedAt: timestamp('estimated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byScope: index('growth_audience_scope_idx').on(t.tenantId, t.orgId),
  }),
)

// ── Campaigns ───────────────────────────────────────────────────────────────

export const growthCampaigns = pgTable(
  'growth_campaigns',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    name: text('name').notNull(),
    objective: text('objective').notNull(),
    channels: text('channels').array().notNull(),
    audienceSegmentIds: text('audience_segment_ids').array().notNull().default(sql`ARRAY[]::text[]`),
    brandVoiceId: text('brand_voice_id').notNull(),
    offerIds: text('offer_ids').array().notNull().default(sql`ARRAY[]::text[]`),
    ownerId: uuid('owner_id'),
    status: text('status').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byScope: index('growth_campaign_scope_idx').on(t.tenantId, t.orgId),
    byStatus: index('growth_campaign_status_idx').on(t.status),
  }),
)

// ── Campaign runs ───────────────────────────────────────────────────────────

export const growthCampaignRuns = pgTable(
  'growth_campaign_runs',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    campaignId: text('campaign_id').notNull(),
    contentAssetId: text('content_asset_id').notNull(),
    audienceSize: integer('audience_size').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    result: jsonb('result'),
  },
  (t) => ({
    byCampaign: index('growth_run_campaign_idx').on(t.campaignId),
  }),
)

// ── Content assets ──────────────────────────────────────────────────────────

export const growthContentAssets = pgTable(
  'growth_content_assets',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    campaignId: text('campaign_id'),
    brandVoiceId: text('brand_voice_id').notNull(),
    channel: text('channel').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    sources: text('sources').array().notNull().default(sql`ARRAY[]::text[]`),
    approval: text('approval').notNull(),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byScope: index('growth_asset_scope_idx').on(t.tenantId, t.orgId),
    byApproval: index('growth_asset_approval_idx').on(t.approval),
  }),
)

// ── Commercial offers ───────────────────────────────────────────────────────

export const growthCommercialOffers = pgTable(
  'growth_commercial_offers',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    label: text('label').notNull(),
    offerProduct: text('offer_product').notNull(),
    buyerType: text('buyer_type').notNull(),
    pilotDurationDays: integer('pilot_duration_days'),
    pilotPriceCad: real('pilot_price_cad'),
    annualPriceLowCad: real('annual_price_low_cad'),
    annualPriceHighCad: real('annual_price_high_cad'),
    components: jsonb('components').notNull(),
    approval: text('approval').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byScope: index('growth_offer_scope_idx').on(t.tenantId, t.orgId),
  }),
)

// ── Lead scores ─────────────────────────────────────────────────────────────

export const growthLeadScores = pgTable(
  'growth_lead_scores',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    subjectKind: text('subject_kind').notNull(),
    subjectId: text('subject_id').notNull(),
    score: real('score').notNull(),
    stage: text('stage').notNull(),
    confidence: real('confidence').notNull(),
    contributions: jsonb('contributions').notNull(),
    modelVersion: text('model_version').notNull(),
    scoredAt: timestamp('scored_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    bySubject: index('growth_score_subject_idx').on(t.subjectKind, t.subjectId),
    byScoredAt: index('growth_score_scored_at_idx').on(t.scoredAt),
  }),
)

// ── Attribution events ──────────────────────────────────────────────────────

export const growthAttributionEvents = pgTable(
  'growth_attribution_events',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    subjectKind: text('subject_kind').notNull(),
    subjectId: text('subject_id').notNull(),
    kind: text('kind').notNull(),
    channel: text('channel'),
    campaignRunId: text('campaign_run_id'),
    partnerId: text('partner_id'),
    revenueCad: real('revenue_cad'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    bySubject: index('growth_attr_subject_idx').on(t.subjectKind, t.subjectId),
    byOccurred: index('growth_attr_occurred_idx').on(t.occurredAt),
  }),
)

// ── Proof requests ──────────────────────────────────────────────────────────

export const growthProofRequests = pgTable(
  'growth_proof_requests',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    subjectKind: text('subject_kind').notNull(),
    subjectId: text('subject_id').notNull(),
    proofKind: text('proof_kind').notNull(),
    customerLabel: text('customer_label'),
    status: text('status').notNull(),
    kpiBaselines: jsonb('kpi_baselines').notNull(),
    quoteText: text('quote_text'),
    quoteAttribution: text('quote_attribution'),
    permission: jsonb('permission'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedRef: text('published_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byScope: index('growth_proof_scope_idx').on(t.tenantId, t.orgId),
    byStatus: index('growth_proof_status_idx').on(t.status),
  }),
)

// ── Founder topics ──────────────────────────────────────────────────────────

export const growthFounderTopics = pgTable(
  'growth_founder_topics',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    ownerId: uuid('owner_id').notNull(),
    theme: text('theme').notNull(),
    audiences: text('audiences').array().notNull(),
    talkingPoints: text('talking_points').array().notNull(),
    sources: text('sources').array().notNull().default(sql`ARRAY[]::text[]`),
    cadenceDays: integer('cadence_days').notNull(),
    lastSurfacedAt: timestamp('last_surfaced_at', { withTimezone: true }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    byOwner: index('growth_topic_owner_idx').on(t.ownerId),
  }),
)

// ── Audit trail ─────────────────────────────────────────────────────────────

export const growthAuditEntries = pgTable(
  'growth_audit_entries',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    orgId: uuid('org_id').notNull(),
    product: text('product'),
    actor: uuid('actor').notNull(),
    action: text('action').notNull(),
    subjectKind: text('subject_kind').notNull(),
    subjectId: text('subject_id').notNull(),
    metadata: jsonb('metadata'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(sql`now()`),
    // marker so unused-import linters don't whine
    isAuditEntry: boolean('is_audit_entry').notNull().default(true),
  },
  (t) => ({
    bySubject: index('growth_audit_subject_idx').on(t.subjectKind, t.subjectId),
    byOccurred: index('growth_audit_occurred_idx').on(t.occurredAt),
  }),
)

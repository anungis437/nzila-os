/**
 * ARTIFACT TYPE: Database Schema
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Infrastructure
 *
 * Governance Entropy Workbook\u2122 (OCI P2) \u2014 Drizzle schema.
 *
 * Doctrine: continuity intelligence infrastructure, not surveillance.
 * - Pseudonymous by default. A workbook can exist with no user account.
 * - Hybrid claim model: on purchase, an opaque claim token + capture email
 *   are persisted, allowing the buyer to attach the workbook to their
 *   account (and resolve to an organization) at any time.
 * - Anti-surveillance: holder names and free-text notes never leave the
 *   database row. Only deterministic aggregates (Stewardship Density Index,
 *   load-bearing-without-successor counts) sync to CRM or appear in
 *   network-level intelligence.
 * - Forward-compatibility for P5 (OCI Intelligence Network): sectorBand and
 *   institutionSizeBand columns are voluntarily provided and enable future
 *   anonymized benchmarking without retroactive consent re-collection.
 *
 * Scope category: continuity observability / delegated read-model projection.
 * Registered in db/schema-cache/cache.ts. Topology entry in
 * docs/categories/platform-and-operations/architecture/orm-governance/canonical-schema-topology.md
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// Core workbook
// ─────────────────────────────────────────────────────────────────────────────

export const workbooks = pgTable(
  'workbooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    locale: varchar('locale', { length: 16 }).notNull().default('en-CA'),
    doctrineVersion: varchar('doctrine_version', { length: 16 }).notNull().default('1.0.0'),
    consent: jsonb('consent'),
    organizationContext: jsonb('organization_context'),
    // Forward-compatibility for P5 (anonymized benchmarking)
    sectorBand: varchar('sector_band', { length: 64 }),
    institutionSizeBand: varchar('institution_size_band', { length: 64 }),
    // Tier & claim
    reportTierId: varchar('report_tier_id', { length: 64 }),
    stripePaymentRef: varchar('stripe_payment_ref', { length: 128 }),
    claimEmail: varchar('claim_email', { length: 320 }),
    claimToken: varchar('claim_token', { length: 128 }),
    claimTokenExpiresAt: timestamp('claim_token_expires_at', { withTimezone: true }),
    claimedByUserId: text('claimed_by_user_id'),
    claimedOrgId: uuid('claimed_org_id'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    // UTM
    utmSource: varchar('utm_source', { length: 128 }),
    utmMedium: varchar('utm_medium', { length: 128 }),
    utmCampaign: varchar('utm_campaign', { length: 128 }),
    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('workbooks_status_idx').on(t.status),
    createdIdx: index('workbooks_created_idx').on(t.createdAt),
    claimedByIdx: index('workbooks_claimed_by_idx').on(t.claimedByUserId),
    claimTokenUniq: uniqueIndex('workbooks_claim_token_uniq').on(t.claimToken),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Module status (one row per workbook \u00d7 module)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookModules = pgTable(
  'workbook_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    moduleId: varchar('module_id', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('not_started'),
    payload: jsonb('payload'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_modules_workbook_idx').on(t.workbookId),
    moduleUniq: uniqueIndex('workbook_modules_workbook_module_uniq').on(
      t.workbookId,
      t.moduleId,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Institutional Memory Holders (vertical slice \u2014 the emotional center)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookMemoryHolders = pgTable(
  'workbook_memory_holders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 255 }).notNull(),
    displayName: text('display_name'),
    responsibility: text('responsibility').notNull(),
    tenureBand: varchar('tenure_band', { length: 32 }),
    criticality: varchar('criticality', { length: 32 }),
    successorIdentified: boolean('successor_identified').notNull().default(false),
    stewardshipDensity: numeric('stewardship_density', { precision: 5, scale: 2 }),
    notes: text('notes'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_memory_holders_workbook_idx').on(t.workbookId),
    criticalityIdx: index('workbook_memory_holders_criticality_idx').on(t.criticality),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Stewardship signals (engine output)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookStewardshipSignals = pgTable(
  'workbook_stewardship_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    signalId: varchar('signal_id', { length: 64 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    statement: text('statement').notNull(),
    evidence: jsonb('evidence'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_stewardship_signals_workbook_idx').on(t.workbookId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Governance Lineage (scaffold \u2014 Facilitated Edition module)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookGovernanceLineageEntries = pgTable(
  'workbook_governance_lineage_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    lineageId: varchar('lineage_id', { length: 64 }).notNull(),
    decisionDate: timestamp('decision_date', { withTimezone: true }),
    summary: text('summary').notNull(),
    interpretationNotes: text('interpretation_notes'),
    originatingHolderId: uuid('originating_holder_id').references(
      () => workbookMemoryHolders.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_governance_lineage_workbook_idx').on(t.workbookId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Continuity Breakpoints (scaffold)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookContinuityBreakpoints = pgTable(
  'workbook_continuity_breakpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    breakpointId: varchar('breakpoint_id', { length: 64 }).notNull(),
    scope: varchar('scope', { length: 64 }).notNull(),
    fragilityScore: numeric('fragility_score', { precision: 5, scale: 2 }),
    blastRadius: varchar('blast_radius', { length: 64 }),
    narrative: text('narrative'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_continuity_breakpoints_workbook_idx').on(t.workbookId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Modernization Alignment (scaffold)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookModernizationAlignment = pgTable(
  'workbook_modernization_alignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    axisId: varchar('axis_id', { length: 64 }).notNull(),
    modernizationVelocity: numeric('modernization_velocity', { precision: 5, scale: 2 }),
    continuityIntegrity: numeric('continuity_integrity', { precision: 5, scale: 2 }),
    gapScore: numeric('gap_score', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_modernization_alignment_workbook_idx').on(t.workbookId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Transformation Roadmap (scaffold)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookTransformationRoadmap = pgTable(
  'workbook_transformation_roadmap',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    horizon: varchar('horizon', { length: 32 }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    sequencingNotes: text('sequencing_notes'),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_transformation_roadmap_workbook_idx').on(t.workbookId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Purchases (audit trail of Stripe events)
// ─────────────────────────────────────────────────────────────────────────────

export const workbookPurchases = pgTable(
  'workbook_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workbookId: uuid('workbook_id')
      .notNull()
      .references(() => workbooks.id, { onDelete: 'cascade' }),
    stripePaymentRef: varchar('stripe_payment_ref', { length: 128 }).notNull(),
    tierId: varchar('tier_id', { length: 64 }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('CAD'),
    customerEmail: varchar('customer_email', { length: 320 }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workbookIdx: index('workbook_purchases_workbook_idx').on(t.workbookId),
    stripeRefUniq: uniqueIndex('workbook_purchases_stripe_ref_uniq').on(t.stripePaymentRef),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Module ID constants \u2014 canonical, consumed by routes/UI/engines
// ─────────────────────────────────────────────────────────────────────────────

export const WORKBOOK_MODULE_IDS = [
  'continuity_landscape',
  'memory_holders',
  'governance_lineage',
  'continuity_breakpoints',
  'modernization_alignment',
  'transformation_roadmap',
] as const;

export type WorkbookModuleId = (typeof WORKBOOK_MODULE_IDS)[number];

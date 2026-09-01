/**
 * ARTIFACT TYPE: Database Schema
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Infrastructure
 *
 * ICRA (Institutional Continuity Risk Assessment) — Drizzle schema.
 *
 * Doctrine: continuity intelligence infrastructure, not surveillance.
 * - Pseudonymous (uuid assessment id), no PII required.
 * - Replayable: each answer snapshots its weights + version.
 * - Anonymized benchmarks supported via benchmarkGroups + anonymizedMetrics.
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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const icraOrganizations = pgTable(
  'icra_organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: varchar('display_name', { length: 255 }),
    sector: varchar('sector', { length: 64 }),
    jurisdiction: varchar('jurisdiction', { length: 64 }),
    workforceBand: varchar('workforce_band', { length: 32 }),
    governanceModel: varchar('governance_model', { length: 32 }),
    federationAffiliation: varchar('federation_affiliation', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sectorIdx: index('icra_orgs_sector_idx').on(t.sector),
  }),
);

export const icraAssessments = pgTable(
  'icra_assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => icraOrganizations.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 16 }).notNull().default('in_progress'),
    questionBankVersion: integer('question_bank_version').notNull().default(1),
    doctrineVersion: varchar('doctrine_version', { length: 16 }).notNull().default('1.0.0'),
    consent: jsonb('consent'),
    organizationContext: jsonb('organization_context'),
    locale: varchar('locale', { length: 16 }).notNull().default('en-CA'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reportTierId: varchar('report_tier_id', { length: 64 }).notNull().default('continuity_reflection'),
    stripePaymentRef: varchar('stripe_payment_ref', { length: 255 }),
    claimEmail: varchar('claim_email', { length: 320 }),
    claimToken: varchar('claim_token', { length: 128 }),
    claimTokenExpiresAt: timestamp('claim_token_expires_at', { withTimezone: true }),
    claimedByUserId: varchar('claimed_by_user_id', { length: 128 }),
    claimedOrgId: uuid('claimed_org_id'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    utmSource: varchar('utm_source', { length: 128 }),
    utmMedium: varchar('utm_medium', { length: 128 }),
    utmCampaign: varchar('utm_campaign', { length: 128 }),
    // Bearer capability for the pseudonymous questionnaire/results flow —
    // only a hash is ever persisted here. See lib/icra/assessment-capability.ts.
    capabilityTokenHash: varchar('capability_token_hash', { length: 128 }),
    capabilityTokenExpiresAt: timestamp('capability_token_expires_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('icra_assessments_status_idx').on(t.status),
    createdIdx: index('icra_assessments_created_idx').on(t.createdAt),
    claimTokenIdx: index('icra_assessments_claim_token_idx').on(t.claimToken),
    capabilityTokenHashIdx: index('icra_assessments_capability_token_hash_idx').on(t.capabilityTokenHash),
  }),
);

export const icraAssessmentAnswers = pgTable(
  'icra_assessment_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => icraAssessments.id, { onDelete: 'cascade' }),
    questionId: varchar('question_id', { length: 64 }).notNull(),
    questionVersion: integer('question_version').notNull().default(1),
    rawValue: text('raw_value').notNull(),
    normalizedScore: numeric('normalized_score', { precision: 6, scale: 4 }).notNull(),
    weightsSnapshot: jsonb('weights_snapshot').notNull(),
    riskInverted: boolean('risk_inverted').notNull().default(false),
    note: text('note'),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assessmentIdx: index('icra_answers_assessment_idx').on(t.assessmentId),
    questionIdx: index('icra_answers_question_idx').on(t.questionId),
  }),
);

export const icraMaturityProfiles = pgTable(
  'icra_maturity_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => icraAssessments.id, { onDelete: 'cascade' }),
    maturityBandId: varchar('maturity_band_id', { length: 64 }).notNull(),
    composite: numeric('composite', { precision: 5, scale: 2 }).notNull(),
    profilePayload: jsonb('profile_payload').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assessmentIdx: index('icra_profiles_assessment_idx').on(t.assessmentId),
    bandIdx: index('icra_profiles_band_idx').on(t.maturityBandId),
  }),
);

export const icraContinuityScores = pgTable(
  'icra_continuity_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => icraAssessments.id, { onDelete: 'cascade' }),
    dimensionId: varchar('dimension_id', { length: 64 }).notNull(),
    score: numeric('score', { precision: 5, scale: 2 }).notNull(),
    contributingQuestions: integer('contributing_questions').notNull(),
    weightTotal: numeric('weight_total', { precision: 6, scale: 3 }).notNull(),
  },
  (t) => ({
    assessmentIdx: index('icra_scores_assessment_idx').on(t.assessmentId),
    dimensionIdx: index('icra_scores_dimension_idx').on(t.dimensionId),
  }),
);

export const icraGovernanceFlags = pgTable(
  'icra_governance_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => icraAssessments.id, { onDelete: 'cascade' }),
    flagId: varchar('flag_id', { length: 64 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    statement: text('statement').notNull(),
    evidence: jsonb('evidence'),
  },
  (t) => ({
    assessmentIdx: index('icra_flags_assessment_idx').on(t.assessmentId),
    severityIdx: index('icra_flags_severity_idx').on(t.severity),
  }),
);

export const icraOperationalIndicators = pgTable(
  'icra_operational_indicators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => icraAssessments.id, { onDelete: 'cascade' }),
    indicatorId: varchar('indicator_id', { length: 64 }).notNull(),
    value: numeric('value', { precision: 8, scale: 3 }),
    payload: jsonb('payload'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assessmentIdx: index('icra_indicators_assessment_idx').on(t.assessmentId),
  }),
);

export const icraFollowupRecommendations = pgTable(
  'icra_followup_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => icraAssessments.id, { onDelete: 'cascade' }),
    recommendationId: varchar('recommendation_id', { length: 64 }).notNull(),
    kind: varchar('kind', { length: 64 }).notNull(),
    title: varchar('title', { length: 256 }).notNull(),
    description: text('description').notNull(),
    ctaLabel: varchar('cta_label', { length: 128 }).notNull(),
    ctaHref: varchar('cta_href', { length: 512 }).notNull(),
  },
  (t) => ({
    assessmentIdx: index('icra_recos_assessment_idx').on(t.assessmentId),
  }),
);

export const icraBenchmarkGroups = pgTable(
  'icra_benchmark_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    sector: varchar('sector', { length: 64 }),
    jurisdiction: varchar('jurisdiction', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const icraAnonymizedMetrics = pgTable(
  'icra_anonymized_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    benchmarkGroupId: uuid('benchmark_group_id').references(() => icraBenchmarkGroups.id, {
      onDelete: 'set null',
    }),
    dimensionId: varchar('dimension_id', { length: 64 }).notNull(),
    metricKey: varchar('metric_key', { length: 64 }).notNull(),
    value: numeric('value', { precision: 8, scale: 3 }).notNull(),
    sampleSize: integer('sample_size').notNull().default(0),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    groupIdx: index('icra_metrics_group_idx').on(t.benchmarkGroupId),
    dimensionIdx: index('icra_metrics_dimension_idx').on(t.dimensionId),
  }),
);

export type IcraAssessment = typeof icraAssessments.$inferSelect;
export type NewIcraAssessment = typeof icraAssessments.$inferInsert;
export type IcraAnswer = typeof icraAssessmentAnswers.$inferSelect;
export type IcraProfile = typeof icraMaturityProfiles.$inferSelect;

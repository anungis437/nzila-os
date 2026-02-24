/**
 * Marketing & Growth Engine Schema
 * 
 * Database schema for:
 * - Impact metrics and analytics
 * - Case studies and testimonials
 * - Pilot program management
 * - Organizer recognition
 * - Movement insights (privacy-preserving)
 */

import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, pgEnum, numeric, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const metricTypeEnum = pgEnum('metric_type', [
  'time-to-resolution',
  'escalation-rate',
  'member-satisfaction',
  'organizer-workload',
  'democratic-participation',
  'governance-engagement',
]);

export const metricVisibilityEnum = pgEnum('metric_visibility', [
  'public',
  'pilot-only',
  'internal',
]);

export const caseStudyCategoryEnum = pgEnum('case_study_category', [
  'pilot',
  'success-story',
  'before-after',
  'transformation',
]);

export const pilotStatusEnum = pgEnum('pilot_status', [
  'submitted',
  'review',
  'approved',
  'active',
  'completed',
  'declined',
]);

export const recognitionEventTypeEnum = pgEnum('recognition_event_type', [
  'case-win',
  'member-feedback',
  'peer-recognition',
  'milestone',
]);

export const movementTrendCategoryEnum = pgEnum('movement_trend_category', [
  'grievance-type',
  'resolution-pattern',
  'systemic-issue',
  'sector-trend',
  'jurisdiction-pattern',
]);

export const testimonialTypeEnum = pgEnum('testimonial_type', [
  'organizer',
  'member',
  'executive',
  'partner',
]);

// ============================================================================
// IMPACT METRICS
// ============================================================================

export const impactMetrics = pgTable(
  'impact_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    metricType: metricTypeEnum('metric_type').notNull(),
    value: numeric('value', { precision: 10, scale: 2 }).notNull(),
    comparisonValue: numeric('comparison_value', { precision: 10, scale: 2 }),
    unit: text('unit').notNull(),
    period: text('period').notNull(), // ISO date range string
    visibility: metricVisibilityEnum('visibility').notNull().default('internal'),
    anonymized: boolean('anonymized').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgMetricTypeIdx: index('impact_metrics_org_metric_type_idx').on(
      table.organizationId,
      table.metricType
    ),
    visibilityIdx: index('impact_metrics_visibility_idx').on(table.visibility),
  })
);

// ============================================================================
// CASE STUDIES
// ============================================================================

export const caseStudies = pgTable(
  'case_studies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    organizationType: text('organization_type').notNull(), // 'clc', 'local', etc.
    category: caseStudyCategoryEnum('category').notNull(),
    summary: text('summary').notNull(),
    challenge: text('challenge').notNull(),
    solution: text('solution').notNull(),
    outcome: text('outcome').notNull(),
    metrics: jsonb('metrics').notNull().$type<Array<{
      label: string;
      before: number;
      after: number;
      unit: string;
      improvement?: string;
    }>>(),
    testimonial: jsonb('testimonial').$type<{
      quote: string;
      author: string;
      role: string;
      organization?: string;
      photo?: string;
    }>(),
    visibility: text('visibility').notNull().default('public'), // 'public' | 'authenticated'
    featured: boolean('featured').notNull().default(false),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index('case_studies_category_idx').on(table.category),
    featuredIdx: index('case_studies_featured_idx').on(table.featured),
    publishedIdx: index('case_studies_published_idx').on(table.publishedAt),
  })
);

// ============================================================================
// TESTIMONIALS
// ============================================================================

export const testimonials = pgTable(
  'testimonials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: testimonialTypeEnum('type').notNull(),
    quote: text('quote').notNull(),
    author: text('author').notNull(),
    role: text('role').notNull(),
    organization: text('organization'),
    organizationType: text('organization_type'),
    photo: text('photo'),
    featured: boolean('featured').notNull().default(false),
    visibility: text('visibility').notNull().default('public'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    approvedAt: timestamp('approved_at'),
  },
  (table) => ({
    typeIdx: index('testimonials_type_idx').on(table.type),
    featuredIdx: index('testimonials_featured_idx').on(table.featured),
  })
);

// ============================================================================
// PILOT PROGRAM
// ============================================================================

export const pilotApplications = pgTable(
  'pilot_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationName: text('organization_name').notNull(),
    organizationType: text('organization_type').notNull(),
    contactName: text('contact_name').notNull(),
    contactEmail: text('contact_email').notNull(),
    contactPhone: text('contact_phone'),
    memberCount: integer('member_count').notNull(),
    jurisdictions: text('jurisdictions').array().notNull(),
    sectors: text('sectors').array().notNull(),
    currentSystem: text('current_system'),
    challenges: text('challenges').array().notNull(),
    goals: text('goals').array().notNull(),
    readinessScore: numeric('readiness_score', { precision: 5, scale: 2 }),
    status: pilotStatusEnum('status').notNull().default('submitted'),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at'),
    approvedAt: timestamp('approved_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responses: jsonb('responses').notNull().default({}).$type<Record<string, any>>(),
    notes: text('notes'),
  },
  (table) => ({
    statusIdx: index('pilot_applications_status_idx').on(table.status),
    submittedIdx: index('pilot_applications_submitted_idx').on(table.submittedAt),
  })
);

export const pilotMetrics = pgTable(
  'pilot_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pilotId: uuid('pilot_id')
      .references(() => pilotApplications.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    enrollmentDate: timestamp('enrollment_date').notNull(),
    daysActive: integer('days_active').notNull().default(0),
    organizerAdoptionRate: numeric('organizer_adoption_rate', {
      precision: 5,
      scale: 2,
    }).notNull(),
    memberEngagementRate: numeric('member_engagement_rate', {
      precision: 5,
      scale: 2,
    }).notNull(),
    casesManaged: integer('cases_managed').notNull().default(0),
    avgTimeToResolution: numeric('avg_time_to_resolution', {
      precision: 10,
      scale: 2,
    }).notNull(),
    healthScore: numeric('health_score', { precision: 5, scale: 2 }).notNull(),
    milestones: jsonb('milestones').notNull().$type<Array<{
      name: string;
      description: string;
      targetDate?: string;
      completedAt?: string;
      status: 'pending' | 'in-progress' | 'complete' | 'blocked';
    }>>(),
    lastCalculated: timestamp('last_calculated').defaultNow().notNull(),
  },
  (table) => ({
    pilotIdIdx: index('pilot_metrics_pilot_id_idx').on(table.pilotId),
    healthScoreIdx: index('pilot_metrics_health_score_idx').on(table.healthScore),
  })
);

// ============================================================================
// ORGANIZER RECOGNITION
// ============================================================================

export const organizerImpacts = pgTable(
  'organizer_impacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(), // references auth.users
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    casesHandled: integer('cases_handled').notNull().default(0),
    casesWon: integer('cases_won').notNull().default(0),
    avgResolutionTime: numeric('avg_resolution_time', {
      precision: 10,
      scale: 2,
    }).notNull(),
    memberSatisfactionAvg: numeric('member_satisfaction_avg', {
      precision: 3,
      scale: 2,
    }).notNull(),
    escalationsAvoided: integer('escalations_avoided').notNull().default(0),
    democraticParticipationRate: numeric('democratic_participation_rate', {
      precision: 5,
      scale: 2,
    }).notNull(),
    recognitionEvents: jsonb('recognition_events').notNull().$type<Array<{
      type: string;
      description: string;
      date: string;
      relatedCaseId?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata?: Record<string, any>;
    }>>(),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userOrgIdx: index('organizer_impacts_user_org_idx').on(
      table.userId,
      table.organizationId
    ),
    periodIdx: index('organizer_impacts_period_idx').on(table.periodStart, table.periodEnd),
  })
);

// ============================================================================
// MOVEMENT INSIGHTS
// ============================================================================

export const dataAggregationConsent = pgTable(
  'data_aggregation_consent',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    consentGiven: boolean('consent_given').notNull().default(false),
    consentDate: timestamp('consent_date').notNull(),
    categories: movementTrendCategoryEnum('categories').array().notNull(),
    expiresAt: timestamp('expires_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgConsentIdx: index('data_aggregation_consent_org_idx').on(table.organizationId),
  })
);

export const movementTrends = pgTable(
  'movement_trends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    category: movementTrendCategoryEnum('category').notNull(),
    dimension: text('dimension').notNull(), // e.g., 'harassment', 'scheduling'
    aggregatedCount: integer('aggregated_count').notNull(),
    organizationsContributing: integer('organizations_contributing').notNull(),
    timeframe: text('timeframe').notNull(), // 'last_30_days', 'last_90_days', etc.
    insights: text('insights').notNull(),
    legislativeBriefRelevance: boolean('legislative_brief_relevance')
      .notNull()
      .default(false),
    emergingPattern: boolean('emerging_pattern').notNull().default(false),
    confidenceLevel: text('confidence_level').notNull().default('medium'), // 'low' | 'medium' | 'high'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    categoryDimensionIdx: index('movement_trends_category_dimension_idx').on(
      table.category,
      table.dimension
    ),
    timeframeIdx: index('movement_trends_timeframe_idx').on(table.timeframe),
    emergingIdx: index('movement_trends_emerging_idx').on(table.emergingPattern),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const impactMetricsRelations = relations(impactMetrics, ({ one }) => ({
  organization: one(organizations, {
    fields: [impactMetrics.organizationId],
    references: [organizations.id],
  }),
}));

export const caseStudiesRelations = relations(caseStudies, ({ one }) => ({
  organization: one(organizations, {
    fields: [caseStudies.organizationId],
    references: [organizations.id],
  }),
}));

export const pilotApplicationsRelations = relations(pilotApplications, ({ many }) => ({
  metrics: many(pilotMetrics),
}));

export const pilotMetricsRelations = relations(pilotMetrics, ({ one }) => ({
  pilot: one(pilotApplications, {
    fields: [pilotMetrics.pilotId],
    references: [pilotApplications.id],
  }),
  organization: one(organizations, {
    fields: [pilotMetrics.organizationId],
    references: [organizations.id],
  }),
}));

export const organizerImpactsRelations = relations(organizerImpacts, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizerImpacts.organizationId],
    references: [organizations.id],
  }),
}));

export const dataAggregationConsentRelations = relations(
  dataAggregationConsent,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [dataAggregationConsent.organizationId],
      references: [organizations.id],
    }),
  })
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ImpactMetric = typeof impactMetrics.$inferSelect;
export type NewImpactMetric = typeof impactMetrics.$inferInsert;

export type CaseStudy = typeof caseStudies.$inferSelect;
export type NewCaseStudy = typeof caseStudies.$inferInsert;

export type Testimonial = typeof testimonials.$inferSelect;
export type NewTestimonial = typeof testimonials.$inferInsert;

export type PilotApplication = typeof pilotApplications.$inferSelect;
export type NewPilotApplication = typeof pilotApplications.$inferInsert;

export type PilotMetric = typeof pilotMetrics.$inferSelect;
export type NewPilotMetric = typeof pilotMetrics.$inferInsert;

export type OrganizerImpact = typeof organizerImpacts.$inferSelect;
export type NewOrganizerImpact = typeof organizerImpacts.$inferInsert;

export type DataAggregationConsent = typeof dataAggregationConsent.$inferSelect;
export type NewDataAggregationConsent = typeof dataAggregationConsent.$inferInsert;

export type MovementTrend = typeof movementTrends.$inferSelect;
export type NewMovementTrend = typeof movementTrends.$inferInsert;

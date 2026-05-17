import {
  pgEnum,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  numeric,
  varchar,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { orgs } from './orgs'

export const healthcareSurveyStatusEnum = pgEnum('healthcare_survey_status', [
  'draft',
  'active',
  'closed',
  'archived',
])

export const healthcareSurveyReviewStatusEnum = pgEnum('healthcare_survey_review_status', [
  'unreviewed',
  'reviewed',
  'flagged_for_redaction',
])

export const healthcareSurveyInsightTypeEnum = pgEnum('healthcare_survey_insight_type', [
  'top_pain_point',
  'top_workflow',
  'adoption_concern',
  'evidence_gap',
  'pilot_recommendation',
  'privacy_risk',
  'other',
])

export const healthcareSurveyConfidenceEnum = pgEnum('healthcare_survey_confidence', [
  'low',
  'medium',
  'high',
])

export const healthcareSurveys = pgTable(
  'healthcare_surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').references(() => orgs.id),
    campaignKey: text('campaign_key'),
    campaignName: text('campaign_name'),
    unitName: text('unit_name').notNull(),
    siteName: text('site_name'),
    localName: text('local_name').notNull(),
    championLabel: text('champion_label').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    audience: text('audience'),
    status: healthcareSurveyStatusEnum('status').notNull().default('draft'),
    anonymous: boolean('anonymous').notNull().default(true),
    allowFreeText: boolean('allow_free_text').notNull().default(true),
    purposeStatement: text('purpose_statement').notNull(),
    privacyNotice: text('privacy_notice').notNull(),
    internalNotes: text('internal_notes'),
    distributionMessage: text('distribution_message'),
    questions: jsonb('questions').notNull().default([]),
    templateKey: text('template_key').notNull().default('unit-scheduling'),
    shareToken: varchar('share_token', { length: 128 }),
    launchDate: timestamp('launch_date', { withTimezone: true }),
    closeDate: timestamp('close_date', { withTimezone: true }),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('healthcare_surveys_campaign_key_uidx').on(table.campaignKey),
    uniqueIndex('healthcare_surveys_share_token_uidx').on(table.shareToken),
    index('healthcare_surveys_org_idx').on(table.orgId),
    index('healthcare_surveys_status_idx').on(table.status),
  ],
)

export const healthcareSurveyResponses = pgTable(
  'healthcare_survey_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => healthcareSurveys.id, { onDelete: 'cascade' }),
    anonymousResponseId: uuid('anonymous_response_id').notNull().defaultRandom(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    answers: jsonb('answers').notNull().default({}),
    workflowScores: jsonb('workflow_scores').notNull().default({}),
    topPriority: text('top_priority'),
    concernTags: jsonb('concern_tags').notNull().default([]),
    containsFreeText: boolean('contains_free_text').notNull().default(false),
    reviewStatus: healthcareSurveyReviewStatusEnum('review_status').notNull().default('unreviewed'),
    redactionNote: text('redaction_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('healthcare_survey_responses_survey_idx').on(table.surveyId)],
)

export const healthcareSurveyInsights = pgTable(
  'healthcare_survey_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => healthcareSurveys.id, { onDelete: 'cascade' }),
    insightType: healthcareSurveyInsightTypeEnum('insight_type').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    supportingMetric: numeric('supporting_metric', { precision: 10, scale: 2 }),
    supportingCount: integer('supporting_count'),
    confidence: healthcareSurveyConfidenceEnum('confidence').notNull().default('low'),
    recommendedAction: text('recommended_action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('healthcare_survey_insights_survey_idx').on(table.surveyId)],
)

export const healthcareSurveyTemplates = pgTable(
  'healthcare_survey_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateKey: text('template_key').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    intendedUse: text('intended_use').notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    category: text('category').notNull(),
    introText: text('intro_text').notNull(),
    questions: jsonb('questions').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('healthcare_survey_templates_key_uidx').on(table.templateKey)],
)

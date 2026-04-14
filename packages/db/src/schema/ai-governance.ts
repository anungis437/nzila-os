/**
 * Nzila OS — AI governance persistence tables
 *
 * Durable backing store for @nzila/platform-ai-governance package state.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const aiGovernanceRiskLevelEnum = pgEnum('ai_governance_risk_level', [
  'low',
  'medium',
  'high',
])

export const aiGovernanceReviewStatusEnum = pgEnum('ai_governance_review_status', [
  'pending',
  'approved',
  'rejected',
])

export const aiGovernanceFlagPriorityEnum = pgEnum('ai_governance_flag_priority', [
  'low',
  'medium',
  'high',
  'critical',
])

export const aiGovernanceModels = pgTable(
  'ai_governance_models',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    version: text('version').notNull(),
    provider: text('provider').notNull(),
    capabilities: jsonb('capabilities').notNull().default([]),
    riskLevel: aiGovernanceRiskLevelEnum('risk_level').notNull(),
    approvedForProduction: boolean('approved_for_production').notNull().default(false),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull(),
    lastAuditedAt: timestamp('last_audited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_governance_models_name_version_provider').on(
      table.name,
      table.version,
      table.provider,
    ),
  ],
)

export const aiGovernancePromptVersions = pgTable(
  'ai_governance_prompt_versions',
  {
    id: uuid('id').primaryKey(),
    promptName: text('prompt_name').notNull(),
    version: integer('version').notNull(),
    template: text('template').notNull(),
    author: text('author').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    active: boolean('active').notNull().default(true),
    changeReason: text('change_reason').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_ai_governance_prompt_name_version').on(table.promptName, table.version),
    index('idx_ai_governance_prompt_name_active').on(table.promptName, table.active),
  ],
)

export const aiGovernanceDecisionLog = pgTable(
  'ai_governance_decision_log',
  {
    id: uuid('id').primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    modelId: text('model_id').notNull(),
    promptId: text('prompt_id').notNull(),
    app: text('app').notNull(),
    orgId: text('org_id').notNull(),
    inputSummary: text('input_summary').notNull(),
    outputSummary: text('output_summary').notNull(),
    confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
    requiresHumanReview: boolean('requires_human_review').notNull().default(true),
    reviewStatus: aiGovernanceReviewStatusEnum('review_status'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    modelVersion: text('model_version'),
    engineVersion: text('engine_version'),
    evidenceRefs: jsonb('evidence_refs').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_governance_decision_app').on(table.app),
    index('idx_ai_governance_decision_model').on(table.modelId),
    index('idx_ai_governance_decision_review_status').on(table.reviewStatus),
  ],
)

export const aiGovernanceReviewFlags = pgTable(
  'ai_governance_review_flags',
  {
    id: uuid('id').primaryKey(),
    decisionId: uuid('decision_id')
      .notNull()
      .references(() => aiGovernanceDecisionLog.id),
    reason: text('reason').notNull(),
    flaggedAt: timestamp('flagged_at', { withTimezone: true }).notNull(),
    flaggedBy: text('flagged_by').notNull(),
    priority: aiGovernanceFlagPriorityEnum('priority').notNull(),
    resolved: boolean('resolved').notNull().default(false),
    resolution: text('resolution'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_governance_flags_pending').on(table.resolved),
    index('idx_ai_governance_flags_decision').on(table.decisionId),
  ],
)

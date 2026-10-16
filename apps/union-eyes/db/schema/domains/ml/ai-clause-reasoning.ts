/**
 * AI Clause Reasoning Schema
 *
 * Stores AI-generated clause suggestions and relevance reasoning
 * for grievance handling.
 *
 * Each row links a grievance to a CBA clause with an AI-generated
 * explanation of why the clause is relevant.
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  jsonb,
  text,
  boolean,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';
import { grievances } from '../claims/grievances';

// ============================================================================
// ENUMS
// ============================================================================

export const clauseReasoningStatusEnum = pgEnum('clause_reasoning_status', [
  'suggested',
  'accepted',
  'rejected',
  'superseded',
]);

// ============================================================================
// TABLE
// ============================================================================

export const aiClauseReasonings = pgTable('ai_clause_reasonings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  grievanceId: uuid('grievance_id')
    .notNull()
    .references(() => grievances.id, { onDelete: 'cascade' }),

  // Referenced clause
  cbaId: uuid('cba_id'),
  clauseArticle: varchar('clause_article', { length: 100 }).notNull(),
  clauseSection: varchar('clause_section', { length: 100 }),
  clauseTitle: varchar('clause_title', { length: 500 }),
  clauseSnippet: text('clause_snippet'),

  // AI reasoning
  relevanceScore: decimal('relevance_score', { precision: 5, scale: 4 }).notNull(), // 0–1
  reasoning: text('reasoning').notNull(), // why this clause is relevant
  applicationNotes: text('application_notes'), // how it applies to this grievance
  precedentRefs: jsonb('precedent_refs').$type<Array<{ id: string; title: string; relevance: number }>>(),
  strengthAssessment: varchar('strength_assessment', { length: 20 }), // strong | moderate | weak

  // Explainability (mandatory)
  confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(),
  explanation: text('explanation').notNull(),
  factorsJson: jsonb('factors_json').$type<Array<{ name: string; weight: number; description: string }>>(),

  // Model metadata
  modelVersion: varchar('model_version', { length: 50 }).notNull(),
  profileKey: varchar('profile_key', { length: 100 }).notNull(),
  auditRef: varchar('audit_ref', { length: 120 }),

  // Human review
  status: clauseReasoningStatusEnum('status').notNull().default('suggested'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  humanApproved: boolean('human_approved').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('idx_ai_clause_reasonings_org').on(table.organizationId),
  grievanceIdx: index('idx_ai_clause_reasonings_grievance').on(table.grievanceId),
  statusIdx: index('idx_ai_clause_reasonings_status').on(table.status),
  relevanceIdx: index('idx_ai_clause_reasonings_relevance').on(table.relevanceScore),
}));

// ============================================================================
// TYPES
// ============================================================================

export type AiClauseReasoning = typeof aiClauseReasonings.$inferSelect;
export type AiClauseReasoningInsert = typeof aiClauseReasonings.$inferInsert;

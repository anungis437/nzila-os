/**
 * AI Copilot Sessions Schema
 *
 * Tracks steward copilot interactions: summaries, suggestions,
 * draft responses, and the human actor's accept/reject decisions.
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

// ============================================================================
// ENUMS
// ============================================================================

export const copilotActionTypeEnum = pgEnum('copilot_action_type', [
  'timeline_summary',
  'suggest_action',
  'draft_response',
  'explain_clause',
  'risk_brief',
  'custom_query',
]);

export const copilotOutcomeEnum = pgEnum('copilot_outcome', [
  'accepted',
  'edited',
  'rejected',
  'pending',
]);

// ============================================================================
// TABLE
// ============================================================================

export const aiCopilotSessions = pgTable('ai_copilot_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(), // the steward / officer
  userRole: varchar('user_role', { length: 50 }).notNull(), // steward | officer | admin

  // Request
  actionType: copilotActionTypeEnum('action_type').notNull(),
  relatedEntityType: varchar('related_entity_type', { length: 50 }), // grievance | employer | cba
  relatedEntityId: uuid('related_entity_id'),
  query: text('query'), // free-form question (for custom_query)

  // AI response
  responseText: text('response_text').notNull(),
  structuredOutput: jsonb('structured_output').$type<Record<string, unknown>>(),

  // Explainability (mandatory)
  confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(),
  explanation: text('explanation').notNull(),
  sourcesUsed: jsonb('sources_used').$type<Array<{ title: string; type: string; relevance: number }>>(),

  // Model metadata
  modelVersion: varchar('model_version', { length: 50 }).notNull(),
  profileKey: varchar('profile_key', { length: 100 }).notNull(),
  auditRef: varchar('audit_ref', { length: 120 }),

  // Human outcome
  outcome: copilotOutcomeEnum('outcome').notNull().default('pending'),
  editedResponse: text('edited_response'),
  feedbackRating: decimal('feedback_rating', { precision: 3, scale: 2 }), // 1-5
  feedbackNotes: text('feedback_notes'),
  humanApproved: boolean('human_approved').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('idx_ai_copilot_sessions_org').on(table.organizationId),
  userIdx: index('idx_ai_copilot_sessions_user').on(table.userId),
  actionIdx: index('idx_ai_copilot_sessions_action').on(table.actionType),
  outcomeIdx: index('idx_ai_copilot_sessions_outcome').on(table.outcome),
}));

// ============================================================================
// TYPES
// ============================================================================

export type AiCopilotSession = typeof aiCopilotSessions.$inferSelect;
export type AiCopilotSessionInsert = typeof aiCopilotSessions.$inferInsert;

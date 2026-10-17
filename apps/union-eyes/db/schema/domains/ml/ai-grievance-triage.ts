/**
 * AI Grievance Triage Schema
 *
 * Stores AI-generated triage assessments for grievances:
 * - priority recommendation
 * - category classification
 * - complexity estimate
 * - similar-grievance links
 *
 * CONSTRAINT: Every row carries confidence + explanation.
 * No triage result auto-applies — a human must approve.
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

export const aiTriageStatusEnum = pgEnum('ai_triage_status', [
  'pending',
  'accepted',
  'rejected',
  'superseded',
]);

export const aiComplexityEnum = pgEnum('ai_complexity', [
  'routine',
  'moderate',
  'complex',
  'unprecedented',
]);

// ============================================================================
// TABLE
// ============================================================================

export const aiGrievanceTriages = pgTable('ai_grievance_triages', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  grievanceId: uuid('grievance_id')
    .notNull()
    .references(() => grievances.id, { onDelete: 'cascade' }),

  // AI assessment
  suggestedPriority: varchar('suggested_priority', { length: 20 }).notNull(), // low | medium | high | urgent
  suggestedCategory: varchar('suggested_category', { length: 50 }).notNull(),
  complexity: aiComplexityEnum('complexity').notNull(),
  estimatedDaysToResolve: decimal('estimated_days_to_resolve'),
  suggestedStep: varchar('suggested_step', { length: 30 }),

  // Explainability (mandatory)
  confidence: decimal('confidence', { precision: 5, scale: 4 }).notNull(), // 0.0000–1.0000
  explanation: text('explanation').notNull(),
  factorsJson: jsonb('factors_json').$type<Array<{ name: string; weight: number; description: string }>>(),
  similarGrievanceIds: jsonb('similar_grievance_ids').$type<string[]>(),

  // Model metadata
  modelVersion: varchar('model_version', { length: 50 }).notNull(),
  profileKey: varchar('profile_key', { length: 100 }).notNull(),
  auditRef: varchar('audit_ref', { length: 120 }),

  // Human review
  status: aiTriageStatusEnum('status').notNull().default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  humanApproved: boolean('human_approved').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('idx_ai_grievance_triages_org').on(table.organizationId),
  grievanceIdx: index('idx_ai_grievance_triages_grievance').on(table.grievanceId),
  statusIdx: index('idx_ai_grievance_triages_status').on(table.status),
}));

// ============================================================================
// TYPES
// ============================================================================

export type AiGrievanceTriage = typeof aiGrievanceTriages.$inferSelect;
export type AiGrievanceTriageInsert = typeof aiGrievanceTriages.$inferInsert;

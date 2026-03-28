/**
 * Satisfaction Feedback Schema — "Rate My LRO"
 *
 * Post-case-closure satisfaction surveys linking a completed claim
 * to a member's rating of their Labour Relations Officer (LRO).
 *
 * Six metrics on a 1-5 scale:
 *   1. Communication — kept me informed
 *   2. Responsiveness — timely follow-ups
 *   3. Knowledge — understood the contract/CBA
 *   4. Advocacy — fought for my interests
 *   5. Professionalism — respectful, prepared
 *   6. Outcome — satisfied with the result
 *
 * Plus free-text feedback and an anonymous flag.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';
import { claims } from './claims';
import { profiles } from '../../profiles-schema';

// =====================================================
// SATISFACTION SURVEYS
// =====================================================

export const satisfactionSurveys = pgTable(
  'satisfaction_surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Link to claim and people
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claims.id, { onDelete: 'cascade' }),
    memberId: varchar('member_id', { length: 255 }).notNull(), // who fills it out
    lroId: varchar('lro_id', { length: 255 }).notNull(), // LRO being rated (assignedTo)

    // Status
    status: varchar('status', { length: 30 }).notNull().default('pending'),

    // Six rating metrics (1-5 stars)
    communicationRating: integer('communication_rating'),
    responsivenessRating: integer('responsiveness_rating'),
    knowledgeRating: integer('knowledge_rating'),
    advocacyRating: integer('advocacy_rating'),
    professionalismRating: integer('professionalism_rating'),
    outcomeRating: integer('outcome_rating'),

    // Computed overall score (mean of submitted ratings)
    overallScore: decimal('overall_score', { precision: 3, scale: 2 }),

    // Free-text
    feedback: text('feedback'),
    wouldRecommend: boolean('would_recommend'),

    // Privacy
    isAnonymous: boolean('is_anonymous').notNull().default(false),

    // Lifecycle
    sentAt: timestamp('sent_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  },
  (table) => ({
    orgIdx: index('idx_satisfaction_org').on(table.organizationId),
    claimIdx: index('idx_satisfaction_claim').on(table.claimId),
    memberIdx: index('idx_satisfaction_member').on(table.memberId),
    lroIdx: index('idx_satisfaction_lro').on(table.lroId),
    statusIdx: index('idx_satisfaction_status').on(table.status),
    claimUnique: unique('satisfaction_claim_member_unique').on(table.claimId, table.memberId),
    checkStatus: check('valid_satisfaction_status',
      sql`${table.status} IN ('pending', 'sent', 'completed', 'expired', 'declined')`),
    checkCommunication: check('valid_communication_rating',
      sql`${table.communicationRating} IS NULL OR (${table.communicationRating} >= 1 AND ${table.communicationRating} <= 5)`),
    checkResponsiveness: check('valid_responsiveness_rating',
      sql`${table.responsivenessRating} IS NULL OR (${table.responsivenessRating} >= 1 AND ${table.responsivenessRating} <= 5)`),
    checkKnowledge: check('valid_knowledge_rating',
      sql`${table.knowledgeRating} IS NULL OR (${table.knowledgeRating} >= 1 AND ${table.knowledgeRating} <= 5)`),
    checkAdvocacy: check('valid_advocacy_rating',
      sql`${table.advocacyRating} IS NULL OR (${table.advocacyRating} >= 1 AND ${table.advocacyRating} <= 5)`),
    checkProfessionalism: check('valid_professionalism_rating',
      sql`${table.professionalismRating} IS NULL OR (${table.professionalismRating} >= 1 AND ${table.professionalismRating} <= 5)`),
    checkOutcome: check('valid_outcome_rating',
      sql`${table.outcomeRating} IS NULL OR (${table.outcomeRating} >= 1 AND ${table.outcomeRating} <= 5)`),
  })
);

// =====================================================
// RELATIONS
// =====================================================

export const satisfactionSurveysRelations = relations(satisfactionSurveys, ({ one }) => ({
  organization: one(organizations, {
    fields: [satisfactionSurveys.organizationId],
    references: [organizations.id],
  }),
  claim: one(claims, {
    fields: [satisfactionSurveys.claimId],
    references: [claims.id],
  }),
  member: one(profiles, {
    fields: [satisfactionSurveys.memberId],
    references: [profiles.userId],
    relationName: 'satisfactionMember',
  }),
  lro: one(profiles, {
    fields: [satisfactionSurveys.lroId],
    references: [profiles.userId],
    relationName: 'satisfactionLro',
  }),
}));

// =====================================================
// TYPES
// =====================================================

export type SatisfactionSurvey = typeof satisfactionSurveys.$inferSelect;
export type NewSatisfactionSurvey = typeof satisfactionSurveys.$inferInsert;

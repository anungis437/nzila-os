/**
 * A/B Testing Database Schema
 * 
 * SPRINT 8: Advanced Features
 * 
 * Tables for storing A/B test configurations, variants, and results
 */

import { pgTable, uuid, text, integer, decimal, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';

// Test status enum
export const testStatusEnum = ['draft', 'active', 'paused', 'completed', 'archived'] as const;
export type TestStatus = typeof testStatusEnum[number];

// Test type enum
export const testTypeEnum = ['email-subject', 'cta-text', 'landing-page', 'notification-message'] as const;
export type TestType = typeof testTypeEnum[number];

// ============================================================================
// A/B TESTS
// ============================================================================

export const abTests = pgTable(
  'ab_tests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    type: text('type').notNull().$type<TestType>(),
    status: text('status').notNull().default('draft').$type<TestStatus>(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    targetSampleSize: integer('target_sample_size').notNull().default(1000),
    currentSampleSize: integer('current_sample_size').notNull().default(0),
    confidence: decimal('confidence', { precision: 5, scale: 2 }).notNull().default('95.00'), // 95% confidence
    winnerId: uuid('winner_id'), // References abTestVariants.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    segmentCriteria: jsonb('segment_criteria').$type<Record<string, any>>(), // Audience targeting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: jsonb('metadata').notNull().default({}).$type<Record<string, any>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('ab_tests_status_idx').on(table.status),
    typeIdx: index('ab_tests_type_idx').on(table.type),
    orgIdx: index('ab_tests_org_idx').on(table.organizationId),
  })
);

// ============================================================================
// A/B TEST VARIANTS
// ============================================================================

export const abTestVariants = pgTable(
  'ab_test_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testId: uuid('test_id')
      .references(() => abTests.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(), // e.g., 'Control', 'Variant A', 'Variant B'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: jsonb('content').notNull().$type<Record<string, any>>(), // Test-specific content
    weight: decimal('weight', { precision: 5, scale: 2 }).notNull().default('50.00'), // Allocation percentage
    impressions: integer('impressions').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    isControl: boolean('is_control').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    testIdx: index('ab_test_variants_test_idx').on(table.testId),
  })
);

// ============================================================================
// A/B TEST ASSIGNMENTS
// ============================================================================

/**
 * Track which users were assigned which variants
 * Ensures consistent experience (user always sees same variant)
 */
export const abTestAssignments = pgTable(
  'ab_test_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testId: uuid('test_id')
      .references(() => abTests.id, { onDelete: 'cascade' })
      .notNull(),
    variantId: uuid('variant_id')
      .references(() => abTestVariants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id').notNull(), // Clerk user ID
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (table) => ({
    testUserIdx: index('ab_test_assignments_test_user_idx').on(table.testId, table.userId),
    variantIdx: index('ab_test_assignments_variant_idx').on(table.variantId),
  })
);

// ============================================================================
// A/B TEST EVENTS
// ============================================================================

/**
 * Track impressions and conversions
 */
export const abTestEvents = pgTable(
  'ab_test_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testId: uuid('test_id')
      .references(() => abTests.id, { onDelete: 'cascade' })
      .notNull(),
    variantId: uuid('variant_id')
      .references(() => abTestVariants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id').notNull(),
    eventType: text('event_type').notNull().$type<'impression' | 'conversion'>(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: jsonb('metadata').$type<Record<string, any>>(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    testIdx: index('ab_test_events_test_idx').on(table.testId),
    variantIdx: index('ab_test_events_variant_idx').on(table.variantId),
    timestampIdx: index('ab_test_events_timestamp_idx').on(table.timestamp),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const abTestsRelations = relations(abTests, ({ many }) => ({
  variants: many(abTestVariants),
  assignments: many(abTestAssignments),
  events: many(abTestEvents),
}));

export const abTestVariantsRelations = relations(abTestVariants, ({ one, many }) => ({
  test: one(abTests, {
    fields: [abTestVariants.testId],
    references: [abTests.id],
  }),
  assignments: many(abTestAssignments),
  events: many(abTestEvents),
}));

export const abTestAssignmentsRelations = relations(abTestAssignments, ({ one }) => ({
  test: one(abTests, {
    fields: [abTestAssignments.testId],
    references: [abTests.id],
  }),
  variant: one(abTestVariants, {
    fields: [abTestAssignments.variantId],
    references: [abTestVariants.id],
  }),
}));

export const abTestEventsRelations = relations(abTestEvents, ({ one }) => ({
  test: one(abTests, {
    fields: [abTestEvents.testId],
    references: [abTests.id],
  }),
  variant: one(abTestVariants, {
    fields: [abTestEvents.variantId],
    references: [abTestVariants.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ABTest = typeof abTests.$inferSelect;
export type NewABTest = typeof abTests.$inferInsert;

export type ABTestVariant = typeof abTestVariants.$inferSelect;
export type NewABTestVariant = typeof abTestVariants.$inferInsert;

export type ABTestAssignment = typeof abTestAssignments.$inferSelect;
export type NewABTestAssignment = typeof abTestAssignments.$inferInsert;

export type ABTestEvent = typeof abTestEvents.$inferSelect;
export type NewABTestEvent = typeof abTestEvents.$inferInsert;

/**
 * Strategic Goals Schema
 * Organizational strategic planning goals tracked by executive leadership
 */
import { pgTable, text, uuid, integer, timestamp, jsonb, varchar, pgEnum } from 'drizzle-orm/pg-core';

export const strategicGoalCategoryEnum = pgEnum('strategic_goal_category', [
  'membership',
  'financial',
  'advocacy',
  'operations',
  'education',
  'organizing',
]);

export const strategicGoalStatusEnum = pgEnum('strategic_goal_status', [
  'on-track',
  'at-risk',
  'delayed',
  'completed',
  'cancelled',
]);

export const strategicGoals = pgTable('strategic_goals', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: strategicGoalCategoryEnum('category').notNull().default('operations'),
  progress: integer('progress').notNull().default(0),
  dueDate: timestamp('due_date', { withTimezone: true, mode: 'string' }),
  owner: varchar('owner', { length: 255 }),
  status: strategicGoalStatusEnum('status').notNull().default('on-track'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

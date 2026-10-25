/**
 * Reports Database Schema
 * 
 * Advanced reporting and analytics system for:
 * - Custom report definitions
 * - Report templates
 * - Report execution history
 * - Scheduled reports
 * - Report sharing and permissions
 * 
 * @module reports-schema
 */

import { pgTable, uuid, text, timestamp, boolean, varchar, jsonb, pgEnum, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';

// ============================================================================
// ENUMS
// ============================================================================

export const reportTypeEnum = pgEnum('report_type', [
  'custom',
  'template',
  'system',
  'scheduled'
]);

export const reportCategoryEnum = pgEnum('report_category', [
  'claims',
  'members',
  'financial',
  'compliance',
  'performance',
  'custom'
]);

export const reportFormatEnum = pgEnum('report_format', [
  'pdf',
  'excel',
  'csv',
  'json',
  'html'
]);

export const scheduleFrequencyEnum = pgEnum('schedule_frequency', [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
]);

// ============================================================================
// REPORTS TABLE
// ============================================================================

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  reportType: reportTypeEnum('report_type').notNull().default('custom'),
  category: reportCategoryEnum('category').notNull().default('custom'),
  config: jsonb('config').notNull(), // Report configuration (data sources, fields, filters, etc.)
  isPublic: boolean('is_public').notNull().default(false),
  isTemplate: boolean('is_template').notNull().default(false),
  templateId: uuid('template_id'), // If created from a template
  createdBy: varchar('created_by', { length: 255 }).notNull(), // User ID - matches users.userId VARCHAR(255)
  updatedBy: varchar('updated_by', { length: 255 }), // User ID - matches users.userId VARCHAR(255)
  lastRunAt: timestamp('last_run_at'),
  runCount: integer('run_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const reportsRelations = relations(reports, () => ({
}));


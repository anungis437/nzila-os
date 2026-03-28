/**
 * Jurisdiction Preferences Schema
 *
 * Stores user-level jurisdiction and geographic preferences for
 * filtering arbitration precedents. Each user selects:
 *   - jurisdictions (provinces/territories + federal)
 *   - jurisdiction level (federal, provincial, municipal)
 *
 * Precedents are then auto-filtered to these preferences on the
 * Precedents console while still allowing manual override.
 */

import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { organizations } from '../../../schema-organizations';

export const memberJurisdictionPreferences = pgTable('member_jurisdiction_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Selected jurisdictions — subset of caJurisdictionEnum values
  // e.g. ['ON', 'federal'] or ['QC', 'federal', 'BC']
  preferredJurisdictions: jsonb('preferred_jurisdictions')
    .notNull()
    .$type<string[]>()
    .default([]),

  // Jurisdiction level filter — which level(s) of labour boards matter
  // e.g. ['federal', 'provincial'] or ['municipal', 'provincial']
  preferredLevels: jsonb('preferred_levels')
    .notNull()
    .$type<string[]>()
    .default([]),

  // Whether to always include national/federal precedents regardless of selection
  includeNational: boolean('include_national').notNull().default(true),

  // Whether to auto-apply preferences on the precedent search page
  autoApply: boolean('auto_apply').notNull().default(true),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// =====================================================
// Drizzle ORM Schema: Applications Registry
// Migration 0071: Multi-App Discriminator
// =====================================================

import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

// =====================================================
// APPLICATIONS TABLE
// =====================================================

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    defaultOrgType: text('default_org_type'),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index('idx_applications_slug').on(table.slug),
    statusIdx: index('idx_applications_status').on(table.status),
  })
);

// This registry does not own organization identity. The canonical organization
// model has no application foreign key; see schema-authority/runtime-drift-dispositions.json.

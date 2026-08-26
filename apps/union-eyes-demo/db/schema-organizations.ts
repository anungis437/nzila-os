/**
 * Demo-local schema shim: `organization_members` table stub.
 *
 * Wave 0 §2 remediation: replaces the operational
 * `@/db/schema-organizations` import with a minimal placeholder table
 * definition sufficient for Drizzle query type-checking. Combined with
 * the inert `db` client in `db/db.ts`, queries against this table
 * always yield `[]`.
 *
 * Only the columns the demo actually references are declared. Do NOT
 * expand this table to mirror the operational schema — the demo does
 * not own that data model.
 */

import { pgTable, text, uuid, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  role: text('role').notNull(),
  status: text('status').notNull().default('active'),
  isPrimary: boolean('is_primary').default(false),
  department: text('department'),
  position: text('position'),
  location: text('location'),
  seniority: integer('seniority'),
  membershipNumber: text('membership_number'),
  hireDate: timestamp('hire_date', { withTimezone: true }),
  unionJoinDate: timestamp('union_join_date', { withTimezone: true }),
  preferredContactMethod: text('preferred_contact_method'),
  memberCategory: text('member_category'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

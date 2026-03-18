/**
 * Nzila OS — Core org tables
 *
 * Every object in the system is scoped by org_id.
 * These tables define the organisations and the people involved.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  varchar,
  date,
} from 'drizzle-orm/pg-core'

// ── Enums ───────────────────────────────────────────────────────────────────

export const orgStatusEnum = pgEnum('org_status', ['active', 'inactive'])

export const personTypeEnum = pgEnum('person_type', ['individual', 'entity'])

export const orgRoleKindEnum = pgEnum('org_role_kind', [
  'director',
  'officer',
  'shareholder',
  'counsel',
  'auditor',
])

export const orgMemberRoleEnum = pgEnum('org_member_role', [
  'org_admin',
  'org_secretary',
  'org_viewer',
])

export const orgMemberStatusEnum = pgEnum('org_member_status', [
  'active',
  'suspended',
  'removed',
])

// ── 1) orgs ─────────────────────────────────────────────────────────────────────

export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: varchar('clerk_org_id', { length: 255 }).unique(),
  legalName: text('legal_name').notNull(),
  jurisdiction: varchar('jurisdiction', { length: 10 }).notNull(), // e.g. CA-ON
  incorporationNumber: text('incorporation_number'),
  registeredOfficeAddress: jsonb('registered_office_address'),
  fiscalYearEnd: varchar('fiscal_year_end', { length: 5 }), // MM-DD
  policyConfig: jsonb('policy_config').default({}), // threshold overrides
  status: orgStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 2) people ───────────────────────────────────────────────────────────────

export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: personTypeEnum('type').notNull(),
  legalName: text('legal_name').notNull(),
  email: text('email'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 3) org_roles ─────────────────────────────────────────────────────────────────

export const orgRoles = pgTable('org_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  personId: uuid('person_id')
    .notNull()
    .references(() => people.id),
  role: orgRoleKindEnum('role').notNull(),
  title: text('title'), // e.g. CEO, Secretary
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 4) org_members (console access) ──────────────────────────────────────────────

export const orgMembers = pgTable('org_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  clerkUserId: text('clerk_user_id').notNull(),
  role: orgMemberRoleEnum('role').notNull(),
  status: orgMemberStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

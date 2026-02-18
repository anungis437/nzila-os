/**
 * Nzila OS — Core entity tables
 *
 * Every object in the system is scoped by entity_id.
 * These tables define the legal entities and the people involved.
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

export const entityStatusEnum = pgEnum('entity_status', ['active', 'inactive'])

export const personTypeEnum = pgEnum('person_type', ['individual', 'entity'])

export const entityRoleKindEnum = pgEnum('entity_role_kind', [
  'director',
  'officer',
  'shareholder',
  'counsel',
  'auditor',
])

export const entityMemberRoleEnum = pgEnum('entity_member_role', [
  'entity_admin',
  'entity_secretary',
  'entity_viewer',
])

export const entityMemberStatusEnum = pgEnum('entity_member_status', [
  'active',
  'suspended',
  'removed',
])

// ── 1) entities ─────────────────────────────────────────────────────────────

export const entities = pgTable('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  legalName: text('legal_name').notNull(),
  jurisdiction: varchar('jurisdiction', { length: 10 }).notNull(), // e.g. CA-ON
  incorporationNumber: text('incorporation_number'),
  registeredOfficeAddress: jsonb('registered_office_address'),
  fiscalYearEnd: varchar('fiscal_year_end', { length: 5 }), // MM-DD
  policyConfig: jsonb('policy_config').default({}), // threshold overrides
  status: entityStatusEnum('status').notNull().default('active'),
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

// ── 3) entity_roles ─────────────────────────────────────────────────────────

export const entityRoles = pgTable('entity_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  personId: uuid('person_id')
    .notNull()
    .references(() => people.id),
  role: entityRoleKindEnum('role').notNull(),
  title: text('title'), // e.g. CEO, Secretary
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── 4) entity_members (console access) ──────────────────────────────────────

export const entityMembers = pgTable('entity_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  clerkUserId: text('clerk_user_id').notNull(),
  role: entityMemberRoleEnum('role').notNull(),
  status: entityMemberStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

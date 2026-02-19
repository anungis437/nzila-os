/**
 * Nzila OS — Partner Portal schema
 *
 * Core tables for the partner relationship layer:
 * partners, partner_users, deals, commissions, certifications,
 * assets, api_credentials, gtm_requests.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  varchar,
  integer,
  numeric,
  date,
  boolean,
} from 'drizzle-orm/pg-core'

// ── Enums ───────────────────────────────────────────────────────────────────

export const partnerTypeEnum = pgEnum('partner_type', [
  'channel',
  'isv',
  'enterprise',
])

export const partnerTierEnum = pgEnum('partner_tier', [
  'registered',
  'select',
  'certified',
  'professional',
  'premier',
  'advanced',
  'enterprise',
  'elite',
  'strategic',
])

export const partnerStatusEnum = pgEnum('partner_status', [
  'pending',
  'active',
  'suspended',
  'churned',
])

export const partnerUserRoleEnum = pgEnum('partner_user_role', [
  'channel:admin', 'channel:sales', 'channel:executive',
  'isv:admin', 'isv:technical', 'isv:business',
  'enterprise:admin', 'enterprise:user',
])

export const dealStageEnum = pgEnum('deal_stage', [
  'registered',
  'submitted',
  'approved',
  'won',
  'lost',
])

export const commissionStatusEnum = pgEnum('commission_status', [
  'pending',
  'earned',
  'paid',
  'cancelled',
])

export const certTrackStatusEnum = pgEnum('cert_track_status', [
  'not_started',
  'in_progress',
  'completed',
])

export const apiEnvEnum = pgEnum('api_env', [
  'sandbox',
  'production',
])

export const gtmRequestStatusEnum = pgEnum('gtm_request_status', [
  'draft',
  'submitted',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
])

// ── 1) partners ─────────────────────────────────────────────────────────────

export const partners = pgTable('partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: varchar('clerk_org_id', { length: 255 }).notNull().unique(),
  companyName: text('company_name').notNull(),
  type: partnerTypeEnum('type').notNull(),
  tier: partnerTierEnum('tier').notNull().default('registered'),
  status: partnerStatusEnum('status').notNull().default('pending'),
  nzilaOwnerId: varchar('nzila_owner_id', { length: 255 }), // internal account manager
  website: text('website'),
  logo: text('logo'), // blob key
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── 2) partner_users ────────────────────────────────────────────────────────

export const partnerUsers = pgTable('partner_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull(),
  role: partnerUserRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── 3) deals ────────────────────────────────────────────────────────────────

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  accountName: text('account_name').notNull(),
  contactName: text('contact_name').notNull(),
  contactEmail: varchar('contact_email', { length: 320 }).notNull(),
  vertical: varchar('vertical', { length: 100 }).notNull(),
  estimatedArr: numeric('estimated_arr', { precision: 12, scale: 2 }).notNull(),
  stage: dealStageEnum('stage').notNull().default('registered'),
  expectedCloseDate: date('expected_close_date'),
  lockedUntil: timestamp('locked_until', { withTimezone: true }), // deal protection
  notes: text('notes'),
  nzilaReviewerId: varchar('nzila_reviewer_id', { length: 255 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── 4) commissions ──────────────────────────────────────────────────────────

export const commissions = pgTable('commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  tierMultiplier: numeric('tier_multiplier', { precision: 4, scale: 2 }).notNull().default('1.00'),
  status: commissionStatusEnum('status').notNull().default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  stripePayoutId: varchar('stripe_payout_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── 5) certifications ───────────────────────────────────────────────────────

export const certifications = pgTable('certifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull(),
  trackId: varchar('track_id', { length: 100 }).notNull(),
  moduleId: varchar('module_id', { length: 100 }),
  status: certTrackStatusEnum('status').notNull().default('not_started'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  badgeBlobKey: text('badge_blob_key'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── 6) assets ───────────────────────────────────────────────────────────────

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  description: text('description'),
  blobKey: text('blob_key').notNull(),
  version: integer('version').notNull().default(1),
  tags: jsonb('tags'),
  uploadedBy: varchar('uploaded_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ── 7) api_credentials ──────────────────────────────────────────────────────

export const apiCredentials = pgTable('api_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  env: apiEnvEnum('env').notNull(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // visible prefix for identification
  keyHash: text('key_hash').notNull(), // bcrypt hash of the full key
  label: varchar('label', { length: 100 }),
  isRevoked: boolean('is_revoked').notNull().default(false),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

// ── 8) gtm_requests ─────────────────────────────────────────────────────────

export const gtmRequests = pgTable('gtm_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  type: varchar('type', { length: 50 }).notNull(), // co-sell, campaign, business-plan
  subject: text('subject').notNull(),
  payload: jsonb('payload'),
  nzilaOwnerId: varchar('nzila_owner_id', { length: 255 }),
  status: gtmRequestStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

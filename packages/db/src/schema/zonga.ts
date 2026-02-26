/**
 * Nzila OS — Zonga (Content/Music Platform) tables
 *
 * Creators, content assets, releases, revenue events,
 * payouts, and wallets for the Zonga platform.
 *
 * Every table is scoped by entity_id (org identity).
 * Follows existing patterns from commerce.ts.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  numeric,
  varchar,
  boolean,
} from 'drizzle-orm/pg-core'
import { entities } from './entities'

// ── Zonga Enums ─────────────────────────────────────────────────────────────

export const zongaCreatorStatusEnum = pgEnum('zonga_creator_status', [
  'pending',
  'active',
  'suspended',
  'deactivated',
])

export const zongaAssetTypeEnum = pgEnum('zonga_asset_type', [
  'track',
  'album',
  'video',
  'podcast',
])

export const zongaAssetStatusEnum = pgEnum('zonga_asset_status', [
  'draft',
  'processing',
  'review',
  'published',
  'taken_down',
  'archived',
])

export const zongaReleaseStatusEnum = pgEnum('zonga_release_status', [
  'draft',
  'scheduled',
  'released',
  'withdrawn',
])

export const zongaRevenueTypeEnum = pgEnum('zonga_revenue_type', [
  'stream',
  'download',
  'tip',
  'subscription_share',
  'ticket_sale',
  'merchandise',
  'sync_license',
])

export const zongaPayoutStatusEnum = pgEnum('zonga_payout_status', [
  'pending',
  'previewed',
  'approved',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const zongaLedgerEntryTypeEnum = pgEnum('zonga_ledger_entry_type', [
  'credit',
  'debit',
  'hold',
  'release',
])

// ── Creators ────────────────────────────────────────────────────────────────

export const zongaCreators = pgTable('zonga_creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  userId: uuid('user_id').notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  status: zongaCreatorStatusEnum('status').notNull().default('pending'),
  genre: varchar('genre', { length: 100 }),
  country: varchar('country', { length: 100 }),
  payoutCurrency: varchar('payout_currency', { length: 3 }).notNull().default('USD'),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Content Assets ──────────────────────────────────────────────────────────

export const zongaContentAssets = pgTable('zonga_content_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  title: varchar('title', { length: 255 }).notNull(),
  type: zongaAssetTypeEnum('type').notNull(),
  status: zongaAssetStatusEnum('status').notNull().default('draft'),
  description: text('description'),
  storageUrl: text('storage_url'),
  coverArtUrl: text('cover_art_url'),
  durationSeconds: integer('duration_seconds'),
  genre: varchar('genre', { length: 100 }),
  metadata: jsonb('metadata').notNull().default({}),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Releases ────────────────────────────────────────────────────────────────

export const zongaReleases = pgTable('zonga_releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  title: varchar('title', { length: 255 }).notNull(),
  status: zongaReleaseStatusEnum('status').notNull().default('draft'),
  releaseDate: timestamp('release_date', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Revenue Events (ledger-style, append-only) ──────────────────────────────

export const zongaRevenueEvents = pgTable('zonga_revenue_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  assetId: uuid('asset_id')
    .references(() => zongaContentAssets.id),
  releaseId: uuid('release_id')
    .references(() => zongaReleases.id),
  type: zongaRevenueTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  assetTitle: varchar('asset_title', { length: 255 }),
  source: varchar('source', { length: 100 }),
  description: text('description'),
  externalRef: varchar('external_ref', { length: 255 }),
  createdBy: uuid('created_by'),
  metadata: jsonb('metadata').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Wallet Ledger (double-entry style) ──────────────────────────────────────

export const zongaWalletLedger = pgTable('zonga_wallet_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  entryType: zongaLedgerEntryTypeEnum('entry_type').notNull(),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  description: text('description'),
  revenueEventId: uuid('revenue_event_id')
    .references(() => zongaRevenueEvents.id),
  payoutId: uuid('payout_id'),
  balanceAfter: numeric('balance_after', { precision: 18, scale: 6 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Payouts ─────────────────────────────────────────────────────────────────

export const zongaPayouts = pgTable('zonga_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  creatorName: varchar('creator_name', { length: 255 }),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: zongaPayoutStatusEnum('status').notNull().default('pending'),
  payoutRail: varchar('payout_rail', { length: 50 }),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  revenueEventCount: integer('revenue_event_count').notNull().default(0),
  metadata: jsonb('metadata').notNull().default({}),
  previewedAt: timestamp('previewed_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  failedReason: text('failed_reason'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Royalty Splits ──────────────────────────────────────────────────────────

export const zongaRoyaltySplits = pgTable('zonga_royalty_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  releaseId: uuid('release_id')
    .notNull()
    .references(() => zongaReleases.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  creatorName: varchar('creator_name', { length: 255 }),
  sharePercent: numeric('share_percent', { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Zonga Outbox ────────────────────────────────────────────────────────────

export const zongaOutbox = pgTable('zonga_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id')
    .notNull()
    .references(() => entities.id),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  status: text('status').notNull().default('pending'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
})

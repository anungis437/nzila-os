/**
 * Nzila OS — Zonga (Content/Music Platform) tables
 *
 * Creators, content assets, releases, revenue events,
 * payouts, wallets, listeners, events, tickets, playlists,
 * moderation, integrity, and notifications for the Zonga platform.
 *
 * Every table is scoped by org_id (org identity).
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
import { orgs } from './orgs'

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
  'under_review',
  'scheduled',
  'published',
  'released',
  'held',
  'rejected',
  'archived',
  'withdrawn',
])

export const zongaCreatorOnboardingStatusEnum = pgEnum('zonga_creator_onboarding_status', [
  'invited',
  'registered',
  'profile_complete',
  'payout_ready',
  'active',
  'suspended',
])

export const zongaEventStatusEnum = pgEnum('zonga_event_status', [
  'draft',
  'published',
  'sold_out',
  'cancelled',
  'completed',
])

export const zongaTicketPurchaseStatusEnum = pgEnum('zonga_ticket_purchase_status', [
  'pending',
  'confirmed',
  'failed',
  'refunded',
  'cancelled',
])

export const zongaPlaylistVisibilityEnum = pgEnum('zonga_playlist_visibility', [
  'public',
  'private',
  'unlisted',
])

export const zongaPlaylistOwnerTypeEnum = pgEnum('zonga_playlist_owner_type', [
  'system',
  'creator',
  'listener',
])

export const zongaModerationCaseStatusEnum = pgEnum('zonga_moderation_case_status', [
  'open',
  'in_review',
  'resolved',
  'dismissed',
  'escalated',
])

export const zongaModerationCaseTypeEnum = pgEnum('zonga_moderation_case_type', [
  'copyright',
  'abuse',
  'quality',
  'policy',
  'fraud',
  'other',
])

export const zongaPayoutPreviewStatusEnum = pgEnum('zonga_payout_preview_status', [
  'draft',
  'ready',
  'locked',
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

export const zongaListenerPlanEnum = pgEnum('zonga_listener_plan', [
  'free',
  'premium',
])

export const zongaSubscriptionStatusEnum = pgEnum('zonga_subscription_status', [
  'active',
  'past_due',
  'canceled',
  'trialing',
  'incomplete',
])

export const zongaCreatorPlanEnum = pgEnum('zonga_creator_plan', [
  'artist',
  'label',
  'enterprise',
])

export const zongaLedgerEntryTypeEnum = pgEnum('zonga_ledger_entry_type', [
  'credit',
  'debit',
  'hold',
  'release',
])

// ── Creator Accounts ────────────────────────────────────────────────────────

export const zongaCreatorAccounts = pgTable('zonga_creator_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  creatorId: uuid('creator_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  onboardingStatus: zongaCreatorOnboardingStatusEnum('onboarding_status')
    .notNull()
    .default('invited'),
  kycStatus: varchar('kyc_status', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Creators ────────────────────────────────────────────────────────────────

export const zongaCreators = pgTable('zonga_creators', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  userId: uuid('user_id').notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  status: zongaCreatorStatusEnum('status').notNull().default('pending'),
  plan: zongaCreatorPlanEnum('plan').notNull().default('artist'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  subscriptionStatus: zongaSubscriptionStatusEnum('subscription_status'),
  genre: varchar('genre', { length: 100 }),
  country: varchar('country', { length: 100 }),
  payoutCurrency: varchar('payout_currency', { length: 3 }).notNull().default('USD'),
  verified: boolean('verified').notNull().default(false),
  legalName: varchar('legal_name', { length: 255 }),
  city: varchar('city', { length: 100 }),
  payoutStatus: varchar('payout_status', { length: 50 }),
  verificationStatus: varchar('verification_status', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Content Assets ──────────────────────────────────────────────────────────

export const zongaContentAssets = pgTable('zonga_content_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
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
  fingerprintRef: varchar('fingerprint_ref', { length: 255 }),
  metadata: jsonb('metadata').notNull().default({}),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Releases ────────────────────────────────────────────────────────────────

export const zongaReleases = pgTable('zonga_releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  title: varchar('title', { length: 255 }).notNull(),
  status: zongaReleaseStatusEnum('status').notNull().default('draft'),
  releaseDate: timestamp('release_date', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  releaseType: varchar('release_type', { length: 50 }),
  description: text('description'),
  coverAssetId: uuid('cover_asset_id'),
  moderationStatus: varchar('moderation_status', { length: 50 }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Release Tracks ──────────────────────────────────────────────────────────

export const zongaReleaseTracks = pgTable('zonga_release_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  releaseId: uuid('release_id')
    .notNull()
    .references(() => zongaReleases.id),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => zongaContentAssets.id),
  trackNumber: integer('track_number').notNull(),
  titleOverride: varchar('title_override', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Revenue Events (ledger-style, append-only) ──────────────────────────────

export const zongaRevenueEvents = pgTable('zonga_revenue_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
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
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
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
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
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
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
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

// ── Payout Previews ─────────────────────────────────────────────────────────

export const zongaPayoutPreviews = pgTable('zonga_payout_previews', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 6 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: zongaPayoutPreviewStatusEnum('status').notNull().default('draft'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Playlists ───────────────────────────────────────────────────────────────

export const zongaPlaylists = pgTable('zonga_playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  ownerType: zongaPlaylistOwnerTypeEnum('owner_type').notNull(),
  ownerId: uuid('owner_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  visibility: zongaPlaylistVisibilityEnum('visibility').notNull().default('public'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaPlaylistItems = pgTable('zonga_playlist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id')
    .notNull()
    .references(() => zongaPlaylists.id),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  targetEntityId: uuid('entity_id').notNull(),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Listeners ───────────────────────────────────────────────────────────────

export const zongaListeners = pgTable('zonga_listeners', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  plan: zongaListenerPlanEnum('plan').notNull().default('free'),
  subscriptionStatus: zongaSubscriptionStatusEnum('subscription_status'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  preferencesJson: jsonb('preferences_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaListenerFollows = pgTable('zonga_listener_follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  listenerId: uuid('listener_id')
    .notNull()
    .references(() => zongaListeners.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaListenerFavorites = pgTable('zonga_listener_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  listenerId: uuid('listener_id')
    .notNull()
    .references(() => zongaListeners.id),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  targetEntityId: uuid('entity_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaListenerPlaylistSaves = pgTable('zonga_listener_playlist_saves', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  listenerId: uuid('listener_id')
    .notNull()
    .references(() => zongaListeners.id),
  playlistId: uuid('playlist_id')
    .notNull()
    .references(() => zongaPlaylists.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaListenerActivity = pgTable('zonga_listener_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  listenerId: uuid('listener_id')
    .notNull()
    .references(() => zongaListeners.id),
  activityType: varchar('activity_type', { length: 50 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  targetEntityId: uuid('entity_id'),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Events ──────────────────────────────────────────────────────────────────

export const zongaEvents = pgTable('zonga_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  creatorId: uuid('creator_id')
    .references(() => zongaCreators.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  venue: varchar('venue', { length: 255 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  status: zongaEventStatusEnum('status').notNull().default('draft'),
  ticketingStatus: varchar('ticketing_status', { length: 50 }),
  imageUrl: text('image_url'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaTicketTypes = pgTable('zonga_ticket_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  eventId: uuid('event_id')
    .notNull()
    .references(() => zongaEvents.id),
  ticketType: varchar('ticket_type', { length: 100 }).notNull(),
  price: numeric('price', { precision: 18, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  quantityAvailable: integer('quantity_available').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaTicketPurchases = pgTable('zonga_ticket_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  eventId: uuid('event_id')
    .notNull()
    .references(() => zongaEvents.id),
  ticketTypeId: uuid('ticket_type_id')
    .notNull()
    .references(() => zongaTicketTypes.id),
  listenerId: uuid('listener_id')
    .references(() => zongaListeners.id),
  stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }),
  status: zongaTicketPurchaseStatusEnum('status').notNull().default('pending'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
})

// ── Moderation ──────────────────────────────────────────────────────────────

export const zongaModerationCases = pgTable('zonga_moderation_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  targetEntityId: uuid('entity_id').notNull(),
  caseType: zongaModerationCaseTypeEnum('case_type').notNull(),
  status: zongaModerationCaseStatusEnum('status').notNull().default('open'),
  severity: varchar('severity', { length: 20 }).notNull().default('medium'),
  notes: text('notes'),
  assignedTo: uuid('assigned_to'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaIntegritySignals = pgTable('zonga_integrity_signals', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  targetEntityId: uuid('entity_id').notNull(),
  signalType: varchar('signal_type', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('info'),
  explanation: text('explanation'),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Notifications ───────────────────────────────────────────────────────────

export const zongaNotifications = pgTable('zonga_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  body: text('body'),
  link: text('link'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Zonga Outbox ────────────────────────────────────────────────────────────

export const zongaOutbox = pgTable('zonga_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  status: text('status').notNull().default('pending'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
})

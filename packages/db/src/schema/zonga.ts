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
    .references(() => orgs.id),
  userId: text('user_id').notNull(),
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
    .references(() => orgs.id),
  userId: text('user_id'),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
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

// ── Eventbrite Connections ───────────────────────────────────────────────────

export const zongaEventbriteConnections = pgTable('zonga_eventbrite_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  eventbriteOrgId: varchar('eventbrite_org_id', { length: 50 }),
  accessToken: text('access_token').notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
  source: varchar('source', { length: 20 }).notNull().default('zonga'),
  eventbriteId: varchar('eventbrite_id', { length: 50 }),
  eventbriteUrl: text('eventbrite_url'),
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
  eventbriteTicketClassId: varchar('eventbrite_ticket_class_id', { length: 50 }),
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

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL SCALE EXTENSIONS
// ══════════════════════════════════════════════════════════════════════════════

// ── Enums (new) ─────────────────────────────────────────────────────────────

export const zongaWalletStatusEnum = pgEnum('zonga_wallet_status', [
  'active',
  'frozen',
  'closed',
])

export const zongaWalletTxTypeEnum = pgEnum('zonga_wallet_tx_type', [
  'credit',
  'debit',
  'transfer_in',
  'transfer_out',
  'refund',
  'payout',
  'hold',
  'release',
])

export const zongaPaymentIntentStatusEnum = pgEnum('zonga_payment_intent_status', [
  'created',
  'processing',
  'requires_action',
  'captured',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
])

export const zongaTranscodeJobStatusEnum = pgEnum('zonga_transcode_job_status', [
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const zongaQueueJobStatusEnum = pgEnum('zonga_queue_job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'dead_letter',
])

export const zongaShareTypeEnum = pgEnum('zonga_share_type', [
  'track',
  'playlist',
  'event',
  'artist',
])

export const zongaPodcastStatusEnum = pgEnum('zonga_podcast_status', [
  'draft',
  'published',
  'archived',
])

export const zongaEpisodeStatusEnum = pgEnum('zonga_episode_status', [
  'draft',
  'published',
  'archived',
])

// ── Wallets ─────────────────────────────────────────────────────────────────

export const zongaWallets = pgTable('zonga_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  ownerId: uuid('owner_id').notNull(),
  ownerType: varchar('owner_type', { length: 50 }).notNull(), // 'creator' | 'listener' | 'platform'
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  balance: numeric('balance', { precision: 18, scale: 6 }).notNull().default('0'),
  holdBalance: numeric('hold_balance', { precision: 18, scale: 6 }).notNull().default('0'),
  status: zongaWalletStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaWalletTransactions = pgTable('zonga_wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  walletId: uuid('wallet_id')
    .notNull()
    .references(() => zongaWallets.id),
  type: zongaWalletTxTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 18, scale: 6 }).notNull(),
  description: text('description'),
  referenceType: varchar('reference_type', { length: 100 }),
  referenceId: uuid('reference_id'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  counterpartyWalletId: uuid('counterparty_wallet_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Payment Intents ─────────────────────────────────────────────────────────

export const zongaPaymentIntents = pgTable('zonga_payment_intents', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  userId: uuid('user_id').notNull(),
  orderId: varchar('order_id', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  method: varchar('method', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  status: zongaPaymentIntentStatusEnum('status').notNull().default('created'),
  providerIntentId: varchar('provider_intent_id', { length: 255 }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaPaymentWebhookEvents = pgTable('zonga_payment_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  provider: varchar('provider', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  externalId: varchar('external_id', { length: 255 }),
  payload: jsonb('payload').notNull().default({}),
  processed: boolean('processed').notNull().default(false),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Transcode Jobs ──────────────────────────────────────────────────────────

export const zongaTranscodeJobs = pgTable('zonga_transcode_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => zongaContentAssets.id),
  sourceUrl: text('source_url').notNull(),
  status: zongaTranscodeJobStatusEnum('status').notNull().default('queued'),
  targetQualities: jsonb('target_qualities').notNull().default([]),
  outputs: jsonb('outputs').notNull().default([]),
  hlsManifestUrl: text('hls_manifest_url'),
  progress: integer('progress').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Streaming Sessions ──────────────────────────────────────────────────────

export const zongaStreamingSessions = pgTable('zonga_streaming_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  listenerId: uuid('listener_id')
    .references(() => zongaListeners.id),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => zongaContentAssets.id),
  quality: varchar('quality', { length: 20 }).notNull(),
  protocol: varchar('protocol', { length: 20 }).notNull().default('hls'),
  resumePositionMs: integer('resume_position_ms').notNull().default(0),
  durationPlayedMs: integer('duration_played_ms').notNull().default(0),
  completionPercent: numeric('completion_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  lowDataMode: boolean('low_data_mode').notNull().default(false),
  country: varchar('country', { length: 3 }),
  deviceType: varchar('device_type', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Queue Jobs (generic) ────────────────────────────────────────────────────

export const zongaQueueJobs = pgTable('zonga_queue_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  queue: varchar('queue', { length: 100 }).notNull(),
  jobType: varchar('job_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull().default({}),
  status: zongaQueueJobStatusEnum('status').notNull().default('pending'),
  priority: integer('priority').notNull().default(0),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  lastError: text('last_error'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Social Graph ────────────────────────────────────────────────────────────

export const zongaUserFollows = pgTable('zonga_user_follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  followerId: uuid('follower_id').notNull(),
  followeeId: uuid('followee_id').notNull(),
  followerType: varchar('follower_type', { length: 50 }).notNull(), // 'listener' | 'creator'
  followeeType: varchar('followee_type', { length: 50 }).notNull(), // 'listener' | 'creator'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaUserActivity = pgTable('zonga_user_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  userId: uuid('user_id').notNull(),
  userType: varchar('user_type', { length: 50 }).notNull(),
  activityType: varchar('activity_type', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaSharedContent = pgTable('zonga_shared_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  sharerId: uuid('sharer_id').notNull(),
  shareType: zongaShareTypeEnum('share_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  deepLink: text('deep_link').notNull(),
  platform: varchar('platform', { length: 50 }),
  clickCount: integer('click_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Recommendation Cache ────────────────────────────────────────────────────

export const zongaRecommendationCache = pgTable('zonga_recommendation_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  userId: uuid('user_id').notNull(),
  surface: varchar('surface', { length: 100 }).notNull(), // 'trending', 'for_you', 'city', 'events'
  items: jsonb('items').notNull().default([]),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Creator Analytics Snapshots ─────────────────────────────────────────────

export const zongaCreatorAnalytics = pgTable('zonga_creator_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => zongaCreators.id),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  totalStreams: integer('total_streams').notNull().default(0),
  uniqueListeners: integer('unique_listeners').notNull().default(0),
  totalRevenue: numeric('total_revenue', { precision: 18, scale: 6 }).notNull().default('0'),
  topCountries: jsonb('top_countries').notNull().default([]),
  topTracks: jsonb('top_tracks').notNull().default([]),
  eventRevenue: numeric('event_revenue', { precision: 18, scale: 6 }).notNull().default('0'),
  followerCount: integer('follower_count').notNull().default(0),
  followerGrowth: integer('follower_growth').notNull().default(0),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Podcasts ────────────────────────────────────────────────────────────────

export const zongaPodcasts = pgTable('zonga_podcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  creatorId: uuid('creator_id').references(() => zongaCreators.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  language: varchar('language', { length: 10 }).notNull().default('en'),
  category: varchar('category', { length: 100 }),
  explicit: boolean('explicit').notNull().default(false),
  status: zongaPodcastStatusEnum('status').notNull().default('draft'),
  episodeCount: integer('episode_count').notNull().default(0),
  rssFeedUrl: text('rss_feed_url'),
  websiteUrl: text('website_url'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const zongaPodcastEpisodes = pgTable('zonga_podcast_episodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  podcastId: uuid('podcast_id')
    .notNull()
    .references(() => zongaPodcasts.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  audioUrl: text('audio_url'),
  durationSecs: integer('duration_secs'),
  episodeNumber: integer('episode_number'),
  seasonNumber: integer('season_number').default(1),
  explicit: boolean('explicit').notNull().default(false),
  status: zongaEpisodeStatusEnum('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  coverUrl: text('cover_url'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

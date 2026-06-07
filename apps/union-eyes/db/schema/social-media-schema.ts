// ================================================================
// PHASE 10: SOCIAL MEDIA INTEGRATION - TypeScript Schema
// ================================================================
// Drizzle ORM schema definitions for social media management
// Created: December 7, 2025
// ================================================================

import { pgTable, pgEnum, uuid, text, timestamp, integer, decimal, boolean, date, jsonb, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { profiles } from './profiles-schema';

// ================================================================
// ENUMS
// ================================================================

export const socialPlatformEnum = pgEnum('social_platform', [
  'facebook',
  'twitter',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok'
]);

export const socialAccountStatusEnum = pgEnum('social_account_status', [
  'active',
  'expired',
  'disconnected',
  'rate_limited',
  'suspended'
]);

export const socialPostStatusEnum = pgEnum('social_post_status', [
  'draft',
  'scheduled',
  'published',
  'failed',
  'deleted'
]);

export const socialPostTypeEnum = pgEnum('social_post_type', [
  'text',
  'image',
  'video',
  'link',
  'carousel',
  'story',
  'reel'
]);

export const engagementTypeEnum = pgEnum('engagement_type', [
  'like',
  'comment',
  'share',
  'retweet',
  'reply',
  'reaction',
  'mention',
  'tag'
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'planning',
  'active',
  'paused',
  'completed',
  'cancelled'
]);

// ================================================================
// TABLES
// ================================================================

// Social Media Accounts
export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Platform Details
  platform: socialPlatformEnum('platform').notNull(),
  platformUserId: text('platform_user_id').notNull(),
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  profileImageUrl: text('profile_image_url'),
  
  // Connection Details
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  scopes: text('scopes').array(),
  
  // Account Status
  status: socialAccountStatusEnum('status').notNull().default('active'),
  isPrimary: boolean('is_primary').default(false),
  isVerified: boolean('is_verified').default(false),
  
  // Rate Limiting
  rateLimitRemaining: integer('rate_limit_remaining'),
  rateLimitResetAt: timestamp('rate_limit_reset_at', { withTimezone: true }),
  
  // Metadata
  followerCount: integer('follower_count').default(0),
  followingCount: integer('following_count').default(0),
  postCount: integer('post_count').default(0),
  engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }),
  
  // Account Metadata
  accountMetadata: jsonb('account_metadata').default({}),
  
  // Audit
  connectedBy: text('connected_by').references(() => profiles.userId),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  organizationIdx: index('idx_social_accounts_organization').on(table.organizationId),
  platformIdx: index('idx_social_accounts_platform').on(table.platform),
  statusIdx: index('idx_social_accounts_status').on(table.status),
  primaryIdx: index('idx_social_accounts_primary').on(table.organizationId, table.platform, table.isPrimary),
  uniquePlatformUser: unique().on(table.organizationId, table.platform, table.platformUserId)
}));

// Social Media Posts
export const socialPosts = pgTable('social_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => socialAccounts.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => socialCampaigns.id, { onDelete: 'set null' }),
  
  // Post Content
  postType: socialPostTypeEnum('post_type').notNull().default('text'),
  content: text('content').notNull(),
  mediaUrls: text('media_urls').array(),
  linkUrl: text('link_url'),
  linkPreviewImage: text('link_preview_image'),
  hashtags: text('hashtags').array(),
  mentions: text('mentions').array(),
  
  // Scheduling
  status: socialPostStatusEnum('status').notNull().default('draft'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  
  // Platform Details
  platformPostId: text('platform_post_id'),
  platformUrl: text('platform_url'),
  
  // Engagement Metrics
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  sharesCount: integer('shares_count').default(0),
  impressionsCount: integer('impressions_count').default(0),
  reachCount: integer('reach_count').default(0),
  engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }),
  
  // Error Handling
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),
  lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),
  
  // Metadata
  postMetadata: jsonb('post_metadata').default({}),
  
  // Audit
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => ({
  organizationIdx: index('idx_social_posts_organization').on(table.organizationId),
  accountIdx: index('idx_social_posts_account').on(table.accountId),
  campaignIdx: index('idx_social_posts_campaign').on(table.campaignId),
  statusIdx: index('idx_social_posts_status').on(table.status),
  scheduledIdx: index('idx_social_posts_scheduled').on(table.scheduledFor),
  publishedIdx: index('idx_social_posts_published').on(table.publishedAt)
}));

// Social Media Campaigns
export const socialCampaigns = pgTable('social_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Campaign Details
  name: text('name').notNull(),
  description: text('description'),
  campaignCode: text('campaign_code'),
  
  // Campaign Targeting
  platforms: text('platforms').array(), // social_platform[] in SQL
  targetAudience: text('target_audience'),
  campaignHashtags: text('campaign_hashtags').array(),
  
  // Campaign Schedule
  status: campaignStatusEnum('status').notNull().default('planning'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  
  // Campaign Goals
  goalImpressions: integer('goal_impressions'),
  goalEngagementRate: decimal('goal_engagement_rate', { precision: 5, scale: 2 }),
  goalConversions: integer('goal_conversions'),
  
  // Campaign Metadata
  campaignMetadata: jsonb('campaign_metadata').default({}),
  
  // Audit
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  organizationIdx: index('idx_social_campaigns_organization').on(table.organizationId),
  statusIdx: index('idx_social_campaigns_status').on(table.status),
  datesIdx: index('idx_social_campaigns_dates').on(table.startDate, table.endDate)
}));

// Social Media Analytics
export const socialAnalytics = pgTable('social_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => socialAccounts.id, { onDelete: 'cascade' }),
  
  // Analytics Date
  analyticsDate: date('analytics_date').notNull(),
  
  // Follower Metrics
  followerCount: integer('follower_count').default(0),
  followerChange: integer('follower_change').default(0),
  followingCount: integer('following_count').default(0),
  
  // Content Metrics
  postsPublished: integer('posts_published').default(0),
  totalImpressions: integer('total_impressions').default(0),
  totalReach: integer('total_reach').default(0),
  
  // Engagement Metrics
  totalLikes: integer('total_likes').default(0),
  totalComments: integer('total_comments').default(0),
  totalShares: integer('total_shares').default(0),
  totalEngagements: integer('total_engagements').default(0),
  engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }),
  
  // Traffic Metrics
  profileVisits: integer('profile_visits').default(0),
  linkClicks: integer('link_clicks').default(0),
  
  // Metadata
  analyticsMetadata: jsonb('analytics_metadata').default({}),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  organizationIdx: index('idx_social_analytics_organization').on(table.organizationId),
  accountIdx: index('idx_social_analytics_account').on(table.accountId),
  dateIdx: index('idx_social_analytics_date').on(table.analyticsDate),
  accountDateIdx: index('idx_social_analytics_account_date').on(table.accountId, table.analyticsDate),
  uniqueAccountDate: unique().on(table.accountId, table.analyticsDate)
}));

// Social Media Feeds
export const socialFeeds = pgTable('social_feeds', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => socialAccounts.id, { onDelete: 'cascade' }),
  
  // Feed Item Details
  platformItemId: text('platform_item_id').notNull(),
  itemType: text('item_type').notNull(),
  content: text('content'),
  mediaUrls: text('media_urls').array(),
  
  // Author Details
  authorId: text('author_id'),
  authorName: text('author_name'),
  authorUsername: text('author_username'),
  authorImageUrl: text('author_image_url'),
  
  // Engagement
  likesCount: integer('likes_count').default(0),
  commentsCount: integer('comments_count').default(0),
  sharesCount: integer('shares_count').default(0),
  
  // Timestamps
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  
  // Metadata
  feedMetadata: jsonb('feed_metadata').default({}),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  organizationIdx: index('idx_social_feeds_organization').on(table.organizationId),
  accountIdx: index('idx_social_feeds_account').on(table.accountId),
  publishedIdx: index('idx_social_feeds_published').on(table.publishedAt),
  uniqueAccountItem: unique().on(table.accountId, table.platformItemId)
}));

// Social Media Engagement
export const socialEngagement = pgTable('social_engagement', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => socialPosts.id, { onDelete: 'cascade' }),
  
  // Engagement Details
  engagementType: engagementTypeEnum('engagement_type').notNull(),
  platformEngagementId: text('platform_engagement_id'),
  
  // User Details
  platformUserId: text('platform_user_id'),
  username: text('username'),
  displayName: text('display_name'),
  profileImageUrl: text('profile_image_url'),
  
  // Engagement Content
  content: text('content'),
  sentiment: text('sentiment'),
  sentimentScore: decimal('sentiment_score', { precision: 5, scale: 2 }),
  
  // Timestamps
  engagedAt: timestamp('engaged_at', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  
  // Metadata
  engagementMetadata: jsonb('engagement_metadata').default({}),
  
  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  organizationIdx: index('idx_social_engagement_organization').on(table.organizationId),
  postIdx: index('idx_social_engagement_post').on(table.postId),
  typeIdx: index('idx_social_engagement_type').on(table.engagementType),
  engagedAtIdx: index('idx_social_engagement_engaged_at').on(table.engagedAt),
  sentimentIdx: index('idx_social_engagement_sentiment').on(table.sentiment)
}));

// ================================================================
// RELATIONS
// ================================================================

export const socialAccountsRelations = relations(socialAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [socialAccounts.organizationId],
    references: [organizations.id]
  }),
  connectedByProfile: one(profiles, {
    fields: [socialAccounts.connectedBy],
    references: [profiles.userId]
  }),
  posts: many(socialPosts),
  analytics: many(socialAnalytics),
  feeds: many(socialFeeds)
}));

export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [socialPosts.organizationId],
    references: [organizations.id]
  }),
  account: one(socialAccounts, {
    fields: [socialPosts.accountId],
    references: [socialAccounts.id]
  }),
  campaign: one(socialCampaigns, {
    fields: [socialPosts.campaignId],
    references: [socialCampaigns.id]
  }),
  createdByProfile: one(profiles, {
    fields: [socialPosts.createdBy],
    references: [profiles.userId]
  }),
  engagements: many(socialEngagement)
}));

export const socialCampaignsRelations = relations(socialCampaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [socialCampaigns.organizationId],
    references: [organizations.id]
  }),
  createdByProfile: one(profiles, {
    fields: [socialCampaigns.createdBy],
    references: [profiles.userId]
  }),
  posts: many(socialPosts)
}));

export const socialAnalyticsRelations = relations(socialAnalytics, ({ one }) => ({
  organization: one(organizations, {
    fields: [socialAnalytics.organizationId],
    references: [organizations.id]
  }),
  account: one(socialAccounts, {
    fields: [socialAnalytics.accountId],
    references: [socialAccounts.id]
  })
}));

export const socialFeedsRelations = relations(socialFeeds, ({ one }) => ({
  organization: one(organizations, {
    fields: [socialFeeds.organizationId],
    references: [organizations.id]
  }),
  account: one(socialAccounts, {
    fields: [socialFeeds.accountId],
    references: [socialAccounts.id]
  })
}));

export const socialEngagementRelations = relations(socialEngagement, ({ one }) => ({
  organization: one(organizations, {
    fields: [socialEngagement.organizationId],
    references: [organizations.id]
  }),
  post: one(socialPosts, {
    fields: [socialEngagement.postId],
    references: [socialPosts.id]
  })
}));

// ================================================================
// TYPE EXPORTS
// ================================================================

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type NewSocialAccount = typeof socialAccounts.$inferInsert;

export type SocialPost = typeof socialPosts.$inferSelect;
export type NewSocialPost = typeof socialPosts.$inferInsert;

export type SocialCampaign = typeof socialCampaigns.$inferSelect;
export type NewSocialCampaign = typeof socialCampaigns.$inferInsert;

export type SocialAnalytics = typeof socialAnalytics.$inferSelect;
export type NewSocialAnalytics = typeof socialAnalytics.$inferInsert;

export type SocialFeed = typeof socialFeeds.$inferSelect;
export type NewSocialFeed = typeof socialFeeds.$inferInsert;

export type SocialEngagement = typeof socialEngagement.$inferSelect;
export type NewSocialEngagement = typeof socialEngagement.$inferInsert;

// Enum Types
export type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok';
export type SocialAccountStatus = 'active' | 'expired' | 'disconnected' | 'rate_limited' | 'suspended';
export type SocialPostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'deleted';
export type SocialPostType = 'text' | 'image' | 'video' | 'link' | 'carousel' | 'story' | 'reel';
export type EngagementType = 'like' | 'comment' | 'share' | 'retweet' | 'reply' | 'reaction' | 'mention' | 'tag';
export type CampaignStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

// Helper Interfaces
export interface PostMetadata {
  hashtag_performance?: Record<string, number>;
  best_time_to_post?: string;
  target_demographics?: string[];
  ab_test_variant?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface CampaignMetadata {
  budget?: number;
  actual_spend?: number;
  conversion_tracking?: {
    pixel_id?: string;
    conversion_events?: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface AnalyticsMetadata {
  top_posts?: Array<{ post_id: string; engagement: number }>;
  audience_demographics?: {
    age_ranges?: Record<string, number>;
    gender?: Record<string, number>;
    locations?: Record<string, number>;
  };
  best_posting_times?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}


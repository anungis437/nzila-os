import { pgTable, uuid, text, timestamp, boolean, integer, decimal, jsonb, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';
import { profiles } from '../../profiles-schema';

// =============================================
// CMS SYSTEM
// =============================================

export const cmsPages = pgTable('cms_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id'),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  metaDescription: text('meta_description'),
  metaKeywords: text('meta_keywords').array(),
  ogImage: text('og_image'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentPageId: uuid('parent_page_id').references((): any => cmsPages.id, { onDelete: 'set null' }),
  content: jsonb('content').notNull().default([]),
  status: text('status').notNull().default('draft'), // 'draft', 'published', 'scheduled', 'archived'
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  viewCount: integer('view_count').default(0),
  category: text('category'),
  contentType: text('content_type'),
  fileUrl: text('file_url'),
  fileSizeMb: decimal('file_size_mb', { precision: 10, scale: 2 }),
  downloadCount: integer('download_count').default(0),
  isHomepage: boolean('is_homepage').default(false),
  requiresAuth: boolean('requires_auth').default(false),
  allowedRoles: text('allowed_roles').array(),
  seoConfig: jsonb('seo_config').default({}),
  createdBy: text('created_by').references(() => profiles.userId),
  updatedBy: text('updated_by').references(() => profiles.userId),
  submittedBy: text('submitted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationSlugUnique: uniqueIndex('cms_pages_organization_slug_unique').on(table.organizationId, table.slug),
  organizationStatusIdx: index('idx_cms_pages_organization_status').on(table.organizationId, table.status),
  slugIdx: index('idx_cms_pages_slug').on(table.organizationId, table.slug),
  publishedIdx: index('idx_cms_pages_published').on(table.organizationId, table.publishedAt),
}));

export const cmsMediaLibrary = pgTable('cms_media_library', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type').notNull(), // 'image', 'video', 'document', 'audio'
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  width: integer('width'),
  height: integer('height'),
  altText: text('alt_text'),
  caption: text('caption'),
  tags: text('tags').array(),
  folder: text('folder').default('/'),
  uploadedBy: text('uploaded_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index('idx_cms_media_organization').on(table.organizationId, table.fileType),
  tagsIdx: index('idx_cms_media_tags').on(table.tags),
}));

// =============================================
// DONATION SYSTEM
// =============================================

export const donationCampaigns = pgTable('donation_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  campaignType: text('campaign_type').notNull(), // 'strike_fund', 'general', 'emergency', 'project', 'legal'
  goalAmount: decimal('goal_amount', { precision: 10, scale: 2 }),
  currentAmount: decimal('current_amount', { precision: 10, scale: 2 }).default('0'),
  currency: text('currency').default('CAD'),
  featuredImage: text('featured_image'),
  videoUrl: text('video_url'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: text('status').notNull().default('active'), // 'draft', 'active', 'paused', 'completed', 'archived'
  allowRecurring: boolean('allow_recurring').default(true),
  suggestedAmounts: integer('suggested_amounts').array(),
  customFields: jsonb('custom_fields').default([]),
  thankYouMessage: text('thank_you_message'),
  emailTemplateId: uuid('email_template_id'),
  pageContent: jsonb('page_content').default([]),
  seoConfig: jsonb('seo_config').default({}),
  stripeProductId: text('stripe_product_id'),
  stripePriceIds: jsonb('stripe_price_ids').default({}),
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationSlugUnique: uniqueIndex('donation_campaigns_organization_slug_unique').on(table.organizationId, table.slug),
  slugIdx: index('idx_donation_campaigns_slug').on(table.organizationId, table.slug),
  statusIdx: index('idx_donation_campaigns_status').on(table.organizationId, table.status),
}));

export const donations = pgTable('donations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => donationCampaigns.id, { onDelete: 'set null' }),
  donorName: text('donor_name'),
  donorEmail: text('donor_email'),
  donorPhone: text('donor_phone'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('CAD'),
  isRecurring: boolean('is_recurring').default(false),
  recurringInterval: text('recurring_interval'), // 'weekly', 'monthly', 'quarterly', 'yearly'
  isAnonymous: boolean('is_anonymous').default(false),
  message: text('message'),
  customData: jsonb('custom_data').default({}),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  paymentStatus: text('payment_status').notNull().default('pending'), // 'pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'
  paymentMethod: text('payment_method'),
  receiptSent: boolean('receipt_sent').default(false),
  receiptUrl: text('receipt_url'),
  taxReceiptNumber: text('tax_receipt_number'),
  taxReceiptIssuedAt: timestamp('tax_receipt_issued_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index('idx_donations_organization').on(table.organizationId, table.createdAt),
  campaignIdx: index('idx_donations_campaign').on(table.campaignId, table.paymentStatus),
  emailIdx: index('idx_donations_email').on(table.donorEmail),
}));

export const donationReceipts = pgTable('donation_receipts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  donationId: uuid('donation_id').notNull().references(() => donations.id, { onDelete: 'cascade' }),
  receiptNumber: text('receipt_number').notNull().unique(),
  receiptType: text('receipt_type').notNull(), // 'payment', 'tax', 'yearly_summary'
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  issueDate: date('issue_date').notNull(),
  pdfUrl: text('pdf_url'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationReceiptUnique: uniqueIndex('donation_receipts_organization_number_unique').on(table.organizationId, table.receiptNumber),
}));

// =============================================
// RELATIONS
// =============================================

export const cmsPagesRelations = relations(cmsPages, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [cmsPages.organizationId],
    references: [organizations.id],
  }),
  parentPage: one(cmsPages, {
    fields: [cmsPages.parentPageId],
    references: [cmsPages.id],
  }),
  childPages: many(cmsPages),
  createdByProfile: one(profiles, {
    fields: [cmsPages.createdBy],
    references: [profiles.userId],
  }),
  updatedByProfile: one(profiles, {
    fields: [cmsPages.updatedBy],
    references: [profiles.userId],
  }),
}));

export const donationCampaignsRelations = relations(donationCampaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [donationCampaigns.organizationId],
    references: [organizations.id],
  }),
  donations: many(donations),
  createdByProfile: one(profiles, {
    fields: [donationCampaigns.createdBy],
    references: [profiles.userId],
  }),
}));

export const donationsRelations = relations(donations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [donations.organizationId],
    references: [organizations.id],
  }),
  campaign: one(donationCampaigns, {
    fields: [donations.campaignId],
    references: [donationCampaigns.id],
  }),
  receipts: many(donationReceipts),
}));

export const donationReceiptsRelations = relations(donationReceipts, ({ one }) => ({
  organization: one(organizations, {
    fields: [donationReceipts.organizationId],
    references: [organizations.id],
  }),
  donation: one(donations, {
    fields: [donationReceipts.donationId],
    references: [donations.id],
  }),
}));

// =============================================
// TYPESCRIPT TYPES
// =============================================


export type CmsPage = typeof cmsPages.$inferSelect;
export type NewCmsPage = typeof cmsPages.$inferInsert;



export type CmsMedia = typeof cmsMediaLibrary.$inferSelect;
export type NewCmsMedia = typeof cmsMediaLibrary.$inferInsert;

export type DonationCampaign = typeof donationCampaigns.$inferSelect;
export type NewDonationCampaign = typeof donationCampaigns.$inferInsert;

export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;

export type DonationReceipt = typeof donationReceipts.$inferSelect;
export type NewDonationReceipt = typeof donationReceipts.$inferInsert;

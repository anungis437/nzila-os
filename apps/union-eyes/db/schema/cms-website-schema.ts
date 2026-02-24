import { pgTable, uuid, text, timestamp, boolean, integer, decimal, jsonb, date, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { profiles } from './profiles-schema';

// =============================================
// CMS SYSTEM
// =============================================

export const cmsTemplates = pgTable('cms_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  templateType: text('template_type').notNull(), // 'page', 'post', 'event', 'landing', 'custom'
  category: text('category'),
  thumbnailUrl: text('thumbnail_url'),
  layoutConfig: jsonb('layout_config').notNull().default({}),
  isSystem: boolean('is_system').default(false),
  isPublished: boolean('is_published').default(true),
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index('idx_cms_templates_organization').on(table.organizationId),
}));

export const cmsPages = pgTable('cms_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => cmsTemplates.id, { onDelete: 'set null' }),
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
  isHomepage: boolean('is_homepage').default(false),
  requiresAuth: boolean('requires_auth').default(false),
  allowedRoles: text('allowed_roles').array(),
  seoConfig: jsonb('seo_config').default({}),
  createdBy: text('created_by').references(() => profiles.userId),
  updatedBy: text('updated_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationSlugUnique: uniqueIndex('cms_pages_organization_slug_unique').on(table.organizationId, table.slug),
  organizationStatusIdx: index('idx_cms_pages_organization_status').on(table.organizationId, table.status),
  slugIdx: index('idx_cms_pages_slug').on(table.organizationId, table.slug),
  publishedIdx: index('idx_cms_pages_published').on(table.organizationId, table.publishedAt),
}));

export const cmsBlocks = pgTable('cms_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  blockType: text('block_type').notNull(), // 'text', 'heading', 'image', 'video', 'gallery', 'button', etc.
  category: text('category'),
  content: jsonb('content').notNull().default({}),
  styles: jsonb('styles').default({}),
  isReusable: boolean('is_reusable').default(false),
  thumbnailUrl: text('thumbnail_url'),
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const cmsNavigationMenus = pgTable('cms_navigation_menus', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  location: text('location').notNull(), // 'header', 'footer', 'sidebar', 'mobile'
  items: jsonb('items').notNull().default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationLocationUnique: uniqueIndex('cms_navigation_organization_location_unique').on(table.organizationId, table.location),
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
// EVENT REGISTRATION SYSTEM
// =============================================

export const publicEvents = pgTable('public_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  eventType: text('event_type').notNull(), // 'meeting', 'rally', 'training', 'social', 'fundraiser', 'conference', 'webinar'
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  timezone: text('timezone').default('America/Toronto'),
  locationType: text('location_type').notNull(), // 'in_person', 'virtual', 'hybrid'
  venueName: text('venue_name'),
  venueAddress: text('venue_address'),
  venueCity: text('venue_city'),
  venueState: text('venue_state'),
  venuePostalCode: text('venue_postal_code'),
  venueCountry: text('venue_country').default('Canada'),
  virtualLink: text('virtual_link'),
  virtualPlatform: text('virtual_platform'),
  featuredImage: text('featured_image'),
  capacity: integer('capacity'),
  registeredCount: integer('registered_count').default(0),
  waitlistEnabled: boolean('waitlist_enabled').default(true),
  registrationOpens: timestamp('registration_opens', { withTimezone: true }),
  registrationCloses: timestamp('registration_closes', { withTimezone: true }),
  registrationStatus: text('registration_status').notNull().default('open'), // 'draft', 'open', 'closed', 'full', 'cancelled'
  isFree: boolean('is_free').default(true),
  ticketPrice: decimal('ticket_price', { precision: 10, scale: 2 }),
  memberPrice: decimal('member_price', { precision: 10, scale: 2 }),
  currency: text('currency').default('CAD'),
  customFields: jsonb('custom_fields').default([]),
  confirmationEmailTemplate: text('confirmation_email_template'),
  reminderEmailTemplate: text('reminder_email_template'),
  pageContent: jsonb('page_content').default([]),
  seoConfig: jsonb('seo_config').default({}),
  tags: text('tags').array(),
  organizerName: text('organizer_name'),
  organizerEmail: text('organizer_email'),
  organizerPhone: text('organizer_phone'),
  stripeProductId: text('stripe_product_id'),
  stripePriceId: text('stripe_price_id'),
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationSlugUnique: uniqueIndex('public_events_organization_slug_unique').on(table.organizationId, table.slug),
  organizationIdx: index('idx_events_organization').on(table.organizationId, table.startDate),
  slugIdx: index('idx_events_slug').on(table.organizationId, table.slug),
  statusIdx: index('idx_events_status').on(table.organizationId, table.registrationStatus),
  datesIdx: index('idx_events_dates').on(table.startDate, table.endDate),
}));

export const eventRegistrations = pgTable('event_registrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => publicEvents.id, { onDelete: 'cascade' }),
  profileId: text('profile_id').references(() => profiles.userId),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  memberNumber: text('member_number'),
  ticketType: text('ticket_type'), // 'regular', 'member', 'guest', 'vip', 'free'
  ticketPrice: decimal('ticket_price', { precision: 10, scale: 2 }),
  numberOfGuests: integer('number_of_guests').default(0),
  guestNames: text('guest_names').array(),
  customData: jsonb('custom_data').default({}),
  registrationStatus: text('registration_status').notNull().default('confirmed'), // 'pending', 'confirmed', 'waitlist', 'cancelled', 'attended', 'no_show'
  paymentStatus: text('payment_status').default('pending'), // 'pending', 'paid', 'refunded', 'waived'
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paymentMethod: text('payment_method'),
  confirmationSent: boolean('confirmation_sent').default(false),
  reminderSent: boolean('reminder_sent').default(false),
  checkedIn: boolean('checked_in').default(false),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedInBy: text('checked_in_by').references(() => profiles.userId),
  qrCode: text('qr_code'),
  registrationSource: text('registration_source'), // 'web', 'mobile', 'admin', 'import'
  registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  eventIdx: index('idx_event_registrations_event').on(table.eventId, table.registrationStatus),
  emailIdx: index('idx_event_registrations_email').on(table.email),
}));

export const eventCheckIns = pgTable('event_check_ins', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => publicEvents.id, { onDelete: 'cascade' }),
  registrationId: uuid('registration_id').notNull().references(() => eventRegistrations.id, { onDelete: 'cascade' }),
  checkInMethod: text('check_in_method').notNull(), // 'qr_code', 'manual', 'self', 'nfc'
  checkedInBy: text('checked_in_by').references(() => profiles.userId),
  checkInLocation: text('check_in_location'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// =============================================
// JOB BOARD
// =============================================

export const jobPostings = pgTable('job_postings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  employerName: text('employer_name').notNull(),
  employerLogo: text('employer_logo'),
  employerWebsite: text('employer_website'),
  jobType: text('job_type').notNull(), // 'full_time', 'part_time', 'contract', 'temporary', 'casual', 'seasonal', 'apprenticeship'
  category: text('category'),
  description: text('description').notNull(),
  responsibilities: text('responsibilities'),
  qualifications: text('qualifications'),
  benefits: text('benefits'),
  salaryMin: decimal('salary_min', { precision: 10, scale: 2 }),
  salaryMax: decimal('salary_max', { precision: 10, scale: 2 }),
  salaryCurrency: text('salary_currency').default('CAD'),
  salaryPeriod: text('salary_period'), // 'hourly', 'daily', 'weekly', 'monthly', 'yearly'
  salaryDisplay: text('salary_display'),
  locationType: text('location_type').notNull(), // 'on_site', 'remote', 'hybrid'
  city: text('city'),
  province: text('province'),
  country: text('country').default('Canada'),
  remoteAllowed: boolean('remote_allowed').default(false),
  experienceLevel: text('experience_level'), // 'entry', 'intermediate', 'senior', 'lead', 'executive'
  educationRequired: text('education_required'),
  unionAffiliationRequired: boolean('union_affiliation_required').default(false),
  unionName: text('union_name'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone'),
  applicationMethod: text('application_method').notNull(), // 'internal', 'email', 'external_link', 'phone'
  applicationEmail: text('application_email'),
  applicationUrl: text('application_url'),
  applicationInstructions: text('application_instructions'),
  requiresResume: boolean('requires_resume').default(true),
  requiresCoverLetter: boolean('requires_cover_letter').default(false),
  customQuestions: jsonb('custom_questions').default([]),
  status: text('status').notNull().default('active'), // 'draft', 'active', 'paused', 'filled', 'closed', 'expired'
  featured: boolean('featured').default(false),
  viewsCount: integer('views_count').default(0),
  applicationsCount: integer('applications_count').default(0),
  postedDate: date('posted_date').notNull().defaultNow(),
  closingDate: date('closing_date'),
  filledDate: date('filled_date'),
  seoConfig: jsonb('seo_config').default({}),
  tags: text('tags').array(),
  createdBy: text('created_by').references(() => profiles.userId),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationSlugUnique: uniqueIndex('job_postings_organization_slug_unique').on(table.organizationId, table.slug),
  organizationIdx: index('idx_jobs_organization').on(table.organizationId, table.status, table.postedDate),
  slugIdx: index('idx_jobs_slug').on(table.organizationId, table.slug),
  categoryIdx: index('idx_jobs_category').on(table.category, table.status),
  locationIdx: index('idx_jobs_location').on(table.city, table.province, table.status),
  featuredIdx: index('idx_jobs_featured').on(table.featured, table.status, table.postedDate),
}));

export const jobApplications = pgTable('job_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  jobPostingId: uuid('job_posting_id').notNull().references(() => jobPostings.id, { onDelete: 'cascade' }),
  profileId: text('profile_id').references(() => profiles.userId),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  resumeUrl: text('resume_url'),
  coverLetterUrl: text('cover_letter_url'),
  coverLetterText: text('cover_letter_text'),
  linkedinUrl: text('linkedin_url'),
  portfolioUrl: text('portfolio_url'),
  yearsExperience: integer('years_experience'),
  currentEmployer: text('current_employer'),
  currentPosition: text('current_position'),
  availabilityDate: date('availability_date'),
  salaryExpectation: decimal('salary_expectation', { precision: 10, scale: 2 }),
  willingToRelocate: boolean('willing_to_relocate').default(false),
  isUnionMember: boolean('is_union_member').default(false),
  unionLocal: text('union_local'),
  customResponses: jsonb('custom_responses').default({}),
  applicationStatus: text('application_status').notNull().default('new'), // 'new', 'reviewing', 'shortlisted', 'interview_scheduled', 'interviewed', 'offer_extended', 'hired', 'rejected', 'withdrawn'
  statusNotes: text('status_notes'),
  viewedBy: text('viewed_by').references(() => profiles.userId),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  interviewScheduledFor: timestamp('interview_scheduled_for', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  source: text('source'),
  appliedAt: timestamp('applied_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  jobIdx: index('idx_job_applications_job').on(table.jobPostingId, table.applicationStatus),
  emailIdx: index('idx_job_applications_email').on(table.email),
}));

export const jobSaved = pgTable('job_saved', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  profileId: text('profile_id').notNull().references(() => profiles.userId, { onDelete: 'cascade' }),
  jobPostingId: uuid('job_posting_id').notNull().references(() => jobPostings.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  profileJobUnique: uniqueIndex('job_saved_profile_job_unique').on(table.profileId, table.jobPostingId),
}));

// =============================================
// WEBSITE SETTINGS
// =============================================

export const websiteSettings = pgTable('website_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }).unique(),
  siteName: text('site_name').notNull(),
  siteTagline: text('site_tagline'),
  siteDescription: text('site_description'),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: text('primary_color').default('#1E40AF'),
  secondaryColor: text('secondary_color').default('#F59E0B'),
  fontFamily: text('font_family').default('Inter'),
  footerText: text('footer_text'),
  footerLinks: jsonb('footer_links').default([]),
  socialLinks: jsonb('social_links').default({}),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  contactAddress: text('contact_address'),
  googleAnalyticsId: text('google_analytics_id'),
  facebookPixelId: text('facebook_pixel_id'),
  customCss: text('custom_css'),
  customJs: text('custom_js'),
  maintenanceMode: boolean('maintenance_mode').default(false),
  maintenanceMessage: text('maintenance_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// =============================================
// ANALYTICS
// =============================================

export const pageAnalytics = pgTable('page_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  pageId: uuid('page_id').references(() => cmsPages.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').references(() => publicEvents.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').references(() => jobPostings.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => donationCampaigns.id, { onDelete: 'cascade' }),
  metricDate: date('metric_date').notNull().defaultNow(),
  pageViews: integer('page_views').default(0),
  uniqueVisitors: integer('unique_visitors').default(0),
  avgTimeOnPage: integer('avg_time_on_page').default(0),
  bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }).default('0'),
  trafficSources: jsonb('traffic_sources').default({}),
  deviceBreakdown: jsonb('device_breakdown').default({}),
  conversionCount: integer('conversion_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationPageDateUnique: uniqueIndex('page_analytics_organization_page_date_unique').on(table.organizationId, table.pageId, table.metricDate),
}));

// =============================================
// RELATIONS
// =============================================

export const cmsTemplatesRelations = relations(cmsTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [cmsTemplates.organizationId],
    references: [organizations.id],
  }),
  pages: many(cmsPages),
  createdByProfile: one(profiles, {
    fields: [cmsTemplates.createdBy],
    references: [profiles.userId],
  }),
}));

export const cmsPagesRelations = relations(cmsPages, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [cmsPages.organizationId],
    references: [organizations.id],
  }),
  template: one(cmsTemplates, {
    fields: [cmsPages.templateId],
    references: [cmsTemplates.id],
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
  analytics: many(pageAnalytics),
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
  analytics: many(pageAnalytics),
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

export const publicEventsRelations = relations(publicEvents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [publicEvents.organizationId],
    references: [organizations.id],
  }),
  registrations: many(eventRegistrations),
  checkIns: many(eventCheckIns),
  createdByProfile: one(profiles, {
    fields: [publicEvents.createdBy],
    references: [profiles.userId],
  }),
  analytics: many(pageAnalytics),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [eventRegistrations.organizationId],
    references: [organizations.id],
  }),
  event: one(publicEvents, {
    fields: [eventRegistrations.eventId],
    references: [publicEvents.id],
  }),
  profile: one(profiles, {
    fields: [eventRegistrations.profileId],
    references: [profiles.userId],
  }),
  checkedInByProfile: one(profiles, {
    fields: [eventRegistrations.checkedInBy],
    references: [profiles.userId],
  }),
  checkIns: many(eventCheckIns),
}));

export const eventCheckInsRelations = relations(eventCheckIns, ({ one }) => ({
  organization: one(organizations, {
    fields: [eventCheckIns.organizationId],
    references: [organizations.id],
  }),
  event: one(publicEvents, {
    fields: [eventCheckIns.eventId],
    references: [publicEvents.id],
  }),
  registration: one(eventRegistrations, {
    fields: [eventCheckIns.registrationId],
    references: [eventRegistrations.id],
  }),
  checkedInByProfile: one(profiles, {
    fields: [eventCheckIns.checkedInBy],
    references: [profiles.userId],
  }),
}));

export const jobPostingsRelations = relations(jobPostings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [jobPostings.organizationId],
    references: [organizations.id],
  }),
  applications: many(jobApplications),
  saved: many(jobSaved),
  createdByProfile: one(profiles, {
    fields: [jobPostings.createdBy],
    references: [profiles.userId],
  }),
  analytics: many(pageAnalytics),
}));

export const jobApplicationsRelations = relations(jobApplications, ({ one }) => ({
  organization: one(organizations, {
    fields: [jobApplications.organizationId],
    references: [organizations.id],
  }),
  jobPosting: one(jobPostings, {
    fields: [jobApplications.jobPostingId],
    references: [jobPostings.id],
  }),
  profile: one(profiles, {
    fields: [jobApplications.profileId],
    references: [profiles.userId],
  }),
  viewedByProfile: one(profiles, {
    fields: [jobApplications.viewedBy],
    references: [profiles.userId],
  }),
}));

export const jobSavedRelations = relations(jobSaved, ({ one }) => ({
  organization: one(organizations, {
    fields: [jobSaved.organizationId],
    references: [organizations.id],
  }),
  profile: one(profiles, {
    fields: [jobSaved.profileId],
    references: [profiles.userId],
  }),
  jobPosting: one(jobPostings, {
    fields: [jobSaved.jobPostingId],
    references: [jobPostings.id],
  }),
}));

export const websiteSettingsRelations = relations(websiteSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [websiteSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const pageAnalyticsRelations = relations(pageAnalytics, ({ one }) => ({
  organization: one(organizations, {
    fields: [pageAnalytics.organizationId],
    references: [organizations.id],
  }),
  page: one(cmsPages, {
    fields: [pageAnalytics.pageId],
    references: [cmsPages.id],
  }),
  event: one(publicEvents, {
    fields: [pageAnalytics.eventId],
    references: [publicEvents.id],
  }),
  job: one(jobPostings, {
    fields: [pageAnalytics.jobId],
    references: [jobPostings.id],
  }),
  campaign: one(donationCampaigns, {
    fields: [pageAnalytics.campaignId],
    references: [donationCampaigns.id],
  }),
}));

// =============================================
// TYPESCRIPT TYPES
// =============================================

export type CmsTemplate = typeof cmsTemplates.$inferSelect;
export type NewCmsTemplate = typeof cmsTemplates.$inferInsert;

export type CmsPage = typeof cmsPages.$inferSelect;
export type NewCmsPage = typeof cmsPages.$inferInsert;

export type CmsBlock = typeof cmsBlocks.$inferSelect;
export type NewCmsBlock = typeof cmsBlocks.$inferInsert;

export type CmsNavigationMenu = typeof cmsNavigationMenus.$inferSelect;
export type NewCmsNavigationMenu = typeof cmsNavigationMenus.$inferInsert;

export type CmsMedia = typeof cmsMediaLibrary.$inferSelect;
export type NewCmsMedia = typeof cmsMediaLibrary.$inferInsert;

export type DonationCampaign = typeof donationCampaigns.$inferSelect;
export type NewDonationCampaign = typeof donationCampaigns.$inferInsert;

export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;

export type DonationReceipt = typeof donationReceipts.$inferSelect;
export type NewDonationReceipt = typeof donationReceipts.$inferInsert;

export type PublicEvent = typeof publicEvents.$inferSelect;
export type NewPublicEvent = typeof publicEvents.$inferInsert;

export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type NewEventRegistration = typeof eventRegistrations.$inferInsert;

export type EventCheckIn = typeof eventCheckIns.$inferSelect;
export type NewEventCheckIn = typeof eventCheckIns.$inferInsert;

export type JobPosting = typeof jobPostings.$inferSelect;
export type NewJobPosting = typeof jobPostings.$inferInsert;

export type JobApplication = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;

export type JobSaved = typeof jobSaved.$inferSelect;
export type NewJobSaved = typeof jobSaved.$inferInsert;

export type WebsiteSettings = typeof websiteSettings.$inferSelect;
export type NewWebsiteSettings = typeof websiteSettings.$inferInsert;

export type PageAnalytics = typeof pageAnalytics.$inferSelect;
export type NewPageAnalytics = typeof pageAnalytics.$inferInsert;


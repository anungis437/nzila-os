/**
 * Federation Management Schema
 * 
 * Purpose: Provincial/Regional Labor Federation Management
 * Hierarchy: CLC (National) → Federation (Provincial/Regional) → Union (Local)
 * 
 * Federation Role:
 * - Coordinate provincial/regional labor activities
 * - Aggregate per-capita remittances from member unions
 * - Support organizing campaigns across jurisdictions
 * - Share resources and best practices
 * - Represent labor interests at provincial/regional level
 * 
 * RLS Notes:
 * - Federation executives can manage their own federation data
 * - Member unions can view federation information they belong to
 * - CLC staff have read access to all federation data
 * - System admins have full access
 * 
 * Integration Points:
 * - organizations: Link to both federations and member unions
 * - profiles: Link to federation executives and delegates
 * - per_capita_remittances: Track payments from unions to federations (and federations to CLC)
 * - clc_partnership: Federation-level benchmarking data
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
  jsonb,
  index,
  foreignKey,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';
import { profilesTable as _profiles } from '../../profiles-schema';
import { perCapitaRemittances } from '../../clc-per-capita-schema';

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Federation Type Enum
 * Defines the scope and structure of labor federations
 */
export const federationTypeEnum = pgEnum('federation_type', [
  'provincial',    // Province-wide labor federation (e.g., OFL, FTQ)
  'regional',      // Regional/district labor council (e.g., Toronto & York Region Labour Council)
  'sectoral',      // Sector-specific federation (e.g., healthcare workers federation)
  'international', // International/cross-border federation affiliate
]);

/**
 * Federation Membership Status Enum
 * Tracks union affiliation with federations
 */
export const federationMembershipStatusEnum = pgEnum('federation_membership_status', [
  'active',        // Current dues-paying member
  'pending',       // Application submitted, pending approval
  'suspended',     // Temporarily suspended (e.g., dues arrears)
  'withdrawn',     // Voluntary withdrawal from federation
  'expelled',      // Removed for cause
  'inactive',      // Inactive but still recognized
]);

/**
 * Federation Meeting Type Enum
 * Different types of federation gatherings
 */
export const federationMeetingTypeEnum = pgEnum('federation_meeting_type', [
  'convention',           // Annual/biennial convention
  'executive_meeting',    // Executive council meeting
  'general_meeting',      // General membership meeting
  'committee_meeting',    // Standing committee meeting
  'emergency_meeting',    // Emergency/special meeting
  'workshop',            // Educational workshop
  'conference',          // Multi-day conference
  'webinar',             // Virtual meeting/webinar
]);

/**
 * Federation Campaign Type Enum
 * Types of provincial/regional campaigns
 */
export const federationCampaignTypeEnum = pgEnum('federation_campaign_type', [
  'organizing',          // New union organizing drive
  'political',           // Political/electoral campaign
  'legislative',         // Legislative advocacy campaign
  'public_awareness',    // Public education/awareness
  'solidarity',          // Solidarity action/mutual aid
  'strike_support',      // Supporting strike action
  'health_safety',       // Health and safety campaign
  'equity',              // Equity and inclusion campaign
]);

/**
 * Federation Communication Type Enum
 * Types of federation communications
 */
export const federationCommunicationTypeEnum = pgEnum('federation_communication_type', [
  'announcement',        // General announcement
  'alert',              // Urgent alert/action required
  'newsletter',         // Regular newsletter
  'bulletin',           // Special bulletin
  'press_release',      // Media press release
  'internal_memo',      // Internal communication
  'survey',             // Member survey
  'event_notice',       // Event notification
]);

/**
 * Federation Resource Type Enum
 * Types of shared resources
 */
export const federationResourceTypeEnum = pgEnum('federation_resource_type', [
  'template',           // Document template (CBA, grievance, etc.)
  'toolkit',            // Complete toolkit or guide
  'policy',             // Model policy or resolution
  'training',           // Training material
  'research',           // Research report or study
  'best_practice',      // Best practice guide
  'legal',              // Legal resource or precedent
  'organizing',         // Organizing tool or strategy
]);

// =============================================================================
// MAIN TABLES
// =============================================================================

/**
 * Federations Table
 * Provincial/Regional Labor Federations
 * 
 * Represents labor federations that coordinate activities across multiple unions
 * within a province, region, or sector.
 */
export const federations = pgTable(
  'federations',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Organization Link
    organizationId: uuid('organization_id').notNull(), // Link to organizations table (type: 'federation')

    // Basic Information
    name: varchar('name', { length: 255 }).notNull(),
    shortName: varchar('short_name', { length: 100 }),
    slug: varchar('slug', { length: 255 }).notNull(),
    federationType: federationTypeEnum('federation_type').notNull().default('provincial'),
    
    // Jurisdiction
    province: varchar('province', { length: 2 }), // CA province/territory code (ON, BC, QC, etc.)
    region: varchar('region', { length: 100 }), // Regional identifier (e.g., "Toronto & York Region")
    jurisdiction: varchar('jurisdiction', { length: 100 }), // Detailed jurisdiction description
    
    // Contact Information
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    website: text('website'),
    address: jsonb('address').$type<{
      street?: string;
      unit?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
    }>(),
    
    // Federation Details
    foundedDate: date('founded_date'),
    affiliatedWithClc: boolean('affiliated_with_clc').default(true),
    clcAffiliateCode: varchar('clc_affiliate_code', { length: 50 }), // CLC affiliation identifier
    
    // Membership
    totalMemberUnions: integer('total_member_unions').default(0),
    totalRepresentedWorkers: integer('total_represented_workers').default(0), // Aggregate from member unions
    
    // Finance
    perCapitaRate: numeric('per_capita_rate', { precision: 10, scale: 4 }), // Rate charged to member unions
    currency: varchar('currency', { length: 3 }).default('CAD'),
    fiscalYearEnd: varchar('fiscal_year_end', { length: 5 }), // MM-DD format
    
    // Status
    status: varchar('status', { length: 20 }).default('active'), // active, inactive, suspended
    isActive: boolean('is_active').default(true),
    
    // Metadata
    description: text('description'),
    mission: text('mission'),
    constitution: text('constitution'), // URL to constitution document
    bylaws: text('bylaws'), // URL to bylaws document
    strategicPlan: text('strategic_plan'), // URL to strategic plan
    
    // Settings
    settings: jsonb('settings').$type<{
      allowPublicDirectory?: boolean;
      requireApprovalForMembership?: boolean;
      enableRemittanceTracking?: boolean;
      enableCampaignManagement?: boolean;
      autoSyncWithClc?: boolean;
      notificationPreferences?: {
        newMembership?: boolean;
        remittanceOverdue?: boolean;
        campaignUpdates?: boolean;
      };
    }>(),
    
    // Additional Data
    metadata: jsonb('metadata').$type<{
      sectors?: string[];
      languages?: string[];
      affiliations?: { name: string; code?: string }[];
      socialMedia?: { platform: string; handle: string }[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customFields?: Record<string, any>;
    }>(),
    
    // Audit Fields
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    createdBy: varchar('created_by', { length: 255 }), // User ID
    updatedBy: varchar('updated_by', { length: 255 }), // User ID
  },
  (table) => ({
    // Indexes
    idxFederationsOrgId: index('idx_federations_organization_id').on(table.organizationId),
    idxFederationsSlug: index('idx_federations_slug').on(table.slug),
    idxFederationsProvince: index('idx_federations_province').on(table.province),
    idxFederationsType: index('idx_federations_type').on(table.federationType),
    idxFederationsStatus: index('idx_federations_status').on(table.status),
    idxFederationsClcCode: index('idx_federations_clc_affiliate_code').on(table.clcAffiliateCode),

    // Foreign Keys
    federationsOrganizationIdFkey: foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'federations_organization_id_fkey',
    }),

    // Unique Constraints
    uniqueFederationSlug: unique('federations_slug_key').on(table.slug),
    uniqueFederationOrgId: unique('federations_organization_id_key').on(table.organizationId),
  })
);

/**
 * Federation Remittances Table
 * Track per-capita payments from unions to federations (and federations to CLC)
 * 
 * Records financial remittances flowing from member unions to federations,
 * and from federations to the CLC. Integrates with per_capita_remittances table.
 */
export const federationRemittances = pgTable(
  'federation_remittances',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Relationships
    federationId: uuid('federation_id').notNull(),
    fromOrganizationId: uuid('from_organization_id').notNull(), // Union paying to federation (or federation paying to CLC)
    toOrganizationId: uuid('to_organization_id').notNull(), // Receiving organization (federation or CLC)
    membershipId: uuid('membership_id'), // Link to federation_memberships if applicable
    perCapitaRemittanceId: uuid('per_capita_remittance_id'), // Link to CLC per_capita_remittances if federation→CLC payment
    
    // Remittance Period
    remittanceMonth: integer('remittance_month').notNull(), // 1-12
    remittanceYear: integer('remittance_year').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    dueDate: date('due_date').notNull(),
    
    // Member Count
    totalMembers: integer('total_members').notNull(),
    remittableMembers: integer('remittable_members').notNull(), // Members subject to per-capita
    
    // Financial Details
    perCapitaRate: numeric('per_capita_rate', { precision: 10, scale: 4 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('CAD'),
    
    // Payment Status
    status: varchar('status', { length: 20 }).default('pending'), // pending, partial, paid, overdue, waived
    paymentStatus: varchar('payment_status', { length: 20 }).default('unpaid'), // unpaid, partial, paid
    amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0'),
    amountOutstanding: numeric('amount_outstanding', { precision: 12, scale: 2 }),
    
    // Payment Details
    paidDate: timestamp('paid_date', { withTimezone: true, mode: 'string' }),
    paymentMethod: varchar('payment_method', { length: 50 }), // cheque, eft, wire, credit, cash
    paymentReference: varchar('payment_reference', { length: 100 }), // Transaction reference number
    chequeNumber: varchar('cheque_number', { length: 50 }),
    
    // Approval Workflow
    approvalStatus: varchar('approval_status', { length: 20 }).default('draft'), // draft, submitted, approved, rejected
    submittedDate: timestamp('submitted_date', { withTimezone: true, mode: 'string' }),
    submittedBy: varchar('submitted_by', { length: 255 }),
    approvedDate: timestamp('approved_date', { withTimezone: true, mode: 'string' }),
    approvedBy: varchar('approved_by', { length: 255 }),
    rejectedDate: timestamp('rejected_date', { withTimezone: true, mode: 'string' }),
    rejectedBy: varchar('rejected_by', { length: 255 }),
    rejectionReason: text('rejection_reason'),
    
    // Documents
    invoiceUrl: text('invoice_url'),
    receiptUrl: text('receipt_url'),
    remittanceFileUrl: text('remittance_file_url'),
    
    // Accounting
    glAccount: varchar('gl_account', { length: 50 }), // General ledger account code
    fiscalPeriod: varchar('fiscal_period', { length: 20 }), // e.g., "2024-Q1"
    
    // Late Fees & Adjustments
    lateFeeAmount: numeric('late_fee_amount', { precision: 10, scale: 2 }).default('0'),
    adjustmentAmount: numeric('adjustment_amount', { precision: 10, scale: 2 }).default('0'),
    adjustmentReason: text('adjustment_reason'),
    
    // Additional Info
    notes: text('notes'),
    
    // Metadata
    metadata: jsonb('metadata').$type<{
      automatedReminder?: boolean;
      remindersSent?: number;
      lastReminderDate?: string;
      paymentPlan?: { installments: number; schedule: string[] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customFields?: Record<string, any>;
    }>(),
    
    // Audit Fields
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    createdBy: varchar('created_by', { length: 255 }),
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (table) => ({
    // Indexes
    idxRemittancesFederationId: index('idx_federation_remittances_federation_id').on(table.federationId),
    idxRemittancesFromOrgId: index('idx_federation_remittances_from_organization_id').on(table.fromOrganizationId),
    idxRemittancesToOrgId: index('idx_federation_remittances_to_organization_id').on(table.toOrganizationId),
    idxRemittancesDueDate: index('idx_federation_remittances_due_date').on(table.dueDate),
    idxRemittancesStatus: index('idx_federation_remittances_status').on(table.status),
    idxRemittancesPeriod: index('idx_federation_remittances_period').on(table.remittanceYear, table.remittanceMonth),
    idxRemittancesPerCapitaId: index('idx_federation_remittances_per_capita_remittance_id').on(table.perCapitaRemittanceId),

    // Foreign Keys
    remittancesFederationIdFkey: foreignKey({
      columns: [table.federationId],
      foreignColumns: [federations.id],
      name: 'federation_remittances_federation_id_fkey',
    }),
    remittancesFromOrgIdFkey: foreignKey({
      columns: [table.fromOrganizationId],
      foreignColumns: [organizations.id],
      name: 'federation_remittances_from_organization_id_fkey',
    }),
    remittancesToOrgIdFkey: foreignKey({
      columns: [table.toOrganizationId],
      foreignColumns: [organizations.id],
      name: 'federation_remittances_to_organization_id_fkey',
    }),
    remittancesPerCapitaIdFkey: foreignKey({
      columns: [table.perCapitaRemittanceId],
      foreignColumns: [perCapitaRemittances.id],
      name: 'federation_remittances_per_capita_remittance_id_fkey',
    }),

    // Unique Constraints
    uniqueFederationRemittancePeriod: unique('federation_remittances_unique_period').on(
      table.federationId,
      table.fromOrganizationId,
      table.remittanceYear,
      table.remittanceMonth
    ),
  })
);

// =============================================================================
// RELATIONS
// =============================================================================

/**
 * Federations Relations
 */
export const federationsRelations = relations(federations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [federations.organizationId],
    references: [organizations.id],
    relationName: 'federations_organizationId_organizations_id',
  }),
  remittances: many(federationRemittances, {
    relationName: 'federations_remittances',
  }),
}));

/**
 * Federation Remittances Relations
 */
export const federationRemittancesRelations = relations(federationRemittances, ({ one }) => ({
  federation: one(federations, {
    fields: [federationRemittances.federationId],
    references: [federations.id],
    relationName: 'federations_remittances',
  }),
  fromOrganization: one(organizations, {
    fields: [federationRemittances.fromOrganizationId],
    references: [organizations.id],
    relationName: 'remittances_fromOrganization',
  }),
  toOrganization: one(organizations, {
    fields: [federationRemittances.toOrganizationId],
    references: [organizations.id],
    relationName: 'remittances_toOrganization',
  }),
  perCapitaRemittance: one(perCapitaRemittances, {
    fields: [federationRemittances.perCapitaRemittanceId],
    references: [perCapitaRemittances.id],
    relationName: 'remittances_perCapita',
  }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Federation types
export type Federation = typeof federations.$inferSelect;
export type InsertFederation = typeof federations.$inferInsert;

// Federation Membership types

// Federation Executive types

// Federation Meeting types

// Federation Remittance types
export type FederationRemittance = typeof federationRemittances.$inferSelect;
export type InsertFederationRemittance = typeof federationRemittances.$inferInsert;

// Federation Campaign types

// Federation Communication types

// Federation Resource types

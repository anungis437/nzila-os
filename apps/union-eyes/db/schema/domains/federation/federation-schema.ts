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
 * Federation Memberships Table
 * Links unions to their parent federations
 * 
 * Tracks which unions belong to which federations, including membership
 * status, dues obligations, and representation rights.
 */
export const federationMemberships = pgTable(
  'federation_memberships',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Relationships
    federationId: uuid('federation_id').notNull(),
    unionOrganizationId: uuid('union_organization_id').notNull(), // Union's organization ID
    
    // Membership Details
    status: federationMembershipStatusEnum('status').notNull().default('active'),
    membershipNumber: varchar('membership_number', { length: 100 }), // Federation-assigned membership number
    
    // Dates
    joinedDate: date('joined_date').notNull(),
    effectiveDate: date('effective_date'), // When membership becomes active
    suspendedDate: date('suspended_date'),
    terminatedDate: date('terminated_date'),
    lastRenewalDate: date('last_renewal_date'),
    nextRenewalDate: date('next_renewal_date'),
    
    // Membership Type
    membershipType: varchar('membership_type', { length: 50 }).default('full'), // full, associate, affiliate
    votingRights: boolean('voting_rights').default(true),
    executiveEligibility: boolean('executive_eligibility').default(true), // Can hold executive positions
    
    // Financial
    perCapitaRate: numeric('per_capita_rate', { precision: 10, scale: 4 }), // Override rate if different from federation default
    monthlyDues: numeric('monthly_dues', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('CAD'),
    duesInArrears: boolean('dues_in_arrears').default(false),
    arrearsAmount: numeric('arrears_amount', { precision: 12, scale: 2 }).default('0'),
    lastPaymentDate: date('last_payment_date'),
    
    // Representation
    delegateCount: integer('delegate_count').default(1), // Number of delegates union can send to meetings
    executiveSeats: integer('executive_seats').default(0), // Seats on federation executive
    
    // Contact
    primaryContactUserId: varchar('primary_contact_user_id', { length: 255 }),
    primaryContactName: varchar('primary_contact_name', { length: 255 }),
    primaryContactEmail: varchar('primary_contact_email', { length: 255 }),
    primaryContactPhone: varchar('primary_contact_phone', { length: 50 }),
    
    // Status Tracking
    suspensionReason: text('suspension_reason'),
    terminationReason: text('termination_reason'),
    notes: text('notes'),
    
    // Metadata
    metadata: jsonb('metadata').$type<{
      applicationDate?: string;
      approvedBy?: string;
      approvalDate?: string;
      committees?: string[];
      specialInterests?: string[];
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
    idxMembershipsFederationId: index('idx_federation_memberships_federation_id').on(table.federationId),
    idxMembershipsUnionOrgId: index('idx_federation_memberships_union_organization_id').on(table.unionOrganizationId),
    idxMembershipsStatus: index('idx_federation_memberships_status').on(table.status),
    idxMembershipsJoinedDate: index('idx_federation_memberships_joined_date').on(table.joinedDate),
    idxMembershipsPrimaryContact: index('idx_federation_memberships_primary_contact_user_id').on(table.primaryContactUserId),

    // Foreign Keys
    membershipsFederationIdFkey: foreignKey({
      columns: [table.federationId],
      foreignColumns: [federations.id],
      name: 'federation_memberships_federation_id_fkey',
    }),
    membershipsUnionOrgIdFkey: foreignKey({
      columns: [table.unionOrganizationId],
      foreignColumns: [organizations.id],
      name: 'federation_memberships_union_organization_id_fkey',
    }),

    // Unique Constraints
    uniqueFederationUnion: unique('federation_memberships_federation_union_key').on(
      table.federationId,
      table.unionOrganizationId
    ),
  })
);

/**
 * Federation Executives Table
 * Federation officers and executive board members
 * 
 * Tracks elected and appointed leadership positions within federations,
 * including terms of office and responsibilities.
 */
export const federationExecutives = pgTable(
  'federation_executives',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Relationships
    federationId: uuid('federation_id').notNull(),
    profileUserId: varchar('profile_user_id', { length: 255 }).notNull(), // Reference to profiles
    unionOrganizationId: uuid('union_organization_id'), // Union they represent (nullable for staff positions)
    
    // Position Details
    position: varchar('position', { length: 100 }).notNull(), // President, Secretary-Treasurer, VP, etc.
    positionType: varchar('position_type', { length: 50 }).notNull(), // elected, appointed, ex_officio, staff
    portfolioArea: varchar('portfolio_area', { length: 100 }), // e.g., organizing, political action, education
    
    // Term of Office
    termStart: date('term_start').notNull(),
    termEnd: date('term_end'),
    currentTerm: boolean('current_term').default(true),
    termNumber: integer('term_number').default(1), // Track multiple terms
    
    // Election Details
    electedDate: date('elected_date'),
    electionType: varchar('election_type', { length: 50 }), // convention, special_election, acclaimation
    votesReceived: integer('votes_received'),
    
    // Contact
    executiveEmail: varchar('executive_email', { length: 255 }),
    executivePhone: varchar('executive_phone', { length: 50 }),
    officeLocation: varchar('office_location', { length: 255 }),
    
    // Permissions & Responsibilities
    signingAuthority: boolean('signing_authority').default(false),
    budgetAuthority: boolean('budget_authority').default(false),
    canApproveRemittances: boolean('can_approve_remittances').default(false),
    canManageCampaigns: boolean('can_manage_campaigns').default(false),
    
    // Compensation (if applicable)
    compensationType: varchar('compensation_type', { length: 50 }), // none, honorarium, salary, per_diem
    compensationAmount: numeric('compensation_amount', { precision: 10, scale: 2 }),
    
    // Status
    status: varchar('status', { length: 20 }).default('active'), // active, on_leave, resigned, removed
    isActive: boolean('is_active').default(true),
    
    // Additional Info
    biography: text('biography'),
    photo: text('photo'), // URL to photo
    notes: text('notes'),
    
    // Metadata
    metadata: jsonb('metadata').$type<{
      committees?: string[];
      externalAffiliations?: { organization: string; role: string }[];
      languages?: string[];
      expertise?: string[];
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
    idxExecutivesFederationId: index('idx_federation_executives_federation_id').on(table.federationId),
    idxExecutivesProfileUserId: index('idx_federation_executives_profile_user_id').on(table.profileUserId),
    idxExecutivesUnionOrgId: index('idx_federation_executives_union_organization_id').on(table.unionOrganizationId),
    idxExecutivesPosition: index('idx_federation_executives_position').on(table.position),
    idxExecutivesCurrentTerm: index('idx_federation_executives_current_term').on(table.currentTerm),
    idxExecutivesStatus: index('idx_federation_executives_status').on(table.status),

    // Foreign Keys
    executivesFederationIdFkey: foreignKey({
      columns: [table.federationId],
      foreignColumns: [federations.id],
      name: 'federation_executives_federation_id_fkey',
    }),
    executivesUnionOrgIdFkey: foreignKey({
      columns: [table.unionOrganizationId],
      foreignColumns: [organizations.id],
      name: 'federation_executives_union_organization_id_fkey',
    }),
  })
);

/**
 * Federation Meetings Table
 * Track federation meetings, conventions, and council gatherings
 * 
 * Records all federation meetings including conventions, executive meetings,
 * committee meetings, and workshops. Tracks attendance, decisions, and outcomes.
 */
export const federationMeetings = pgTable(
  'federation_meetings',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Relationships
    federationId: uuid('federation_id').notNull(),
    
    // Meeting Details
    title: varchar('title', { length: 255 }).notNull(),
    meetingType: federationMeetingTypeEnum('meeting_type').notNull(),
    description: text('description'),
    
    // Schedule
    startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true, mode: 'string' }),
    timezone: varchar('timezone', { length: 50 }).default('America/Toronto'),
    
    // Location
    locationType: varchar('location_type', { length: 20 }).default('in_person'), // in_person, virtual, hybrid
    venueName: varchar('venue_name', { length: 255 }),
    venueAddress: text('venue_address'),
    virtualMeetingUrl: text('virtual_meeting_url'),
    virtualMeetingPlatform: varchar('virtual_meeting_platform', { length: 50 }), // zoom, teams, meet, etc.
    
    // Attendance
    expectedAttendees: integer('expected_attendees'),
    actualAttendees: integer('actual_attendees'),
    quorumRequired: integer('quorum_required'),
    quorumMet: boolean('quorum_met'),
    
    // Status
    status: varchar('status', { length: 20 }).default('scheduled'), // scheduled, in_progress, completed, cancelled, postponed
    
    // Meeting Outcomes
    minutesUrl: text('minutes_url'), // URL to meeting minutes document
    recordingUrl: text('recording_url'), // URL to meeting recording
    resolutionsPassed: integer('resolutions_passed').default(0),
    decisionsUrl: text('decisions_url'), // URL to decisions/resolutions document
    
    // Registration
    registrationRequired: boolean('registration_required').default(false),
    registrationDeadline: timestamp('registration_deadline', { withTimezone: true, mode: 'string' }),
    registrationUrl: text('registration_url'),
    maxCapacity: integer('max_capacity'),
    
    // Materials
    agendaUrl: text('agenda_url'),
    materialsUrl: text('materials_url'),
    
    // Organizer
    organizerUserId: varchar('organizer_user_id', { length: 255 }),
    organizerName: varchar('organizer_name', { length: 255 }),
    organizerEmail: varchar('organizer_email', { length: 255 }),
    
    // Additional Info
    notes: text('notes'),
    
    // Metadata
    metadata: jsonb('metadata').$type<{
      committees?: string[];
      guestSpeakers?: { name: string; title: string; organization?: string }[];
      topics?: string[];
      costs?: { category: string; amount: number }[];
      sponsors?: string[];
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
    idxMeetingsFederationId: index('idx_federation_meetings_federation_id').on(table.federationId),
    idxMeetingsStartDate: index('idx_federation_meetings_start_date').on(table.startDate),
    idxMeetingsType: index('idx_federation_meetings_type').on(table.meetingType),
    idxMeetingsStatus: index('idx_federation_meetings_status').on(table.status),
    idxMeetingsOrganizer: index('idx_federation_meetings_organizer_user_id').on(table.organizerUserId),

    // Foreign Keys
    meetingsFederationIdFkey: foreignKey({
      columns: [table.federationId],
      foreignColumns: [federations.id],
      name: 'federation_meetings_federation_id_fkey',
    }),
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
    remittancesMembershipIdFkey: foreignKey({
      columns: [table.membershipId],
      foreignColumns: [federationMemberships.id],
      name: 'federation_remittances_membership_id_fkey',
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

/**
 * Federation Campaigns Table
 * Provincial/Regional organizing and political campaigns
 * 
 * Tracks federation-led campaigns including organizing drives, political action,
 * legislative advocacy, and solidarity campaigns across the province/region.
 */
export const federationCampaigns = pgTable(
  'federation_campaigns',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Relationships
    federationId: uuid('federation_id').notNull(),
    
    // Campaign Details
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    campaignType: federationCampaignTypeEnum('campaign_type').notNull(),
    description: text('description'),
    
    // Timeline
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    targetCompletionDate: date('target_completion_date'),
    
    // Target & Goals
    targetSector: varchar('target_sector', { length: 100 }),
    targetEmployer: varchar('target_employer', { length: 255 }),
    targetRegion: varchar('target_region', { length: 100 }),
    targetWorkers: integer('target_workers'), // Number of workers targeted
    goalDescription: text('goal_description'),
    
    // Campaign Metrics
    workersReached: integer('workers_reached').default(0),
    workersOrganized: integer('workers_organized').default(0),
    cardsSignedCount: integer('cards_signed_count').default(0),
    eventsHeld: integer('events_held').default(0),
    volunteersInvolved: integer('volunteers_involved').default(0),
    
    // Status
    status: varchar('status', { length: 20 }).default('planned'), // planned, active, on_hold, completed, cancelled
    progressPercentage: integer('progress_percentage').default(0), // 0-100
    
    // Leadership
    leadOrganizerId: varchar('lead_organizer_id', { length: 255 }), // User ID
    leadOrganizerName: varchar('lead_organizer_name', { length: 255 }),
    coordinatingUnionId: uuid('coordinating_union_id'), // Lead union for campaign
    
    // Participating Unions
    participatingUnionCount: integer('participating_union_count').default(0),
    
    // Budget & Resources
    budget: numeric('budget', { precision: 12, scale: 2 }),
    actualSpend: numeric('actual_spend', { precision: 12, scale: 2 }).default('0'),
    currency: varchar('currency', { length: 3 }).default('CAD'),
    
    // Public Visibility
    isPublic: boolean('is_public').default(false),
    publicPageUrl: text('public_page_url'),
    socialMediaHashtags: text('social_media_hashtags'),
    
    // Outcomes
    successLevel: varchar('success_level', { length: 20 }), // exceeded, achieved, partial, failed
    outcomeDescription: text('outcome_description'),
    lessonsLearned: text('lessons_learned'),
    
    // Documents & Resources
    resourcesUrl: text('resources_url'),
    reportUrl: text('report_url'),
    
    // Additional Info
    notes: text('notes'),
    
    // Metadata
    metadata: jsonb('metadata').$type<{
      participatingUnions?: { unionId: string; unionName: string; role?: string }[];
      keyMilestones?: { date: string; description: string; achieved: boolean }[];
      mediaHits?: { date: string; outlet: string; url?: string }[];
      tactics?: string[];
      outcomes?: { metric: string; target: number; actual: number }[];
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
    idxCampaignsFederationId: index('idx_federation_campaigns_federation_id').on(table.federationId),
    idxCampaignsSlug: index('idx_federation_campaigns_slug').on(table.slug),
    idxCampaignsType: index('idx_federation_campaigns_type').on(table.campaignType),
    idxCampaignsStatus: index('idx_federation_campaigns_status').on(table.status),
    idxCampaignsStartDate: index('idx_federation_campaigns_start_date').on(table.startDate),
    idxCampaignsLeadOrganizer: index('idx_federation_campaigns_lead_organizer_id').on(table.leadOrganizerId),
    idxCampaignsCoordinatingUnion: index('idx_federation_campaigns_coordinating_union_id').on(table.coordinatingUnionId),

    // Foreign Keys
    campaignsFederationIdFkey: foreignKey({
      columns: [table.federationId],
      foreignColumns: [federations.id],
      name: 'federation_campaigns_federation_id_fkey',
    }),
    campaignsCoordinatingUnionFkey: foreignKey({
      columns: [table.coordinatingUnionId],
      foreignColumns: [organizations.id],
      name: 'federation_campaigns_coordinating_union_id_fkey',
    }),

    // Unique Constraints
    uniqueCampaignSlug: unique('federation_campaigns_slug_key').on(table.federationId, table.slug),
  })
);

/**
 * Federation Communications Table
 * Regional announcements, newsletters, and communications
 * 
 * Manages all communications sent by the federation to member unions,
 * including announcements, newsletters, alerts, and bulletins.
 */
export const federationCommunications = pgTable(
  'federation_communications',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Relationships
    federationId: uuid('federation_id').notNull(),
    
    // Communication Details
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    communicationType: federationCommunicationTypeEnum('communication_type').notNull(),
    subject: varchar('subject', { length: 500 }),
    content: text('content').notNull(), // Full content (HTML or Markdown)
    summary: text('summary'), // Brief summary for listings
    
    // Author
    authorUserId: varchar('author_user_id', { length: 255 }),
    authorName: varchar('author_name', { length: 255 }),
    authorTitle: varchar('author_title', { length: 255 }),
    
    // Publishing
    status: varchar('status', { length: 20 }).default('draft'), // draft, scheduled, published, archived
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
    
    // Distribution
    sendToAllMembers: boolean('send_to_all_members').default(true),
    targetAudience: varchar('target_audience', { length: 100 }), // executives, contacts, all_members, specific
    sentCount: integer('sent_count').default(0),
    deliveredCount: integer('delivered_count').default(0),
    openedCount: integer('opened_count').default(0),
    clickCount: integer('click_count').default(0),
    
    // Priority & Visibility
    priority: varchar('priority', { length: 20 }).default('normal'), // urgent, high, normal, low
    isPinned: boolean('is_pinned').default(false),
    isPublic: boolean('is_public').default(false), // Visible on public website
    featuredImage: text('featured_image'), // URL to featured image
    
    // Related Items
    relatedCampaignId: uuid('related_campaign_id'),
    relatedMeetingId: uuid('related_meeting_id'),
    relatedEventId: uuid('related_event_id'),
    
    // Attachments
    attachments: jsonb('attachments').$type<{
      filename: string;
      url: string;
      size?: number;
      type?: string;
    }[]>(),
    
    // Call to Action
    callToAction: varchar('call_to_action', { length: 255 }),
    actionUrl: text('action_url'),
    actionButtonText: varchar('action_button_text', { length: 100 }),
    
    // Additional Info
    tags: text('tags').array(), // Searchable tags
    notes: text('notes'),
    
    // Metadata
    metadata: jsonb('metadata').$type<{
      categories?: string[];
      regions?: string[];
      sectors?: string[];
      languages?: string[];
      senderEmail?: string;
      replyToEmail?: string;
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
    idxCommunicationsFederationId: index('idx_federation_communications_federation_id').on(table.federationId),
    idxCommunicationsSlug: index('idx_federation_communications_slug').on(table.slug),
    idxCommunicationsType: index('idx_federation_communications_type').on(table.communicationType),
    idxCommunicationsStatus: index('idx_federation_communications_status').on(table.status),
    idxCommunicationsPublishedAt: index('idx_federation_communications_published_at').on(table.publishedAt),
    idxCommunicationsAuthor: index('idx_federation_communications_author_user_id').on(table.authorUserId),
    idxCommunicationsPriority: index('idx_federation_communications_priority').on(table.priority),

    // Foreign Keys
    communicationsFederationIdFkey: foreignKey({
      columns: [table.federationId],
      foreignColumns: [federations.id],
      name: 'federation_communications_federation_id_fkey',
    }),
    communicationsRelatedCampaignFkey: foreignKey({
      columns: [table.relatedCampaignId],
      foreignColumns: [federationCampaigns.id],
      name: 'federation_communications_related_campaign_id_fkey',
    }),
    communicationsRelatedMeetingFkey: foreignKey({
      columns: [table.relatedMeetingId],
      foreignColumns: [federationMeetings.id],
      name: 'federation_communications_related_meeting_id_fkey',
    }),

    // Unique Constraints
    uniqueCommunicationSlug: unique('federation_communications_slug_key').on(table.federationId, table.slug),
  })
);

/**
 * Federation Resources Table
 * Shared resources, templates, toolkits, and best practices
 * 
 * Repository of resources shared by the federation to support member unions,
 * including templates, toolkits, training materials, and best practices.
 */
export const federationResources = pgTable(
  'federation_resources',
  {
    // Primary Key
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    // Relationships
    federationId: uuid('federation_id').notNull(),
    
    // Resource Details
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    resourceType: federationResourceTypeEnum('resource_type').notNull(),
    description: text('description'),
    
    // Classification
    category: varchar('category', { length: 100 }), // organizing, bargaining, grievance, health_safety, etc.
    subCategory: varchar('sub_category', { length: 100 }),
    topics: text('topics').array(), // Searchable topics/keywords
    
    // Target Audience
    targetAudience: varchar('target_audience', { length: 100 }), // executives, stewards, members, organizers, all
    skillLevel: varchar('skill_level', { length: 20 }), // beginner, intermediate, advanced, all
    
    // Files & Content
    fileUrl: text('file_url'), // Primary file URL
    fileType: varchar('file_type', { length: 50 }), // pdf, docx, xlsx, pptx, zip, video, etc.
    fileSize: integer('file_size'), // Size in bytes
    thumbnailUrl: text('thumbnail_url'),
    previewUrl: text('preview_url'),
    
    // Additional Files
    additionalFiles: jsonb('additional_files').$type<{
      filename: string;
      url: string;
      type?: string;
      size?: number;
      description?: string;
    }[]>(),
    
    // Versions
    version: varchar('version', { length: 20 }).default('1.0'),
    previousVersionId: uuid('previous_version_id'), // Link to previous version
    isCurrentVersion: boolean('is_current_version').default(true),
    
    // Publishing
    status: varchar('status', { length: 20 }).default('draft'), // draft, review, published, archived
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'string' }),
    
    // Author & Contributor
    authorUserId: varchar('author_user_id', { length: 255 }),
    authorName: varchar('author_name', { length: 255 }),
    authorOrganization: varchar('author_organization', { length: 255 }),
    contributors: text('contributors').array(),
    
    // Access Control
    isPublic: boolean('is_public').default(false), // Available to non-members
    accessLevel: varchar('access_level', { length: 50 }).default('members_only'), // public, members_only, executives_only, restricted
    
    // Usage & Engagement
    downloadCount: integer('download_count').default(0),
    viewCount: integer('view_count').default(0),
    rating: numeric('rating', { precision: 3, scale: 2 }), // Average rating (0.00 - 5.00)
    ratingCount: integer('rating_count').default(0),
    
    // Language & Licensing
    language: varchar('language', { length: 10 }).default('en'),
    availableLanguages: text('available_languages').array(),
    license: varchar('license', { length: 100 }).default('internal_use'), // internal_use, creative_commons, public_domain, etc.
    licenseUrl: text('license_url'),
    
    // Related Resources
    relatedResourceIds: uuid('related_resource_ids').array(),
    relatedCampaignId: uuid('related_campaign_id'),
    
    // Search & Discovery
    tags: text('tags').array(),
    searchKeywords: text('search_keywords'),
    
    // Additional Info
    notes: text('notes'),
    usageInstructions: text('usage_instructions'),
    credits: text('credits'),
    
    // Metadata
    metadata: jsonb('metadata').$type<{
      regions?: string[];
      sectors?: string[];
      jurisdictions?: string[];
      externalUrl?: string;
      sourceOrganization?: string;
      lastReviewedDate?: string;
      reviewDueDate?: string;
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
    idxResourcesFederationId: index('idx_federation_resources_federation_id').on(table.federationId),
    idxResourcesSlug: index('idx_federation_resources_slug').on(table.slug),
    idxResourcesType: index('idx_federation_resources_type').on(table.resourceType),
    idxResourcesCategory: index('idx_federation_resources_category').on(table.category),
    idxResourcesStatus: index('idx_federation_resources_status').on(table.status),
    idxResourcesPublishedAt: index('idx_federation_resources_published_at').on(table.publishedAt),
    idxResourcesAuthor: index('idx_federation_resources_author_user_id').on(table.authorUserId),
    idxResourcesAccessLevel: index('idx_federation_resources_access_level').on(table.accessLevel),

    // Foreign Keys
    resourcesFederationIdFkey: foreignKey({
      columns: [table.federationId],
      foreignColumns: [federations.id],
      name: 'federation_resources_federation_id_fkey',
    }),
    resourcesPreviousVersionFkey: foreignKey({
      columns: [table.previousVersionId],
      foreignColumns: [federationResources.id],
      name: 'federation_resources_previous_version_id_fkey',
    }),
    resourcesRelatedCampaignFkey: foreignKey({
      columns: [table.relatedCampaignId],
      foreignColumns: [federationCampaigns.id],
      name: 'federation_resources_related_campaign_id_fkey',
    }),

    // Unique Constraints
    uniqueResourceSlug: unique('federation_resources_slug_key').on(table.federationId, table.slug),
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
  memberships: many(federationMemberships, {
    relationName: 'federations_memberships',
  }),
  executives: many(federationExecutives, {
    relationName: 'federations_executives',
  }),
  meetings: many(federationMeetings, {
    relationName: 'federations_meetings',
  }),
  remittances: many(federationRemittances, {
    relationName: 'federations_remittances',
  }),
  campaigns: many(federationCampaigns, {
    relationName: 'federations_campaigns',
  }),
  communications: many(federationCommunications, {
    relationName: 'federations_communications',
  }),
  resources: many(federationResources, {
    relationName: 'federations_resources',
  }),
}));

/**
 * Federation Memberships Relations
 */
export const federationMembershipsRelations = relations(federationMemberships, ({ one, many }) => ({
  federation: one(federations, {
    fields: [federationMemberships.federationId],
    references: [federations.id],
    relationName: 'federations_memberships',
  }),
  unionOrganization: one(organizations, {
    fields: [federationMemberships.unionOrganizationId],
    references: [organizations.id],
    relationName: 'memberships_unionOrganization',
  }),
  remittances: many(federationRemittances, {
    relationName: 'memberships_remittances',
  }),
}));

/**
 * Federation Executives Relations
 */
export const federationExecutivesRelations = relations(federationExecutives, ({ one }) => ({
  federation: one(federations, {
    fields: [federationExecutives.federationId],
    references: [federations.id],
    relationName: 'federations_executives',
  }),
  unionOrganization: one(organizations, {
    fields: [federationExecutives.unionOrganizationId],
    references: [organizations.id],
    relationName: 'executives_unionOrganization',
  }),
}));

/**
 * Federation Meetings Relations
 */
export const federationMeetingsRelations = relations(federationMeetings, ({ one, many }) => ({
  federation: one(federations, {
    fields: [federationMeetings.federationId],
    references: [federations.id],
    relationName: 'federations_meetings',
  }),
  relatedCommunications: many(federationCommunications, {
    relationName: 'meetings_communications',
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
  membership: one(federationMemberships, {
    fields: [federationRemittances.membershipId],
    references: [federationMemberships.id],
    relationName: 'memberships_remittances',
  }),
  perCapitaRemittance: one(perCapitaRemittances, {
    fields: [federationRemittances.perCapitaRemittanceId],
    references: [perCapitaRemittances.id],
    relationName: 'remittances_perCapita',
  }),
}));

/**
 * Federation Campaigns Relations
 */
export const federationCampaignsRelations = relations(federationCampaigns, ({ one, many }) => ({
  federation: one(federations, {
    fields: [federationCampaigns.federationId],
    references: [federations.id],
    relationName: 'federations_campaigns',
  }),
  coordinatingUnion: one(organizations, {
    fields: [federationCampaigns.coordinatingUnionId],
    references: [organizations.id],
    relationName: 'campaigns_coordinatingUnion',
  }),
  relatedCommunications: many(federationCommunications, {
    relationName: 'campaigns_communications',
  }),
  relatedResources: many(federationResources, {
    relationName: 'campaigns_resources',
  }),
}));

/**
 * Federation Communications Relations
 */
export const federationCommunicationsRelations = relations(federationCommunications, ({ one }) => ({
  federation: one(federations, {
    fields: [federationCommunications.federationId],
    references: [federations.id],
    relationName: 'federations_communications',
  }),
  relatedCampaign: one(federationCampaigns, {
    fields: [federationCommunications.relatedCampaignId],
    references: [federationCampaigns.id],
    relationName: 'campaigns_communications',
  }),
  relatedMeeting: one(federationMeetings, {
    fields: [federationCommunications.relatedMeetingId],
    references: [federationMeetings.id],
    relationName: 'meetings_communications',
  }),
}));

/**
 * Federation Resources Relations
 */
export const federationResourcesRelations = relations(federationResources, ({ one }) => ({
  federation: one(federations, {
    fields: [federationResources.federationId],
    references: [federations.id],
    relationName: 'federations_resources',
  }),
  previousVersion: one(federationResources, {
    fields: [federationResources.previousVersionId],
    references: [federationResources.id],
    relationName: 'resources_versions',
  }),
  relatedCampaign: one(federationCampaigns, {
    fields: [federationResources.relatedCampaignId],
    references: [federationCampaigns.id],
    relationName: 'campaigns_resources',
  }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Federation types
export type Federation = typeof federations.$inferSelect;
export type InsertFederation = typeof federations.$inferInsert;

// Federation Membership types
export type FederationMembership = typeof federationMemberships.$inferSelect;
export type InsertFederationMembership = typeof federationMemberships.$inferInsert;

// Federation Executive types
export type FederationExecutive = typeof federationExecutives.$inferSelect;
export type InsertFederationExecutive = typeof federationExecutives.$inferInsert;

// Federation Meeting types
export type FederationMeeting = typeof federationMeetings.$inferSelect;
export type InsertFederationMeeting = typeof federationMeetings.$inferInsert;

// Federation Remittance types
export type FederationRemittance = typeof federationRemittances.$inferSelect;
export type InsertFederationRemittance = typeof federationRemittances.$inferInsert;

// Federation Campaign types
export type FederationCampaign = typeof federationCampaigns.$inferSelect;
export type InsertFederationCampaign = typeof federationCampaigns.$inferInsert;

// Federation Communication types
export type FederationCommunication = typeof federationCommunications.$inferSelect;
export type InsertFederationCommunication = typeof federationCommunications.$inferInsert;

// Federation Resource types
export type FederationResource = typeof federationResources.$inferSelect;
export type InsertFederationResource = typeof federationResources.$inferInsert;

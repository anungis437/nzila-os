// =====================================================================================
// ORGANIZING TOOLS SCHEMA - TypeScript/Drizzle Schema
// =====================================================================================
// Version: 1.0
// Created: December 6, 2025
// Purpose: Complete organizing campaign management with card signing, NLRB/CLRB filings,
//          certification workflow, vote management, field organizer tools, employer tracking
// =====================================================================================

import { uniqueIndex,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  date,
  timestamp,
  index,
  jsonb,
  boolean,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { organizations } from '../../../schema-organizations';
import { profiles } from '../../profiles-schema';

// =====================================================================================
// TABLE: organizing_campaigns
// =====================================================================================
export const organizingCampaigns = pgTable(
  'organizing_campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

    // Campaign identification
    campaignName: varchar('campaign_name', { length: 255 }).notNull(),
    campaignCode: varchar('campaign_code', { length: 50 }).notNull(),
    targetEmployer: varchar('target_employer', { length: 255 }).notNull(),
    workplaceLocation: text('workplace_location').notNull(),

    // Campaign details
    industry: varchar('industry', { length: 100 }),
    campaignType: varchar('campaign_type', { length: 50 }).notNull().default('voluntary_recognition'),
    status: varchar('status', { length: 50 }).notNull().default('planning'),
    priority: varchar('priority', { length: 20 }).default('medium'),

    // Workplace demographics
    estimatedUnitSize: integer('estimated_unit_size').notNull(),
    targetCardCount: integer('target_card_count'),
    cardsSigned: integer('cards_signed').default(0),
    cardSigningProgress: decimal('card_signing_progress', { precision: 5, scale: 2 }),

    // Key personnel
    leadOrganizerId: text('lead_organizer_id'),
    organizingTeam: uuid('organizing_team').array(),

    // Campaign timeline
    campaignStartDate: date('campaign_start_date'),
    targetCardDeadline: date('target_card_deadline'),
    filingDate: date('filing_date'),
    electionDate: date('election_date'),
    certificationDate: date('certification_date'),
    campaignEndDate: date('campaign_end_date'),

    // Campaign strategy
    organizingStrategy: text('organizing_strategy'),
    keyIssues: text('key_issues').array(),
    employerVulnerabilities: text('employer_vulnerabilities').array(),
    unionAdvantages: text('union_advantages').array(),

    // Progress metrics
    contactsIdentified: integer('contacts_identified').default(0),
    contactsCommitted: integer('contacts_committed').default(0),
    houseVisitsCompleted: integer('house_visits_completed').default(0),
    workplaceMeetingsHeld: integer('workplace_meetings_held').default(0),

    // Campaign outcomes
    electionEligibleVoters: integer('election_eligible_voters'),
    votesForUnion: integer('votes_for_union'),
    votesAgainstUnion: integer('votes_against_union'),
    challengedBallots: integer('challenged_ballots'),
    electionResult: varchar('election_result', { length: 50 }),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    // One number per organization, not one across all organizations (platform migration 0042).
    uqOrgCampaignCode: uniqueIndex('uq_organizing_campaigns_org_campaign_code').on(table.organizationId, table.campaignCode),
    organizationIdx: index('idx_organizing_campaigns_organization').on(table.organizationId),
    statusIdx: index('idx_organizing_campaigns_status').on(table.status),
    leadIdx: index('idx_organizing_campaigns_lead').on(table.leadOrganizerId),
    employerIdx: index('idx_organizing_campaigns_employer').on(table.targetEmployer),
    progressIdx: index('idx_organizing_campaigns_progress').on(table.cardSigningProgress),
  })
);

// =====================================================================================
// RELATIONS
// =====================================================================================

export const organizingCampaignsRelations = relations(organizingCampaigns, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizingCampaigns.organizationId],
    references: [organizations.id],
  }),
  leadOrganizer: one(profiles, {
    fields: [organizingCampaigns.leadOrganizerId],
    references: [profiles.userId],
  }),
}));

// =====================================================================================
// TYPE EXPORTS
// =====================================================================================

export type OrganizingCampaign = typeof organizingCampaigns.$inferSelect;
export type NewOrganizingCampaign = typeof organizingCampaigns.$inferInsert;

export const organizingFormTemplateVersions = pgTable('organizing_form_template_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jurisdiction: varchar('jurisdiction', { length: 16 }).notNull(),
  templateKey: varchar('template_key', { length: 100 }).notNull(),
  version: integer('version').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).$type<'draft' | 'reviewed' | 'withdrawn'>().notNull().default('draft'),
  fieldSpec: jsonb('field_spec').$type<Array<{ key: string; label: string; source: string }>>().notNull(),
  sourceUri: text('source_uri').notNull(),
  sourceDigest: varchar('source_digest', { length: 64 }).notNull(),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  versionUq: uniqueIndex('organizing_form_template_versions_key_version_uniq').on(table.jurisdiction, table.templateKey, table.version),
  lookupIdx: index('organizing_form_template_versions_lookup_idx').on(table.jurisdiction, table.status, table.effectiveFrom),
  digestCheck: check('organizing_form_template_versions_digest_check', sql`${table.sourceDigest} ~ '^[a-f0-9]{64}$'`),
}));

export const organizingFormGenerationReceipts = pgTable('organizing_form_generation_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  campaignId: uuid('campaign_id').notNull().references(() => organizingCampaigns.id, { onDelete: 'restrict' }),
  templateVersionId: uuid('template_version_id').notNull().references(() => organizingFormTemplateVersions.id, { onDelete: 'restrict' }),
  generatedBy: text('generated_by').notNull(),
  inputDigest: varchar('input_digest', { length: 64 }).notNull(),
  pdfDigest: varchar('pdf_digest', { length: 64 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  validPdfHeader: boolean('valid_pdf_header').notNull(),
  byteLength: integer('byte_length').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  campaignIdx: index('organizing_form_generation_receipts_campaign_idx').on(table.organizationId, table.campaignId, table.createdAt),
}));

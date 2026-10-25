// =====================================================================================
// ORGANIZING TOOLS SCHEMA - TypeScript/Drizzle Schema
// =====================================================================================
// Version: 1.0
// Created: December 6, 2025
// Purpose: Complete organizing campaign management with card signing, NLRB/CLRB filings,
//          certification workflow, vote management, field organizer tools, employer tracking
// =====================================================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { profiles } from './profiles-schema';

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
    campaignCode: varchar('campaign_code', { length: 50 }).notNull().unique(),
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
    leadOrganizerId: text('lead_organizer_id').references(() => profiles.userId),
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
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
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


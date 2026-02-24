// =====================================================================================
// UNION STRUCTURE SCHEMA - TypeScript/Drizzle Schema
// =====================================================================================
// Version: 1.0
// Created: February 13, 2026
// Purpose: Complete union operational structure: employers, worksites, bargaining units,
//          committees, steward assignments, and role tenure tracking
// Roadmap: UnionWare Phase 1.1 - Core AMS Parity (Union Structure Model)
// =====================================================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { organizations } from '../schema-organizations';
import { profiles } from './domains/member/profiles';

// =====================================================================================
// ENUMS
// =====================================================================================

export const employerTypeEnum = pgEnum('employer_type', [
  'private',
  'public',
  'non_profit',
  'crown_corporation',
  'municipal',
  'provincial',
  'federal',
  'educational',
  'healthcare',
]);

export const employerStatusEnum = pgEnum('employer_status', [
  'active',
  'inactive',
  'contract_expired',
  'in_bargaining',
  'dispute',
  'archived',
]);

export const worksiteStatusEnum = pgEnum('worksite_status', [
  'active',
  'temporarily_closed',
  'permanently_closed',
  'seasonal',
  'archived',
]);

export const unitTypeEnum = pgEnum('unit_type', [
  'full_time',
  'part_time',
  'casual',
  'mixed',
  'craft',
  'industrial',
  'professional',
]);

export const unitStatusEnum = pgEnum('unit_status', [
  'active',
  'under_certification',
  'decertified',
  'merged',
  'inactive',
  'archived',
]);

export const committeeTypeEnum = pgEnum('committee_type', [
  'bargaining',
  'grievance',
  'health_safety',
  'political_action',
  'equity',
  'education',
  'organizing',
  'steward',
  'executive',
  'finance',
  'communications',
  'social',
  'pension_benefits',
  'other',
]);

export const committeeMemberRoleEnum = pgEnum('committee_member_role', [
  'chair',
  'vice_chair',
  'secretary',
  'treasurer',
  'member',
  'alternate',
  'advisor',
  'ex_officio',
]);

export const stewardTypeEnum = pgEnum('steward_type', [
  'chief_steward',
  'steward',
  'alternate_steward',
  'health_safety_rep',
]);

// =====================================================================================
// TABLE: employers
// =====================================================================================

export const employers = pgTable(
  'employers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Basic Information
    name: varchar('name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    dbaName: varchar('dba_name', { length: 255 }), // Doing Business As
    employerType: employerTypeEnum('employer_type').notNull(),
    status: employerStatusEnum('status').notNull().default('active'),

    // Identification
    businessNumber: varchar('business_number', { length: 50 }), // CRA BN
    federalCorporationNumber: varchar('federal_corporation_number', { length: 50 }),
    provincialCorporationNumber: varchar('provincial_corporation_number', { length: 50 }),
    industryCode: varchar('industry_code', { length: 20 }), // NAICS code

    // Contact Information
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    website: varchar('website', { length: 500 }),
    mainAddress: jsonb('main_address').$type<{
      street?: string;
      unit?: string;
      city?: string;
      province?: string;
      postal_code?: string;
      country?: string;
    }>(),

    // Operational Details
    totalEmployees: integer('total_employees'),
    unionizedEmployees: integer('unionized_employees'),
    establishedDate: date('established_date'),

    // Primary Contacts
    primaryContactName: varchar('primary_contact_name', { length: 255 }),
    primaryContactTitle: varchar('primary_contact_title', { length: 255 }),
    primaryContactEmail: varchar('primary_contact_email', { length: 255 }),
    primaryContactPhone: varchar('primary_contact_phone', { length: 50 }),

    // Labour Relations Contact
    labourRelationsContactName: varchar('labour_relations_contact_name', { length: 255 }),
    labourRelationsContactEmail: varchar('labour_relations_contact_email', { length: 255 }),
    labourRelationsContactPhone: varchar('labour_relations_contact_phone', { length: 50 }),

    // Additional Information
    parentCompanyId: uuid('parent_company_id').references(() => employers.id),
    notes: text('notes'),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    organizationIdx: index('idx_employers_organization').on(table.organizationId),
    statusIdx: index('idx_employers_status').on(table.status),
    nameIdx: index('idx_employers_name').on(table.name),
    parentCompanyIdx: index('idx_employers_parent_company').on(table.parentCompanyId),
  })
);

// =====================================================================================
// TABLE: worksites
// =====================================================================================

export const worksites = pgTable(
  'worksites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),

    // Basic Information
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }), // Site identifier/code
    status: worksiteStatusEnum('status').notNull().default('active'),

    // Location
    address: jsonb('address').$type<{
      street?: string;
      unit?: string;
      city?: string;
      province?: string;
      postal_code?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
    }>(),

    // Operational Details
    employeeCount: integer('employee_count'),
    shiftCount: integer('shift_count'),
    operatesWeekends: boolean('operates_weekends').default(false),
    operates24Hours: boolean('operates_24_hours').default(false),

    // Site Manager/Supervisor
    siteManagerName: varchar('site_manager_name', { length: 255 }),
    siteManagerEmail: varchar('site_manager_email', { length: 255 }),
    siteManagerPhone: varchar('site_manager_phone', { length: 50 }),

    // Additional Information
    description: text('description'),
    notes: text('notes'),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    organizationIdx: index('idx_worksites_organization').on(table.organizationId),
    employerIdx: index('idx_worksites_employer').on(table.employerId),
    statusIdx: index('idx_worksites_status').on(table.status),
    codeIdx: index('idx_worksites_code').on(table.code),
  })
);

// =====================================================================================
// TABLE: bargaining_units
// =====================================================================================

export const bargainingUnits = pgTable(
  'bargaining_units',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    employerId: uuid('employer_id')
      .notNull()
      .references(() => employers.id, { onDelete: 'cascade' }),
    worksiteId: uuid('worksite_id').references(() => worksites.id, { onDelete: 'set null' }),

    // Basic Information
    name: varchar('name', { length: 255 }).notNull(),
    unitNumber: varchar('unit_number', { length: 50 }),
    unitType: unitTypeEnum('unit_type').notNull(),
    status: unitStatusEnum('status').notNull().default('active'),

    // Certification Details
    certificationNumber: varchar('certification_number', { length: 100 }),
    certificationDate: date('certification_date'),
    certificationBody: varchar('certification_body', { length: 100 }), // e.g., OLRB, CLRB
    certificationExpiryDate: date('certification_expiry_date'),

    // Bargaining Details
    currentCollectiveAgreementId: uuid('current_collective_agreement_id'),
    contractExpiryDate: date('contract_expiry_date'),
    nextBargainingDate: date('next_bargaining_date'),

    // Unit Composition
    memberCount: integer('member_count').default(0),
    classifications: jsonb('classifications').$type<
      Array<{
        title: string;
        count?: number;
        payGrade?: string;
      }>
    >(),

    // Representation
    chiefStewardId: text('chief_steward_id').references(() => profiles.userId),
    bargainingChairId: text('bargaining_chair_id').references(() => profiles.userId),

    // Additional Information
    description: text('description'),
    notes: text('notes'),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    organizationIdx: index('idx_bargaining_units_organization').on(table.organizationId),
    employerIdx: index('idx_bargaining_units_employer').on(table.employerId),
    worksiteIdx: index('idx_bargaining_units_worksite').on(table.worksiteId),
    statusIdx: index('idx_bargaining_units_status').on(table.status),
    unitNumberIdx: index('idx_bargaining_units_unit_number').on(table.unitNumber),
    contractExpiryIdx: index('idx_bargaining_units_contract_expiry').on(table.contractExpiryDate),
  })
);

// =====================================================================================
// TABLE: committees
// =====================================================================================

export const committees = pgTable(
  'committees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // Basic Information
    name: varchar('name', { length: 255 }).notNull(),
    committeeType: committeeTypeEnum('committee_type').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('active'),

    // Scope
    unitId: uuid('unit_id').references(() => bargainingUnits.id, { onDelete: 'set null' }),
    worksiteId: uuid('worksite_id').references(() => worksites.id, { onDelete: 'set null' }),
    isOrganizationWide: boolean('is_organization_wide').default(false),

    // Committee Details
    mandate: text('mandate'),
    meetingFrequency: varchar('meeting_frequency', { length: 100 }), // e.g., "Monthly", "Quarterly"
    meetingDay: varchar('meeting_day', { length: 50 }), // e.g., "First Monday"
    meetingTime: varchar('meeting_time', { length: 50 }),
    meetingLocation: text('meeting_location'),

    // Composition
    maxMembers: integer('max_members'),
    currentMemberCount: integer('current_member_count').default(0),
    requiresAppointment: boolean('requires_appointment').default(false),
    requiresElection: boolean('requires_election').default(false),
    termLength: integer('term_length'), // In months

    // Contact
    chairId: text('chair_id').references(() => profiles.userId),
    secretaryId: text('secretary_id').references(() => profiles.userId),
    contactEmail: varchar('contact_email', { length: 255 }),

    // Additional Information
    description: text('description'),
    notes: text('notes'),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    organizationIdx: index('idx_committees_organization').on(table.organizationId),
    typeIdx: index('idx_committees_type').on(table.committeeType),
    statusIdx: index('idx_committees_status').on(table.status),
    unitIdx: index('idx_committees_unit').on(table.unitId),
    worksiteIdx: index('idx_committees_worksite').on(table.worksiteId),
    chairIdx: index('idx_committees_chair').on(table.chairId),
  })
);

// =====================================================================================
// TABLE: committee_memberships
// =====================================================================================

export const committeeMemberships = pgTable(
  'committee_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    committeeId: uuid('committee_id')
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),

    // Role
    role: committeeMemberRoleEnum('role').notNull().default('member'),
    status: varchar('status', { length: 50 }).notNull().default('active'),

    // Tenure
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    termNumber: integer('term_number').default(1), // If serving multiple terms

    // Appointment/Election Details
    appointmentMethod: varchar('appointment_method', { length: 50 }), // 'elected', 'appointed', 'ex_officio'
    appointedBy: text('appointed_by').references(() => profiles.userId),
    electionDate: date('election_date'),
    votesReceived: integer('votes_received'),

    // Attendance Tracking
    meetingsAttended: integer('meetings_attended').default(0),
    meetingsTotal: integer('meetings_total').default(0),

    // Additional Information
    notes: text('notes'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
  },
  (table) => ({
    committeeIdx: index('idx_committee_memberships_committee').on(table.committeeId),
    memberIdx: index('idx_committee_memberships_member').on(table.memberId),
    statusIdx: index('idx_committee_memberships_status').on(table.status),
    roleIdx: index('idx_committee_memberships_role').on(table.role),
    tenureIdx: index('idx_committee_memberships_tenure').on(table.startDate, table.endDate),
    uniqueMembership: uniqueIndex('idx_committee_memberships_unique').on(
      table.committeeId,
      table.memberId,
      table.startDate
    ),
  })
);

// =====================================================================================
// TABLE: steward_assignments
// =====================================================================================

export const stewardAssignments = pgTable(
  'steward_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    stewardId: text('steward_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),

    // Assignment Scope
    stewardType: stewardTypeEnum('steward_type').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('active'),

    // Coverage Area (steward can cover multiple or specific areas)
    unitId: uuid('unit_id').references(() => bargainingUnits.id, { onDelete: 'set null' }),
    worksiteId: uuid('worksite_id').references(() => worksites.id, { onDelete: 'set null' }),
    department: varchar('department', { length: 255 }),
    shift: varchar('shift', { length: 100 }),
    floor: varchar('floor', { length: 100 }),
    area: varchar('area', { length: 255 }),

    // Tenure
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isInterim: boolean('is_interim').default(false),

    // Appointment Details
    appointedBy: text('appointed_by').references(() => profiles.userId),
    electedDate: date('elected_date'),
    certificationDate: date('certification_date'),

    // Responsibilities
    responsibilityAreas: jsonb('responsibility_areas').$type<string[]>(),
    membersCovered: integer('members_covered'),

    // Training & Certification
    trainingCompleted: boolean('training_completed').default(false),
    trainingCompletionDate: date('training_completion_date'),
    certificationExpiry: date('certification_expiry'),

    // Contact Availability
    workPhone: varchar('work_phone', { length: 50 }),
    personalPhone: varchar('personal_phone', { length: 50 }),
    preferredContactMethod: varchar('preferred_contact_method', { length: 50 }),
    availabilityNotes: text('availability_notes'),

    // Additional Information
    notes: text('notes'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
  },
  (table) => ({
    organizationIdx: index('idx_steward_assignments_organization').on(table.organizationId),
    stewardIdx: index('idx_steward_assignments_steward').on(table.stewardId),
    unitIdx: index('idx_steward_assignments_unit').on(table.unitId),
    worksiteIdx: index('idx_steward_assignments_worksite').on(table.worksiteId),
    statusIdx: index('idx_steward_assignments_status').on(table.status),
    typeIdx: index('idx_steward_assignments_type').on(table.stewardType),
    tenureIdx: index('idx_steward_assignments_tenure').on(table.startDate, table.endDate),
  })
);

// =====================================================================================
// TABLE: role_tenure_history
// =====================================================================================

export const roleTenureHistory = pgTable(
  'role_tenure_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),

    // Role Information
    roleType: varchar('role_type', { length: 100 }).notNull(), // 'officer', 'steward', 'committee_member', 'trustee', etc.
    roleTitle: varchar('role_title', { length: 255 }).notNull(),
    roleLevel: varchar('role_level', { length: 50 }), // 'local', 'regional', 'national'

    // Related Entity
    relatedEntityType: varchar('related_entity_type', { length: 50 }), // 'committee', 'unit', 'organization'
    relatedEntityId: uuid('related_entity_id'),

    // Tenure
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isCurrentRole: boolean('is_current_role').default(true),

    // Appointment/Election Details
    appointmentMethod: varchar('appointment_method', { length: 50 }), // 'elected', 'appointed', 'acclaimed'
    electionDate: date('election_date'),
    votesReceived: integer('votes_received'),
    voteTotal: integer('vote_total'),
    termLength: integer('term_length'), // In months
    termNumber: integer('term_number').default(1),

    // End of Role
    endReason: varchar('end_reason', { length: 100 }), // 'term_expired', 'resigned', 'removed', 'transferred', etc.
    endedBy: text('ended_by').references(() => profiles.userId),

    // Performance/Notes
    notes: text('notes'),
    achievements: jsonb('achievements').$type<string[]>(),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    createdBy: text('created_by').references(() => profiles.userId),
    updatedBy: text('updated_by').references(() => profiles.userId),
  },
  (table) => ({
    organizationIdx: index('idx_role_tenure_organization').on(table.organizationId),
    memberIdx: index('idx_role_tenure_member').on(table.memberId),
    roleTypeIdx: index('idx_role_tenure_role_type').on(table.roleType),
    currentIdx: index('idx_role_tenure_current').on(table.isCurrentRole),
    tenureIdx: index('idx_role_tenure_dates').on(table.startDate, table.endDate),
    entityIdx: index('idx_role_tenure_entity').on(table.relatedEntityType, table.relatedEntityId),
  })
);

// =====================================================================================
// RELATIONS
// =====================================================================================

export const employersRelations = relations(employers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [employers.organizationId],
    references: [organizations.id],
  }),
  parentCompany: one(employers, {
    fields: [employers.parentCompanyId],
    references: [employers.id],
    relationName: 'parentCompany',
  }),
  subsidiaries: many(employers, {
    relationName: 'parentCompany',
  }),
  worksites: many(worksites),
  bargainingUnits: many(bargainingUnits),
}));

export const worksitesRelations = relations(worksites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [worksites.organizationId],
    references: [organizations.id],
  }),
  employer: one(employers, {
    fields: [worksites.employerId],
    references: [employers.id],
  }),
  bargainingUnits: many(bargainingUnits),
  committees: many(committees),
  stewardAssignments: many(stewardAssignments),
}));

export const bargainingUnitsRelations = relations(bargainingUnits, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bargainingUnits.organizationId],
    references: [organizations.id],
  }),
  employer: one(employers, {
    fields: [bargainingUnits.employerId],
    references: [employers.id],
  }),
  worksite: one(worksites, {
    fields: [bargainingUnits.worksiteId],
    references: [worksites.id],
  }),
  chiefSteward: one(profiles, {
    fields: [bargainingUnits.chiefStewardId],
    references: [profiles.userId],
    relationName: 'chiefSteward',
  }),
  bargainingChair: one(profiles, {
    fields: [bargainingUnits.bargainingChairId],
    references: [profiles.userId],
    relationName: 'bargainingChair',
  }),
  committees: many(committees),
  stewardAssignments: many(stewardAssignments),
}));

export const committeesRelations = relations(committees, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [committees.organizationId],
    references: [organizations.id],
  }),
  unit: one(bargainingUnits, {
    fields: [committees.unitId],
    references: [bargainingUnits.id],
  }),
  worksite: one(worksites, {
    fields: [committees.worksiteId],
    references: [worksites.id],
  }),
  chair: one(profiles, {
    fields: [committees.chairId],
    references: [profiles.userId],
    relationName: 'committeeChair',
  }),
  secretary: one(profiles, {
    fields: [committees.secretaryId],
    references: [profiles.userId],
    relationName: 'committeeSecretary',
  }),
  memberships: many(committeeMemberships),
}));

export const committeeMembershipsRelations = relations(committeeMemberships, ({ one }) => ({
  committee: one(committees, {
    fields: [committeeMemberships.committeeId],
    references: [committees.id],
  }),
  member: one(profiles, {
    fields: [committeeMemberships.memberId],
    references: [profiles.userId],
  }),
  appointedByProfile: one(profiles, {
    fields: [committeeMemberships.appointedBy],
    references: [profiles.userId],
    relationName: 'committeeAppointedBy',
  }),
}));

export const stewardAssignmentsRelations = relations(stewardAssignments, ({ one }) => ({
  organization: one(organizations, {
    fields: [stewardAssignments.organizationId],
    references: [organizations.id],
  }),
  steward: one(profiles, {
    fields: [stewardAssignments.stewardId],
    references: [profiles.userId],
  }),
  unit: one(bargainingUnits, {
    fields: [stewardAssignments.unitId],
    references: [bargainingUnits.id],
  }),
  worksite: one(worksites, {
    fields: [stewardAssignments.worksiteId],
    references: [worksites.id],
  }),
  appointedByProfile: one(profiles, {
    fields: [stewardAssignments.appointedBy],
    references: [profiles.userId],
    relationName: 'stewardAppointedBy',
  }),
}));

export const roleTenureHistoryRelations = relations(roleTenureHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [roleTenureHistory.organizationId],
    references: [organizations.id],
  }),
  member: one(profiles, {
    fields: [roleTenureHistory.memberId],
    references: [profiles.userId],
  }),
  endedByProfile: one(profiles, {
    fields: [roleTenureHistory.endedBy],
    references: [profiles.userId],
    relationName: 'roleEndedBy',
  }),
}));

// =====================================================================================
// TYPE EXPORTS
// =====================================================================================

export type Employer = typeof employers.$inferSelect;
export type NewEmployer = typeof employers.$inferInsert;

export type Worksite = typeof worksites.$inferSelect;
export type NewWorksite = typeof worksites.$inferInsert;

export type BargainingUnit = typeof bargainingUnits.$inferSelect;
export type NewBargainingUnit = typeof bargainingUnits.$inferInsert;

export type Committee = typeof committees.$inferSelect;
export type NewCommittee = typeof committees.$inferInsert;

export type CommitteeMembership = typeof committeeMemberships.$inferSelect;
export type NewCommitteeMembership = typeof committeeMemberships.$inferInsert;

export type StewardAssignment = typeof stewardAssignments.$inferSelect;
export type NewStewardAssignment = typeof stewardAssignments.$inferInsert;

export type RoleTenureHistory = typeof roleTenureHistory.$inferSelect;
export type NewRoleTenureHistory = typeof roleTenureHistory.$inferInsert;

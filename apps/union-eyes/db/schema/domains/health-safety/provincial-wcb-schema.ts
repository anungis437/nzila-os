/**
 * Provincial WCB Claims Schema
 *
 * Generic workers' compensation claims table that works for all
 * Canadian jurisdictions. References the WCB board registry in
 * lib/canadian-labour-standards/wcb-boards.ts for board-specific
 * metadata and filing deadlines.
 *
 * @module health-safety/provincial-wcb-schema
 */

import {
  pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb,
  index, pgEnum, numeric, date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ─────────────────────────────────────────────────

export const wcbJurisdictionEnum = pgEnum('wcb_jurisdiction', [
  'federal', 'ON', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'QC', 'YT', 'NT', 'NU',
]);

export const wcbClaimStatusEnum = pgEnum('wcb_claim_status', [
  'draft',
  'submitted',
  'accepted',
  'denied',
  'under_review',
  'appealed',
  'closed',
]);

export const wcbClaimTypeEnum = pgEnum('wcb_claim_type', [
  'workplace_injury',
  'occupational_disease',
  'mental_health',
  'repetitive_strain',
  'fatality',
]);

export const wcbReturnToWorkStatusEnum = pgEnum('wcb_return_to_work_status', [
  'not_applicable',
  'modified_duties',
  'gradual_return',
  'full_return',
  'permanent_disability',
]);

// ─── Tables ────────────────────────────────────────────────

export const wcbClaims = pgTable('wcb_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  workerId: uuid('worker_id').notNull(),
  jurisdiction: wcbJurisdictionEnum('jurisdiction').notNull(),

  // Claim identifiers
  claimType: wcbClaimTypeEnum('claim_type').notNull(),
  status: wcbClaimStatusEnum('status').notNull().default('draft'),
  boardClaimNumber: varchar('board_claim_number', { length: 100 }),
  employerReportNumber: varchar('employer_report_number', { length: 100 }),

  // Incident details
  incidentDate: date('incident_date').notNull(),
  reportedDate: date('reported_date'),
  filedDate: date('filed_date'),
  description: text('description').notNull(),
  bodyPartAffected: varchar('body_part_affected', { length: 255 }),
  injuryNature: varchar('injury_nature', { length: 255 }),
  workLocation: varchar('work_location', { length: 500 }),
  witnessNames: jsonb('witness_names').$type<string[]>(),

  // Medical
  hospitalName: varchar('hospital_name', { length: 500 }),
  treatingPhysician: varchar('treating_physician', { length: 255 }),
  initialPrognosis: text('initial_prognosis'),
  estimatedRecoveryDays: integer('estimated_recovery_days'),
  daysLost: integer('days_lost').default(0),

  // Return to work
  returnToWorkStatus: wcbReturnToWorkStatusEnum('return_to_work_status').default('not_applicable'),
  returnToWorkDate: date('return_to_work_date'),
  modifiedDutiesDescription: text('modified_duties_description'),

  // Financial
  wageReplacementRate: numeric('wage_replacement_rate', { precision: 5, scale: 4 }),
  totalBenefitsPaid: numeric('total_benefits_paid', { precision: 12, scale: 2 }),

  // Union representation
  unionRepId: uuid('union_rep_id'),
  unionInvolved: boolean('union_involved').default(false),
  grievanceFiled: boolean('grievance_filed').default(false),
  grievanceId: uuid('grievance_id'),

  // Appeal tracking
  appealDeadline: date('appeal_deadline'),
  appealFiledDate: date('appeal_filed_date'),
  appealOutcome: varchar('appeal_outcome', { length: 100 }),

  // Documents and metadata
  documentIds: jsonb('document_ids').$type<string[]>(),
  metadata: jsonb('metadata'),
  notes: text('notes'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
}, (table) => ({
  orgIdx: index('idx_wcb_claims_org').on(table.organizationId),
  workerIdx: index('idx_wcb_claims_worker').on(table.workerId),
  jurisdictionIdx: index('idx_wcb_claims_jurisdiction').on(table.jurisdiction),
  statusIdx: index('idx_wcb_claims_status').on(table.status),
  incidentDateIdx: index('idx_wcb_claims_incident_date').on(table.incidentDate),
  orgJurisdictionIdx: index('idx_wcb_claims_org_jurisdiction').on(table.organizationId, table.jurisdiction),
}));

export const wcbEmployerAssessments = pgTable('wcb_employer_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  jurisdiction: wcbJurisdictionEnum('jurisdiction').notNull(),

  // Assessment details
  assessmentYear: integer('assessment_year').notNull(),
  rateGroup: varchar('rate_group', { length: 100 }),
  premiumRate: numeric('premium_rate', { precision: 8, scale: 6 }),
  assessablePayroll: numeric('assessable_payroll', { precision: 14, scale: 2 }),
  premiumDue: numeric('premium_due', { precision: 12, scale: 2 }),
  experienceRating: numeric('experience_rating', { precision: 8, scale: 4 }),

  // NEER / MAP / experience rating programs
  ratingProgramName: varchar('rating_program_name', { length: 255 }),
  surchargeOrRefund: numeric('surcharge_or_refund', { precision: 12, scale: 2 }),

  dueDate: date('due_date'),
  paidDate: date('paid_date'),
  status: varchar('status', { length: 50 }).default('pending'),

  documentIds: jsonb('document_ids').$type<string[]>(),
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by'),
}, (table) => ({
  orgIdx: index('idx_wcb_assessments_org').on(table.organizationId),
  jurisdictionIdx: index('idx_wcb_assessments_jurisdiction').on(table.jurisdiction),
  yearIdx: index('idx_wcb_assessments_year').on(table.assessmentYear),
  orgJurisdictionYearIdx: index('idx_wcb_assessments_org_juris_year').on(
    table.organizationId, table.jurisdiction, table.assessmentYear,
  ),
}));

// ─── Relations ─────────────────────────────────────────────

export const wcbClaimsRelations = relations(wcbClaims, ({ one }) => ({
  assessment: one(wcbEmployerAssessments, {
    fields: [wcbClaims.organizationId, wcbClaims.jurisdiction],
    references: [wcbEmployerAssessments.organizationId, wcbEmployerAssessments.jurisdiction],
  }),
}));

export const wcbEmployerAssessmentsRelations = relations(wcbEmployerAssessments, ({ many }) => ({
  claims: many(wcbClaims),
}));

// ─── Types ─────────────────────────────────────────────────

export type InsertWcbClaim = typeof wcbClaims.$inferInsert;
export type SelectWcbClaim = typeof wcbClaims.$inferSelect;
export type InsertWcbEmployerAssessment = typeof wcbEmployerAssessments.$inferInsert;
export type SelectWcbEmployerAssessment = typeof wcbEmployerAssessments.$inferSelect;

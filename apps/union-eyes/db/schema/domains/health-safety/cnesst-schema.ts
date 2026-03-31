/**
 * CNESST Schema — Quebec-Specific Health & Safety Regulatory
 *
 * Commission des normes, de l'équité, de la santé et de la sécurité du travail
 *
 * Extends the health-safety domain with Quebec-specific tables:
 * - CNESST filings (réclamation / plainte)
 * - LATMP workplace accident & occupational disease claims
 * - LSST right-of-refusal tracking (art. 12–31)
 * - Preventive withdrawal tracking (retrait préventif, art. 40–48)
 * - Joint health & safety committee registry (art. 68–86)
 * - Pay equity compliance (Loi sur l'équité salariale)
 * - Anti-scab violation tracking (Code du travail art. 109.1)
 *
 * @module cnesst-schema
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// ENUMS
// =============================================================================

export const cneesstFilingTypeEnum = pgEnum("cnesst_filing_type", [
  "workplace_accident",       // Accident du travail (LATMP)
  "occupational_disease",     // Maladie professionnelle (LATMP)
  "preventive_withdrawal",    // Retrait préventif (LSST art. 40-48)
  "right_of_refusal",         // Droit de refus (LSST art. 12-31)
  "harassment_complaint",     // Plainte harcèlement psychologique (LNT 81.18)
  "standards_complaint",      // Plainte normes du travail (LNT)
  "pay_equity",               // Plainte équité salariale
  "dangerous_conditions",     // Conditions dangereuses (LSST)
]);

export const cneesstFilingStatusEnum = pgEnum("cnesst_filing_status", [
  "draft",
  "submitted",                // Déposée
  "acknowledged",             // Accusé de réception
  "under_investigation",      // En enquête
  "mediation",                // Médiation
  "awaiting_decision",        // En attente de décision
  "accepted",                 // Acceptée
  "denied",                   // Refusée
  "appealed_tat",             // Portée en appel au TAT
  "settled",                  // Réglée
  "closed",                   // Fermée
]);

export const preventiveWithdrawalReasonEnum = pgEnum("preventive_withdrawal_reason", [
  "pregnancy",                // Retrait préventif de la travailleuse enceinte (art. 40)
  "breastfeeding",            // Retrait préventif pendant l'allaitement (art. 46)
  "hazardous_exposure",       // Exposition à un contaminant (art. 32)
]);

export const rightOfRefusalOutcomeEnum = pgEnum("right_of_refusal_outcome", [
  "danger_confirmed",         // Danger confirmé — travail arrêté
  "danger_not_confirmed",     // Danger non confirmé — retour au travail
  "partial_correction",       // Correction partielle
  "referred_to_cnesst",       // Référé à la CNESST pour enquête
  "pending",                  // En cours d'évaluation
]);

export const payEquityStatusEnum = pgEnum("pay_equity_status", [
  "not_started",
  "committee_formed",         // Comité d'équité salariale formé
  "evaluation_in_progress",   // Évaluation des catégories en cours
  "adjustments_calculated",   // Ajustements calculés
  "results_posted",           // Résultats affichés (60-day contest period)
  "adjustments_paid",         // Ajustements versés
  "maintenance_due",          // Maintien dû (every 5 years)
  "maintenance_completed",    // Maintien complété
  "contested",                // Contesté
]);

export const antiScabViolationTypeEnum = pgEnum("anti_scab_violation_type", [
  "replacement_workers",      // Travailleurs de remplacement (art. 109.1 a))
  "other_establishment",      // Salariés d'un autre établissement (art. 109.1 b))
  "subcontractors",           // Sous-traitants (art. 109.1 c))
  "post_notice_hires",        // Salariés embauchés après l'avis (art. 109.1 d))
]);

// =============================================================================
// TABLES
// =============================================================================

/**
 * CNESST Filings
 *
 * Tracks complaints and claims filed with the CNESST across all mandates:
 * workplace accidents (LATMP), labour standards (LNT), H&S (LSST),
 * and pay equity (Loi sur l'équité salariale).
 */
export const cneesstFilings = pgTable("cnesst_filings", {
  id: uuid("id").primaryKey().defaultRandom(),

  organizationId: uuid("organization_id").notNull(),
  memberId: uuid("member_id"),
  incidentId: uuid("incident_id"), // link to workplaceIncidents

  // Classification
  filingType: cneesstFilingTypeEnum("filing_type").notNull(),
  status: cneesstFilingStatusEnum("status").notNull().default("draft"),

  // Reference numbers
  cneesstFileNumber: varchar("cnesst_file_number", { length: 100 }),
  tatAppealNumber: varchar("tat_appeal_number", { length: 100 }),
  internalCaseNumber: varchar("internal_case_number", { length: 100 }),

  // Legal basis
  legalBasis: varchar("legal_basis", { length: 255 }).notNull(), // e.g. "LATMP art. 271"
  filingDeadline: date("filing_deadline"),
  filedDate: date("filed_date"),
  acknowledgedDate: date("acknowledged_date"),
  decisionDate: date("decision_date"),

  // Details
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  descriptionFr: text("description_fr"),
  relief: text("relief_sought"),
  reliefFr: text("relief_sought_fr"),

  // Outcome
  outcome: text("outcome"),
  outcomeFr: text("outcome_fr"),
  compensationAwarded: numeric("compensation_awarded", { precision: 12, scale: 2 }),

  // Representative
  unionRepId: uuid("union_rep_id"),
  unionRepName: varchar("union_rep_name", { length: 255 }),

  // Documents
  documentIds: jsonb("document_ids").$type<string[]>(),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid("created_by"),
}, (table) => ({
  idxFilingsOrg: index("idx_cnesst_filings_org").on(table.organizationId),
  idxFilingsType: index("idx_cnesst_filings_type").on(table.filingType),
  idxFilingsStatus: index("idx_cnesst_filings_status").on(table.status),
  idxFilingsMember: index("idx_cnesst_filings_member").on(table.memberId),
  idxFilingsIncident: index("idx_cnesst_filings_incident").on(table.incidentId),
  idxFilingsOrgDate: index("idx_cnesst_filings_org_date").on(table.organizationId, table.filedDate),
}));

/**
 * Right-of-Refusal Events
 *
 * LSST art. 12–31: A worker who has reasonable grounds to believe that
 * the execution of work involves a danger to their health, safety,
 * or physical well-being may refuse to execute that work.
 */
export const rightOfRefusalEvents = pgTable("right_of_refusal_events", {
  id: uuid("id").primaryKey().defaultRandom(),

  organizationId: uuid("organization_id").notNull(),
  cneesstFilingId: uuid("cnesst_filing_id"), // link to cneesstFilings
  incidentId: uuid("incident_id"), // link to workplaceIncidents

  // Who refused
  memberId: uuid("member_id").notNull(),
  memberName: varchar("member_name", { length: 255 }).notNull(),
  jobTitle: varchar("job_title", { length: 255 }),

  // When & where
  refusalDate: timestamp("refusal_date", { withTimezone: true }).notNull(),
  workplaceId: uuid("workplace_id"),
  workplaceName: varchar("workplace_name", { length: 255 }),
  locationDescription: text("location_description"),

  // What was refused
  taskRefused: text("task_refused").notNull(),
  dangerDescription: text("danger_description").notNull(),

  // Process steps (LSST art. 14-31)
  supervisorNotifiedAt: timestamp("supervisor_notified_at", { withTimezone: true }),
  supervisorName: varchar("supervisor_name", { length: 255 }),
  hsRepNotifiedAt: timestamp("hs_rep_notified_at", { withTimezone: true }),
  hsRepName: varchar("hs_rep_name", { length: 255 }),
  cneesstInspectorCalledAt: timestamp("cnesst_inspector_called_at", { withTimezone: true }),
  cneesstInspectorName: varchar("cnesst_inspector_name", { length: 255 }),
  inspectorDecisionDate: date("inspector_decision_date"),

  // Outcome
  outcome: rightOfRefusalOutcomeEnum("outcome"),
  outcomeNotes: text("outcome_notes"),
  correctiveActionsRequired: boolean("corrective_actions_required").default(false),
  correctiveActionsSummary: text("corrective_actions_summary"),

  // Protection — art. 30: employer cannot dismiss a worker for exercising right
  reprisalComplaint: boolean("reprisal_complaint").default(false),
  reprisalDetails: text("reprisal_details"),

  documentIds: jsonb("document_ids").$type<string[]>(),
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxRefusalOrg: index("idx_refusal_org").on(table.organizationId),
  idxRefusalMember: index("idx_refusal_member").on(table.memberId),
  idxRefusalDate: index("idx_refusal_date").on(table.refusalDate),
}));

/**
 * Preventive Withdrawal Tracking
 *
 * LSST art. 40–48: Pregnant or breastfeeding workers exposed to physical dangers
 * or contaminants can request reassignment or withdrawal with income replacement.
 */
export const preventiveWithdrawals = pgTable("preventive_withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),

  organizationId: uuid("organization_id").notNull(),
  cneesstFilingId: uuid("cnesst_filing_id"),
  memberId: uuid("member_id").notNull(),
  memberName: varchar("member_name", { length: 255 }).notNull(),

  reason: preventiveWithdrawalReasonEnum("reason").notNull(),
  requestDate: date("request_date").notNull(),
  medicalCertificateDate: date("medical_certificate_date"),
  physicianName: varchar("physician_name", { length: 255 }),

  // Employer response
  reassignmentOffered: boolean("reassignment_offered").default(false),
  reassignmentAccepted: boolean("reassignment_accepted"),
  reassignmentDescription: text("reassignment_description"),
  withdrawalStartDate: date("withdrawal_start_date"),
  withdrawalEndDate: date("withdrawal_end_date"),

  // Income replacement (90% of net salary for first 5 days by employer,
  // then CNESST pays IRR)
  employerPaidDays: integer("employer_paid_days"),
  cneesstIrrStartDate: date("cnesst_irr_start_date"),
  cneesstIrrWeeklyAmount: numeric("cnesst_irr_weekly_amount", { precision: 10, scale: 2 }),

  status: cneesstFilingStatusEnum("status").notNull().default("submitted"),
  notes: text("notes"),
  documentIds: jsonb("document_ids").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxWithdrawalOrg: index("idx_withdrawal_org").on(table.organizationId),
  idxWithdrawalMember: index("idx_withdrawal_member").on(table.memberId),
}));

/**
 * Joint Health & Safety Committee Registry
 *
 * LSST art. 68–86: Workplaces with 20+ workers must establish a
 * joint health & safety committee (comité de santé et de sécurité).
 */
export const jointHsCommittees = pgTable("joint_hs_committees", {
  id: uuid("id").primaryKey().defaultRandom(),

  organizationId: uuid("organization_id").notNull(),
  workplaceId: uuid("workplace_id"),
  workplaceName: varchar("workplace_name", { length: 255 }).notNull(),

  // Committee details
  committeeName: varchar("committee_name", { length: 255 }).notNull(),
  establishedDate: date("established_date").notNull(),
  mandateExpiryDate: date("mandate_expiry_date"),

  // Composition (must be equal employer/worker representation)
  workerRepresentatives: jsonb("worker_representatives").$type<{
    memberId: string;
    name: string;
    role: string;
    appointedDate: string;
  }[]>(),
  employerRepresentatives: jsonb("employer_representatives").$type<{
    name: string;
    role: string;
    appointedDate: string;
  }[]>(),

  // Co-chairs (one worker, one employer)
  workerCoChairId: uuid("worker_co_chair_id"),
  workerCoChairName: varchar("worker_co_chair_name", { length: 255 }),
  employerCoChairName: varchar("employer_co_chair_name", { length: 255 }),

  // Meeting schedule
  meetingFrequency: varchar("meeting_frequency", { length: 50 }), // "monthly", "bi-monthly"
  lastMeetingDate: date("last_meeting_date"),
  nextMeetingDate: date("next_meeting_date"),
  totalMeetingsHeld: integer("total_meetings_held").default(0),

  // Required programs (LSST art. 58–59)
  preventionProgramApproved: boolean("prevention_program_approved").default(false),
  preventionProgramDate: date("prevention_program_date"),
  healthProgramApproved: boolean("health_program_approved").default(false),
  healthProgramDate: date("health_program_date"),

  // Compliance with worker count threshold (20+ = mandatory committee)
  workplaceWorkerCount: integer("workplace_worker_count"),
  isMandatory: boolean("is_mandatory"), // true if 20+

  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  documentIds: jsonb("document_ids").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxCommitteeOrg: index("idx_hs_committee_org").on(table.organizationId),
  idxCommitteeWorkplace: index("idx_hs_committee_workplace").on(table.workplaceId),
  idxCommitteeActive: index("idx_hs_committee_active").on(table.isActive),
}));

/**
 * Pay Equity Compliance
 *
 * Loi sur l'équité salariale: Employers with 10+ employees must establish
 * pay equity between male- and female-dominated job classes.
 * Maintenance audit required every 5 years.
 */
export const payEquityExercises = pgTable("pay_equity_exercises", {
  id: uuid("id").primaryKey().defaultRandom(),

  organizationId: uuid("organization_id").notNull(),

  // Exercise details
  exerciseType: varchar("exercise_type", { length: 50 }).notNull(), // 'initial' | 'maintenance'
  status: payEquityStatusEnum("status").notNull().default("not_started"),

  // Committee (10+ employees)
  committeeFormed: boolean("committee_formed").default(false),
  committeeFormationDate: date("committee_formation_date"),
  workerMembers: jsonb("worker_members").$type<{ name: string; representedGroup: string }[]>(),
  employerMembers: jsonb("employer_members").$type<{ name: string }[]>(),

  // Evaluation
  maleJobClasses: integer("male_job_classes"),
  femaleJobClasses: integer("female_job_classes"),
  mixedJobClasses: integer("mixed_job_classes"),
  evaluationMethod: varchar("evaluation_method", { length: 100 }), // point-factor, paired comparison

  // Results
  resultsPostedDate: date("results_posted_date"),
  contestDeadline: date("contest_deadline"), // 60 days from posting
  totalAdjustmentAmount: numeric("total_adjustment_amount", { precision: 14, scale: 2 }),
  adjustmentsPaidDate: date("adjustments_paid_date"),

  // Maintenance cycle
  maintenanceEvaluationDate: date("maintenance_evaluation_date"),
  nextMaintenanceDue: date("next_maintenance_due"), // every 5 years

  // CNESST declaration
  cneesstDeclarationFiled: boolean("cnesst_declaration_filed").default(false),
  cneesstDeclarationDate: date("cnesst_declaration_date"),

  notes: text("notes"),
  documentIds: jsonb("document_ids").$type<string[]>(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxEquityOrg: index("idx_pay_equity_org").on(table.organizationId),
  idxEquityStatus: index("idx_pay_equity_status").on(table.status),
}));

/**
 * Anti-Scab Violation Tracking
 *
 * Code du travail art. 109.1: During a strike or lockout, the employer
 * cannot use replacement workers. Violations are penal offences ($1k–$10k/day).
 */
export const antiScabViolations = pgTable("anti_scab_violations", {
  id: uuid("id").primaryKey().defaultRandom(),

  organizationId: uuid("organization_id").notNull(),

  // Strike/lockout context
  strikeOrLockoutStartDate: date("strike_or_lockout_start_date").notNull(),
  isStrike: boolean("is_strike").notNull(), // true=strike, false=lockout
  bargainingUnitDescription: text("bargaining_unit_description"),

  // Violation details
  violationType: antiScabViolationTypeEnum("violation_type").notNull(),
  violationDate: date("violation_date").notNull(),
  description: text("description").notNull(),
  descriptionFr: text("description_fr"),
  evidenceSummary: text("evidence_summary"),

  // Number of replacement workers observed
  replacementWorkerCount: integer("replacement_worker_count"),

  // Filing with TAT
  tatComplaintFiled: boolean("tat_complaint_filed").default(false),
  tatComplaintDate: date("tat_complaint_date"),
  tatFileNumber: varchar("tat_file_number", { length: 100 }),

  // Injunction
  injunctionRequested: boolean("injunction_requested").default(false),
  injunctionGranted: boolean("injunction_granted"),
  injunctionDate: date("injunction_date"),

  // Outcome
  penaltyAmount: numeric("penalty_amount", { precision: 12, scale: 2 }),
  daysOfViolation: integer("days_of_violation"),
  resolved: boolean("resolved").default(false),
  resolutionNotes: text("resolution_notes"),

  // Reporter
  reportedById: uuid("reported_by_id"),
  reportedByName: varchar("reported_by_name", { length: 255 }),

  documentIds: jsonb("document_ids").$type<string[]>(),
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxAntiScabOrg: index("idx_anti_scab_org").on(table.organizationId),
  idxAntiScabDate: index("idx_anti_scab_date").on(table.violationDate),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const cneesstFilingsRelations = relations(cneesstFilings, ({ many }) => ({
  rightOfRefusalEvents: many(rightOfRefusalEvents),
  preventiveWithdrawals: many(preventiveWithdrawals),
}));

export const rightOfRefusalEventsRelations = relations(rightOfRefusalEvents, ({ one }) => ({
  filing: one(cneesstFilings, {
    fields: [rightOfRefusalEvents.cneesstFilingId],
    references: [cneesstFilings.id],
  }),
}));

export const preventiveWithdrawalsRelations = relations(preventiveWithdrawals, ({ one }) => ({
  filing: one(cneesstFilings, {
    fields: [preventiveWithdrawals.cneesstFilingId],
    references: [cneesstFilings.id],
  }),
}));

// =============================================================================
// TYPES
// =============================================================================

export type InsertCneesstFiling = typeof cneesstFilings.$inferInsert;
export type SelectCneesstFiling = typeof cneesstFilings.$inferSelect;

export type InsertRightOfRefusalEvent = typeof rightOfRefusalEvents.$inferInsert;
export type SelectRightOfRefusalEvent = typeof rightOfRefusalEvents.$inferSelect;

export type InsertPreventiveWithdrawal = typeof preventiveWithdrawals.$inferInsert;
export type SelectPreventiveWithdrawal = typeof preventiveWithdrawals.$inferSelect;

export type InsertJointHsCommittee = typeof jointHsCommittees.$inferInsert;
export type SelectJointHsCommittee = typeof jointHsCommittees.$inferSelect;

export type InsertPayEquityExercise = typeof payEquityExercises.$inferInsert;
export type SelectPayEquityExercise = typeof payEquityExercises.$inferSelect;

export type InsertAntiScabViolation = typeof antiScabViolations.$inferInsert;
export type SelectAntiScabViolation = typeof antiScabViolations.$inferSelect;

/**
 * Grievance Schema
 * 
 * Comprehensive grievance tracking system for union operations.
 * Handles grievances, arbitrations, settlements, and related workflows.
 */

import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, index, pgEnum } from "drizzle-orm/pg-core";

export const grievanceTypeEnum = pgEnum("grievance_type", [
  "individual",
  "group",
  "policy",
  "contract",
  "harassment",
  "discrimination",
  "safety",
  "seniority",
  "discipline",
  "termination",
  "other",
]);

export const grievanceStatusEnum = pgEnum("grievance_status", [
  "draft",
  "filed",
  "acknowledged",
  "investigating",
  "response_due",
  "response_received",
  "escalated",
  "mediation",
  "arbitration",
  "settled",
  "withdrawn",
  "denied",
  "closed",
]);

export const grievancePriorityEnum = pgEnum("grievance_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const grievanceStepEnum = pgEnum("grievance_step", [
  "step_1",
  "step_2",
  "step_3",
  "final",
  "arbitration",
]);

export const arbitrationStatusEnum = pgEnum("arbitration_status", [
  "pending",
  "scheduled",
  "in_progress",
  "adjourned",
  "reserved",
  "award_rendered",
  "settled",
  "withdrawn",
]);

export const settlementTypeEnum = pgEnum("settlement_type", [
  "monetary",
  "non_monetary",
  "policy_change",
  " reinstatement",
  "apology",
  "training",
  "other",
]);

// Main Grievance Table
export const grievances = pgTable("grievances", {
  id: uuid("id").primaryKey().defaultRandom(),
  grievanceNumber: varchar("grievance_number", { length: 50 }).unique().notNull(),
  
  // Classification
  type: grievanceTypeEnum("type").notNull(),
  status: grievanceStatusEnum("status").notNull().default("draft"),
  priority: grievancePriorityEnum("priority").default("medium"),
  step: grievanceStepEnum("step"),
  
  // Parties
  grievantId: uuid("grievant_id"),
  grievantName: varchar("grievant_name", { length: 255 }),
  grievantEmail: varchar("grievant_email", { length: 255 }),
  unionRepId: uuid("union_rep_id"),
  employerRepId: varchar("employer_rep_id", { length: 255 }),
  
  // Employer/Organization
  employerId: uuid("employer_id"),
  employerName: varchar("employer_name", { length: 255 }),
  workplaceId: uuid("workplace_id"),
  workplaceName: varchar("workplace_name", { length: 255 }),
  
  // Member details (from intake form)
  memberPhone: varchar("member_phone", { length: 50 }),
  memberNumber: varchar("member_number", { length: 100 }),
  localChapter: varchar("local_chapter", { length: 255 }),

  // Workplace details (from intake form)
  department: varchar("department", { length: 255 }),
  branch: varchar("branch", { length: 255 }),
  supervisorName: varchar("supervisor_name", { length: 255 }),
  incidentLocation: varchar("incident_location", { length: 500 }),

  // CBA Reference
  cbaId: uuid("cba_id"),
  cbaArticle: varchar("cba_article", { length: 100 }),
  cbaSection: varchar("cba_section", { length: 100 }),
  
  // Details
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  background: text("background"),
  desiredOutcome: text("desired_outcome"),

  // Sensitivity flags (from intake form)
  workplaceSafetyFlag: boolean("workplace_safety_flag").default(false),
  harassmentFlag: boolean("harassment_flag").default(false),
  discriminationFlag: boolean("discrimination_flag").default(false),
  accommodationFlag: boolean("accommodation_flag").default(false),
  
  // Dates
  incidentDate: timestamp("incident_date", { withTimezone: true }),
  filedDate: timestamp("filed_date", { withTimezone: true }),
  responseDeadline: timestamp("response_deadline", { withTimezone: true }),
  meetingDate: timestamp("meeting_date", { withTimezone: true }),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  
  // Timeline
  timeline: jsonb("timeline").$type<Array<{
    date: string;
    action: string;
    actor: string;
    notes?: string;
  }>>(),
  
  // Related records
  groupGrievanceId: uuid("group_grievance_id"),
  relatedGrievanceIds: uuid("related_grievance_ids").array(),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>>(),
  
  // Flags
  isGroupGrievance: boolean("is_group_grievance").default(false),
  isArbitrationEligible: boolean("is_arbitration_eligible").default(false),
  hasLegalImplications: boolean("has_legal_implications").default(false),
  isConfidential: boolean("is_confidential").default(false),
  
  // Organization
  organizationId: uuid("organization_id").notNull(),
  
  // Metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
  lastUpdatedBy: uuid("last_updated_by"),
}, (table) => [
  index("idx_grievances_number").on(table.grievanceNumber),
  index("idx_grievances_status").on(table.status),
  index("idx_grievances_type").on(table.type),
  index("idx_grievances_priority").on(table.priority),
  index("idx_grievances_step").on(table.step),
  index("idx_grievances_grievant").on(table.grievantId),
  index("idx_grievances_union_rep").on(table.unionRepId),
  index("idx_grievances_employer").on(table.employerId),
  index("idx_grievances_cba").on(table.cbaId),
  index("idx_grievances_org").on(table.organizationId),
  index("idx_grievances_deadline").on(table.responseDeadline),
]);

// Grievance Responses
export const grievanceResponses = pgTable("grievance_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  grievanceId: uuid("grievance_id").references(() => grievances.id).notNull(),
  
  // Response details
  responseNumber: integer("response_number").notNull(),
  respondingParty: varchar("responding_party", { length: 100 }).notNull(), // employer, union, arbitration_board
  responderName: varchar("responder_name", { length: 255 }),
  responderTitle: varchar("responder_title", { length: 255 }),
  
  // Content
  response: text("response").notNull(),
  position: text("position"),
  
  // Dates
  responseDate: timestamp("response_date", { withTimezone: true }).notNull(),
  receivedDate: timestamp("received_date", { withTimezone: true }),
  
  // Outcome
  acceptedByGrievant: boolean("accepted_by_grievant"),
  acceptedByEmployer: boolean("accepted_by_employer"),
  
  // Next steps
  nextDeadline: timestamp("next_deadline", { withTimezone: true }),
  nextStep: varchar("next_step", { length: 100 }),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>>(),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_grievance_responses_grievance").on(table.grievanceId),
  index("idx_grievance_responses_date").on(table.responseDate),
]);

// Arbitrations
export const arbitrations = pgTable("arbitrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  grievanceId: uuid("grievance_id").references(() => grievances.id).notNull(),
  
  // Arbitration details
  arbitrationNumber: varchar("arbitration_number", { length: 50 }).unique().notNull(),
  boardName: varchar("board_name", { length: 255 }).notNull(),
  boardType: varchar("board_type", { length: 100 }).notNull(), // interest, rights, grievance
  
  // Panel
  arbitratorIds: uuid("arbitrator_ids").array(),
  arbitratorNames: varchar("arbitrator_names", { length: 255 }).array(),
  unionAppointee: varchar("union_appointee", { length: 255 }),
  employerAppointee: varchar("employer_appointee", { length: 255 }),
  chairAppointee: varchar("chair_appointee", { length: 255 }),
  
  // Scheduling
  status: arbitrationStatusEnum("status").notNull().default("pending"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  location: varchar("location", { length: 500 }),
  virtualMeetingUrl: varchar("virtual_meeting_url", { length: 500 }),
  
  // Deadlines
  submissionDeadline: timestamp("submission_deadline", { withTimezone: true }),
  evidenceDeadline: timestamp("evidence_deadline", { withTimezone: true }),
  replyDeadline: timestamp("reply_deadline", { withTimezone: true }),
  
  // Proceedings
  hearingDays: integer("hearing_days").array(),
  hearingDates: timestamp("hearing_dates", { withTimezone: true }).array(),
  adjournedTo: timestamp("adjourned_to", { withTimezone: true }),
  
  // Awards
  awardDeadline: timestamp("award_deadline", { withTimezone: true }),
  awardDate: timestamp("award_date", { withTimezone: true }),
  award: text("award"),
  awardSummary: text("award_summary"),
  
  // Costs
  unionCostShare: integer("union_cost_share"), // percentage
  employerCostShare: integer("employer_cost_share"), // percentage
  estimatedCost: integer("estimated_cost"),
  actualCost: integer("actual_cost"),
  
  // Documents
  submissions: jsonb("submissions").$type<Array<{
    type: string;
    party: string;
    submittedAt: string;
    documentUrl: string;
  }>>(),
  exhibits: jsonb("exhibits").$type<Array<{
    number: string;
    description: string;
    submittedBy: string;
  }>>(),
  
  // Organization
  organizationId: uuid("organization_id").notNull(),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_arbitrations_number").on(table.arbitrationNumber),
  index("idx_arbitrations_grievance").on(table.grievanceId),
  index("idx_arbitrations_status").on(table.status),
  index("idx_arbitrations_board").on(table.boardName),
  index("idx_arbitrations_date").on(table.scheduledDate),
  index("idx_arbitrations_org").on(table.organizationId),
]);

// Settlements
export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  grievanceId: uuid("grievance_id").references(() => grievances.id).notNull(),
  arbitrationId: uuid("arbitration_id").references(() => arbitrations.id),
  
  // Settlement details
  settlementType: settlementTypeEnum("settlement_type").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("proposed"), // proposed, agreed, implemented, rejected
  
  // Terms
  monetaryAmount: integer("monetary_amount"),
  monetaryDetails: text("monetary_details"),
  nonMonetaryTerms: jsonb("non_monetary_terms").$type<Array<{
    type: string;
    description: string;
    deadline?: string;
    status: string;
  }>>(),
  
  // Implementation
  implementedAt: timestamp("implemented_at", { withTimezone: true }),
  implementationNotes: text("implementation_notes"),
  
  // Compliance
  complianceDeadline: timestamp("compliance_deadline", { withTimezone: true }),
  complianceStatus: varchar("compliance_status", { length: 50 }),
  complianceNotes: text("compliance_notes"),
  
  // Approval
  approvedByGrievant: boolean("approved_by_grievant"),
  approvedByEmployer: boolean("approved_by_employer"),
  approvedByUnion: boolean("approved_by_union"),
  approvalDates: timestamp("approval_dates", { withTimezone: true }).array(),
  
  // Agreement document
  agreementUrl: varchar("agreement_url", { length: 500 }),
  confidentiality: boolean("confidentiality").default(false),
  
  // Organization
  organizationId: uuid("organization_id").notNull(),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_settlements_grievance").on(table.grievanceId),
  index("idx_settlements_arbitration").on(table.arbitrationId),
  index("idx_settlements_status").on(table.status),
  index("idx_settlements_org").on(table.organizationId),
]);

// Grievance Timeline/History
export const grievanceTimeline = pgTable("grievance_timeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  grievanceId: uuid("grievance_id").references(() => grievances.id).notNull(),
  
  // Event details
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  actor: varchar("actor", { length: 255 }),
  actorRole: varchar("actor_role", { length: 100 }),
  
  // Content
  description: text("description").notNull(),
  notes: text("notes"),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    id: string;
    name: string;
    url: string;
  }>>(),
  
  // Metadata
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_grievance_timeline_grievance").on(table.grievanceId),
  index("idx_grievance_timeline_date").on(table.eventDate),
  index("idx_grievance_timeline_type").on(table.eventType),
]);

// Grievance Deadlines
export const grievanceDeadlines = pgTable("grievance_deadlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  grievanceId: uuid("grievance_id").references(() => grievances.id).notNull(),
  
  // Deadline details
  deadlineType: varchar("deadline_type", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, met, extended, missed
  completedAt: timestamp("completed_at", { withTimezone: true }),
  extensionGranted: boolean("extension_granted").default(false),
  newDeadline: timestamp("new_deadline", { withTimezone: true }),
  
  // Reminders
  reminderDays: integer("reminder_days").array(), // days before deadline to send reminders
  remindersSent: jsonb("reminders_sent").$type<Array<{
    sentAt: string;
    recipient: string;
    method: string;
  }>>(),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_grievance_deadlines_grievance").on(table.grievanceId),
  index("idx_grievance_deadlines_due").on(table.dueDate),
  index("idx_grievance_deadlines_status").on(table.status),
]);

// Types
export type GrievanceType = typeof grievanceTypeEnum.enumValues[number];
export type GrievanceStatus = typeof grievanceStatusEnum.enumValues[number];
export type GrievancePriority = typeof grievancePriorityEnum.enumValues[number];
export type GrievanceStep = typeof grievanceStepEnum.enumValues[number];
export type ArbitrationStatus = typeof arbitrationStatusEnum.enumValues[number];
export type SettlementType = typeof settlementTypeEnum.enumValues[number];

export type Grievance = typeof grievances.$inferSelect;
export type GrievanceInsert = typeof grievances.$inferInsert;
export type GrievanceResponse = typeof grievanceResponses.$inferSelect;
export type Arbitration = typeof arbitrations.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type GrievanceTimeline = typeof grievanceTimeline.$inferSelect;
export type GrievanceDeadline = typeof grievanceDeadlines.$inferSelect;


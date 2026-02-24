// ============================================================================
// PHASE 6: ADVANCED GRIEVANCE MANAGEMENT - DRIZZLE SCHEMA
// ============================================================================
// Description: Type-safe schema definitions for workflow automation,
//              case assignment, document management, and settlement tracking
// Created: 2025-12-06
// ============================================================================

import { 
  pgTable, 
  pgEnum, 
  uuid, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  boolean, 
  jsonb, 
  decimal, 
  date, 
  time,
  bigint,
  index
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { claims, visibilityScopeEnum } from "./claims-schema";

// ============================================================================
// ENUMS
// ============================================================================

export const grievanceWorkflowStatusEnum = pgEnum("grievance_workflow_status", [
  "active",
  "draft",
  "archived"
]);

export const grievanceStageTypeEnum = pgEnum("grievance_stage_type", [
  "filed",
  "intake",
  "investigation",
  "step_1",
  "step_2",
  "step_3",
  "mediation",
  "pre_arbitration",
  "arbitration",
  "resolved",
  "withdrawn",
  "denied",
  "settled"
]);

export const transitionTriggerTypeEnum = pgEnum("transition_trigger_type", [
  "manual",
  "automatic",
  "deadline",
  "approval",
  "rejection"
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "reassigned",
  "declined"
]);

export const documentVersionStatusEnum = pgEnum("document_version_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "superseded"
]);

export const settlementStatusEnum = pgEnum("settlement_status", [
  "proposed",
  "under_review",
  "accepted",
  "rejected",
  "finalized"
]);

export const assignmentRoleEnum = pgEnum("assignment_role", [
  "primary_officer",
  "secondary_officer",
  "legal_counsel",
  "external_arbitrator",
  "management_rep",
  "witness",
  "observer"
]);

// ============================================================================
// TYPE DEFINITIONS FOR JSONB FIELDS
// ============================================================================

export type WorkflowStageConfig = {
  stage_id: string;
  order: number;
  required: boolean;
  sla_days?: number;
};

export type StageCondition = {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
};

export type StageAction = {
  action_type: "notify" | "assign" | "create_deadline" | "send_email" | "create_document";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action_config: Record<string, any>;
};

export type PaymentSchedule = {
  installment_number: number;
  amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue";
};

export type SettlementTerms = {
  category: string;
  description: string;
  effective_date?: string;
  responsible_party?: string;
};

export type SignatureData = {
  provider: "docusign" | "adobe_sign" | "internal";
  envelope_id?: string;
  signature_id?: string;
  ip_address?: string;
  timestamp?: string;
};

// ============================================================================
// GRIEVANCE WORKFLOWS TABLE
// ============================================================================

export const grievanceWorkflows = pgTable("grievance_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Workflow configuration
  grievanceType: varchar("grievance_type", { length: 100 }),
  contractId: uuid("contract_id"),
  isDefault: boolean("is_default").default(false),
  status: grievanceWorkflowStatusEnum("status").default("active"),
  
  // Workflow settings
  autoAssign: boolean("auto_assign").default(false),
  requireApproval: boolean("require_approval").default(false),
  slaDays: integer("sla_days"),
  
  // Stages configuration
  stages: jsonb("stages").$type<WorkflowStageConfig[]>().default([]),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index("idx_grievance_workflows_organization").on(table.organizationId),
  typeIdx: index("idx_grievance_workflows_type").on(table.grievanceType),
  statusIdx: index("idx_grievance_workflows_status").on(table.status),
}));

// ============================================================================
// GRIEVANCE STAGES TABLE
// ============================================================================

export const grievanceStages = pgTable("grievance_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  workflowId: uuid("workflow_id").references(() => grievanceWorkflows.id, { onDelete: "cascade" }),
  
  // Stage details
  name: varchar("name", { length: 255 }).notNull(),
  stageType: grievanceStageTypeEnum("stage_type").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull(),
  
  // Stage configuration
  isRequired: boolean("is_required").default(true),
  slaDays: integer("sla_days"),
  autoTransition: boolean("auto_transition").default(false),
  requireApproval: boolean("require_approval").default(false),
  
  // Transition conditions
  nextStageId: uuid("next_stage_id"),
  conditions: jsonb("conditions").$type<StageCondition[]>().default([]),
  
  // Actions on entry/exit
  entryActions: jsonb("entry_actions").$type<StageAction[]>().default([]),
  exitActions: jsonb("exit_actions").$type<StageAction[]>().default([]),
  
  // Notification settings
  notifyOnEntry: boolean("notify_on_entry").default(true),
  notifyOnDeadline: boolean("notify_on_deadline").default(true),
  notificationTemplateId: uuid("notification_template_id"),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index("idx_grievance_stages_organization").on(table.organizationId),
  workflowIdx: index("idx_grievance_stages_workflow").on(table.workflowId),
  typeIdx: index("idx_grievance_stages_type").on(table.stageType),
  orderIdx: index("idx_grievance_stages_order").on(table.workflowId, table.orderIndex),
}));

// ============================================================================
// GRIEVANCE TRANSITIONS TABLE
// ============================================================================

export const grievanceTransitions = pgTable("grievance_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  claimId: uuid("claim_id").notNull().references(() => claims.claimId),
  
  // Transition details
  fromStageId: uuid("from_stage_id").references(() => grievanceStages.id),
  toStageId: uuid("to_stage_id").notNull().references(() => grievanceStages.id),
  triggerType: transitionTriggerTypeEnum("trigger_type").notNull(),
  
  // Transition metadata
  reason: text("reason"),
  notes: text("notes"),
  transitionedBy: varchar("transitioned_by", { length: 255 }).notNull(),
  transitionedAt: timestamp("transitioned_at", { withTimezone: true }).defaultNow(),
  
  // Approval tracking
  requiresApproval: boolean("requires_approval").default(false),
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  
  // Duration tracking
  stageDurationDays: integer("stage_duration_days"),
  
  // Visibility scope (PR-4: dual-surface enforcement)
  visibilityScope: visibilityScopeEnum("visibility_scope").default("staff").notNull(),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
}, (table) => ({
  organizationIdx: index("idx_grievance_transitions_organization").on(table.organizationId),
  claimIdx: index("idx_grievance_transitions_claim").on(table.claimId),
  fromStageIdx: index("idx_grievance_transitions_from_stage").on(table.fromStageId),
  toStageIdx: index("idx_grievance_transitions_to_stage").on(table.toStageId),
  dateIdx: index("idx_grievance_transitions_date").on(table.transitionedAt),
}));

// ============================================================================
// GRIEVANCE ASSIGNMENTS TABLE
// ============================================================================

export const grievanceAssignments = pgTable("grievance_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  claimId: uuid("claim_id").notNull().references(() => claims.claimId),
  
  // Assignment details
  assignedTo: varchar("assigned_to", { length: 255 }).notNull(),
  role: assignmentRoleEnum("role").notNull(),
  status: assignmentStatusEnum("status").default("assigned"),
  
  // Assignment metadata
  assignedBy: varchar("assigned_by", { length: 255 }).notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  
  // Workload tracking
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 10, scale: 2 }),
  
  // Notes and reason
  assignmentReason: text("assignment_reason"),
  notes: text("notes"),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
}, (table) => ({
  organizationIdx: index("idx_grievance_assignments_organization").on(table.organizationId),
  claimIdx: index("idx_grievance_assignments_claim").on(table.claimId),
  assignedToIdx: index("idx_grievance_assignments_assigned_to").on(table.assignedTo),
  statusIdx: index("idx_grievance_assignments_status").on(table.status),
  roleIdx: index("idx_grievance_assignments_role").on(table.role),
}));

// ============================================================================
// GRIEVANCE DOCUMENTS TABLE
// ============================================================================

export const grievanceDocuments = pgTable("grievance_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  claimId: uuid("claim_id").notNull().references(() => claims.claimId),
  
  // Document details
  documentName: varchar("document_name", { length: 255 }).notNull(),
  documentType: varchar("document_type", { length: 100 }).notNull(),
  filePath: text("file_path").notNull(),
  fileSize: bigint("file_size", { mode: "number" }),
  mimeType: varchar("mime_type", { length: 100 }),
  
  // Version control
  version: integer("version").default(1),
  parentDocumentId: uuid("parent_document_id"),
  isLatestVersion: boolean("is_latest_version").default(true),
  versionStatus: documentVersionStatusEnum("version_status").default("draft"),
  
  // Document metadata
  description: text("description"),
  tags: text("tags").array(),
  category: varchar("category", { length: 100 }),
  
  // Access control
  isConfidential: boolean("is_confidential").default(false),
  accessLevel: varchar("access_level", { length: 50 }).default("standard"),
  
  // E-signature tracking
  requiresSignature: boolean("requires_signature").default(false),
  signatureStatus: varchar("signature_status", { length: 50 }),
  signedBy: varchar("signed_by", { length: 255 }),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signatureData: jsonb("signature_data").$type<SignatureData>(),
  
  // OCR and indexing
  ocrText: text("ocr_text"),
  indexed: boolean("indexed").default(false),
  
  // Audit trail
  uploadedBy: varchar("uploaded_by", { length: 255 }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow(),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  
  // Retention policy
  retentionPeriodDays: integer("retention_period_days"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
}, (table) => ({
  organizationIdx: index("idx_grievance_documents_organization").on(table.organizationId),
  claimIdx: index("idx_grievance_documents_claim").on(table.claimId),
  typeIdx: index("idx_grievance_documents_type").on(table.documentType),
  versionIdx: index("idx_grievance_documents_version").on(table.parentDocumentId, table.version),
  latestIdx: index("idx_grievance_documents_latest").on(table.claimId, table.isLatestVersion),
  signatureIdx: index("idx_grievance_documents_signature").on(table.requiresSignature, table.signatureStatus),
}));

// ============================================================================
// GRIEVANCE DEADLINES TABLE
// ============================================================================

export const grievanceDeadlines = pgTable("grievance_deadlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  claimId: uuid("claim_id").notNull().references(() => claims.claimId),
  stageId: uuid("stage_id").references(() => grievanceStages.id),
  
  // Deadline details
  deadlineType: varchar("deadline_type", { length: 100 }).notNull(),
  deadlineDate: date("deadline_date"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  deadlineTime: time("deadline_time"),
  timezone: varchar("timezone", { length: 50 }).default("America/Toronto"),
  description: text("description"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  status: varchar("status", { length: 50 }).default("pending"),
  
  // Assignment
  assignedTo: text("assigned_to"),
  createdBy: text("created_by"),
  
  // Completion tracking
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  
  // Calculation source
  calculatedFrom: varchar("calculated_from", { length: 100 }),
  contractClauseReference: varchar("contract_clause_reference", { length: 255 }),
  daysFromSource: integer("days_from_source"),
  
  // Status tracking
  isMet: boolean("is_met"),
  metAt: timestamp("met_at", { withTimezone: true }),
  isExtended: boolean("is_extended").default(false),
  extensionReason: text("extension_reason"),
  extendedTo: date("extended_to"),
  
  // Reminder configuration
  reminderDays: integer("reminder_days").array().default([7, 3, 1]),
  reminderSchedule: integer("reminder_schedule").array().default([7, 3, 1]),
  lastReminderSentAt: timestamp("last_reminder_sent_at", { withTimezone: true }),
  
  // Escalation
  escalateOnMiss: boolean("escalate_on_miss").default(true),
  escalateTo: uuid("escalate_to"),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  
  // Metadata
  notes: text("notes"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index("idx_grievance_deadlines_organization").on(table.organizationId),
  claimIdx: index("idx_grievance_deadlines_claim").on(table.claimId),
  stageIdx: index("idx_grievance_deadlines_stage").on(table.stageId),
  dateIdx: index("idx_grievance_deadlines_date").on(table.deadlineDate),
  typeIdx: index("idx_grievance_deadlines_type").on(table.deadlineType),
}));

// ============================================================================
// GRIEVANCE SETTLEMENTS TABLE
// ============================================================================

export const grievanceSettlements = pgTable("grievance_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  claimId: uuid("claim_id").notNull().references(() => claims.claimId),
  
  // Settlement details
  settlementType: varchar("settlement_type", { length: 100 }).notNull(),
  status: settlementStatusEnum("status").default("proposed"),
  
  // Financial terms
  monetaryAmount: decimal("monetary_amount", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("CAD"),
  paymentSchedule: jsonb("payment_schedule").$type<PaymentSchedule[]>(),
  
  // Non-monetary terms
  termsDescription: text("terms_description").notNull(),
  termsStructured: jsonb("terms_structured").$type<SettlementTerms[]>(),
  
  // Proposal tracking
  proposedBy: varchar("proposed_by", { length: 50 }).notNull(),
  proposedByUser: varchar("proposed_by_user", { length: 255 }),
  proposedAt: timestamp("proposed_at", { withTimezone: true }).defaultNow(),
  
  // Response tracking
  respondedBy: varchar("responded_by", { length: 50 }),
  respondedByUser: varchar("responded_by_user", { length: 255 }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  responseNotes: text("response_notes"),
  
  // Approval workflow
  requiresMemberApproval: boolean("requires_member_approval").default(true),
  memberApproved: boolean("member_approved"),
  memberApprovedAt: timestamp("member_approved_at", { withTimezone: true }),
  
  requiresUnionApproval: boolean("requires_union_approval").default(true),
  unionApproved: boolean("union_approved"),
  unionApprovedBy: varchar("union_approved_by", { length: 255 }),
  unionApprovedAt: timestamp("union_approved_at", { withTimezone: true }),
  
  requiresManagementApproval: boolean("requires_management_approval").default(true),
  managementApproved: boolean("management_approved"),
  managementApprovedBy: varchar("management_approved_by", { length: 255 }),
  managementApprovedAt: timestamp("management_approved_at", { withTimezone: true }),
  
  // Finalization
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  finalizedBy: varchar("finalized_by", { length: 255 }),
  
  // Document references
  settlementDocumentId: uuid("settlement_document_id"),
  signedAgreementId: uuid("signed_agreement_id"),
  
  // Precedent value
  setPrecedent: boolean("set_precedent").default(false),
  precedentDescription: text("precedent_description"),
  
  // Metadata
  notes: text("notes"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index("idx_grievance_settlements_organization").on(table.organizationId),
  claimIdx: index("idx_grievance_settlements_claim").on(table.claimId),
  statusIdx: index("idx_grievance_settlements_status").on(table.status),
  typeIdx: index("idx_grievance_settlements_type").on(table.settlementType),
  proposedAtIdx: index("idx_grievance_settlements_proposed_at").on(table.proposedAt),
}));

// ============================================================================
// GRIEVANCE COMMUNICATIONS TABLE
// ============================================================================

export const grievanceCommunications = pgTable("grievance_communications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  claimId: uuid("claim_id").notNull().references(() => claims.claimId),
  
  // Communication details
  communicationType: varchar("communication_type", { length: 100 }).notNull(),
  direction: varchar("direction", { length: 20 }).notNull(),
  
  // Parties involved
  fromUserId: varchar("from_user_id", { length: 255 }),
  fromExternal: varchar("from_external", { length: 255 }),
  toUserIds: varchar("to_user_ids", { length: 255 }).array(),
  toExternal: varchar("to_external", { length: 255 }).array(),
  
  // Content
  subject: varchar("subject", { length: 500 }),
  body: text("body"),
  summary: text("summary"),
  
  // Metadata
  communicationDate: timestamp("communication_date", { withTimezone: true }).defaultNow(),
  durationMinutes: integer("duration_minutes"),
  
  // Attachments
  attachmentIds: uuid("attachment_ids").array(),
  
  // Integration references
  emailMessageId: varchar("email_message_id", { length: 255 }),
  smsMessageId: uuid("sms_message_id"),
  calendarEventId: uuid("calendar_event_id"),
  
  // Tracking
  isImportant: boolean("is_important").default(false),
  requiresFollowup: boolean("requires_followup").default(false),
  followupDate: date("followup_date"),
  followupCompleted: boolean("followup_completed").default(false),
  
  // Metadata
  recordedBy: varchar("recorded_by", { length: 255 }).notNull(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index("idx_grievance_communications_organization").on(table.organizationId),
  claimIdx: index("idx_grievance_communications_claim").on(table.claimId),
  typeIdx: index("idx_grievance_communications_type").on(table.communicationType),
  dateIdx: index("idx_grievance_communications_date").on(table.communicationDate),
  followupIdx: index("idx_grievance_communications_followup").on(table.requiresFollowup, table.followupCompleted),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const grievanceWorkflowsRelations = relations(grievanceWorkflows, ({ many }) => ({
  stages: many(grievanceStages),
}));

export const grievanceStagesRelations = relations(grievanceStages, ({ one, many }) => ({
  workflow: one(grievanceWorkflows, {
    fields: [grievanceStages.workflowId],
    references: [grievanceWorkflows.id],
  }),
  transitionsFrom: many(grievanceTransitions, { relationName: "fromStage" }),
  transitionsTo: many(grievanceTransitions, { relationName: "toStage" }),
  deadlines: many(grievanceDeadlines),
}));

export const grievanceTransitionsRelations = relations(grievanceTransitions, ({ one }) => ({
  claim: one(claims, {
    fields: [grievanceTransitions.claimId],
    references: [claims.claimId],
  }),
  fromStage: one(grievanceStages, {
    fields: [grievanceTransitions.fromStageId],
    references: [grievanceStages.id],
    relationName: "fromStage",
  }),
  toStage: one(grievanceStages, {
    fields: [grievanceTransitions.toStageId],
    references: [grievanceStages.id],
    relationName: "toStage",
  }),
}));

export const grievanceAssignmentsRelations = relations(grievanceAssignments, ({ one }) => ({
  claim: one(claims, {
    fields: [grievanceAssignments.claimId],
    references: [claims.claimId],
  }),
}));

export const grievanceDocumentsRelations = relations(grievanceDocuments, ({ one, many }) => ({
  claim: one(claims, {
    fields: [grievanceDocuments.claimId],
    references: [claims.claimId],
  }),
  parentDocument: one(grievanceDocuments, {
    fields: [grievanceDocuments.parentDocumentId],
    references: [grievanceDocuments.id],
    relationName: "documentVersions",
  }),
  childVersions: many(grievanceDocuments, { relationName: "documentVersions" }),
}));

export const grievanceDeadlinesRelations = relations(grievanceDeadlines, ({ one }) => ({
  claim: one(claims, {
    fields: [grievanceDeadlines.claimId],
    references: [claims.claimId],
  }),
  stage: one(grievanceStages, {
    fields: [grievanceDeadlines.stageId],
    references: [grievanceStages.id],
  }),
}));

export const grievanceSettlementsRelations = relations(grievanceSettlements, ({ one }) => ({
  claim: one(claims, {
    fields: [grievanceSettlements.claimId],
    references: [claims.claimId],
  }),
  settlementDocument: one(grievanceDocuments, {
    fields: [grievanceSettlements.settlementDocumentId],
    references: [grievanceDocuments.id],
    relationName: "settlementDoc",
  }),
  signedAgreement: one(grievanceDocuments, {
    fields: [grievanceSettlements.signedAgreementId],
    references: [grievanceDocuments.id],
    relationName: "signedDoc",
  }),
}));

export const grievanceCommunicationsRelations = relations(grievanceCommunications, ({ one }) => ({
  claim: one(claims, {
    fields: [grievanceCommunications.claimId],
    references: [claims.claimId],
  }),
}));

// ============================================================================
// GRIEVANCE APPROVALS TABLE (PR #10: Immutable Transition History)
// ============================================================================
/**
 * Append-only approval records for grievance transitions.
 * Replaces mutable approvedBy/approvedAt fields in grievanceTransitions table.
 * Each approval or rejection is a new INSERT, never UPDATE.
 */
export const grievanceApprovals = pgTable("grievance_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  transitionId: uuid("transition_id").notNull().references(() => grievanceTransitions.id, { onDelete: "cascade" }),
  
  // Approval details
  approverUserId: varchar("approver_user_id", { length: 255 }).notNull(),
  approverRole: varchar("approver_role", { length: 50 }),
  action: varchar("action", { length: 20 }).notNull(), // 'approved', 'rejected', 'returned'
  
  // Approval metadata
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow(),
  comment: text("comment"),
  rejectionReason: text("rejection_reason"),
  
  // Metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  organizationIdx: index("idx_grievance_approvals_organization").on(table.organizationId),
  transitionIdx: index("idx_grievance_approvals_transition").on(table.transitionId),
  approverIdx: index("idx_grievance_approvals_approver").on(table.approverUserId),
  actionIdx: index("idx_grievance_approvals_action").on(table.action),
  reviewedAtIdx: index("idx_grievance_approvals_reviewed_at").on(table.reviewedAt),
}));

// ============================================================================
// INFERRED TYPES
// ============================================================================

export type GrievanceWorkflow = typeof grievanceWorkflows.$inferSelect;
export type InsertGrievanceWorkflow = typeof grievanceWorkflows.$inferInsert;

export type GrievanceStage = typeof grievanceStages.$inferSelect;
export type InsertGrievanceStage = typeof grievanceStages.$inferInsert;

export type GrievanceTransition = typeof grievanceTransitions.$inferSelect;
export type InsertGrievanceTransition = typeof grievanceTransitions.$inferInsert;

export type GrievanceApproval = typeof grievanceApprovals.$inferSelect;
export type InsertGrievanceApproval = typeof grievanceApprovals.$inferInsert;

export type GrievanceAssignment = typeof grievanceAssignments.$inferSelect;
export type InsertGrievanceAssignment = typeof grievanceAssignments.$inferInsert;

export type GrievanceDocument = typeof grievanceDocuments.$inferSelect;
export type InsertGrievanceDocument = typeof grievanceDocuments.$inferInsert;

export type GrievanceDeadline = typeof grievanceDeadlines.$inferSelect;
export type InsertGrievanceDeadline = typeof grievanceDeadlines.$inferInsert;

export type GrievanceSettlement = typeof grievanceSettlements.$inferSelect;
export type InsertGrievanceSettlement = typeof grievanceSettlements.$inferInsert;

export type GrievanceCommunication = typeof grievanceCommunications.$inferSelect;
export type InsertGrievanceCommunication = typeof grievanceCommunications.$inferInsert;


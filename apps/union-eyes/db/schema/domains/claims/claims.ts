import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enums for claims
export const claimStatusEnum = pgEnum("claim_status", [
  "submitted",
  "under_review",
  "assigned",
  "investigation",
  "pending_documentation",
  "resolved",
  "rejected",
  "closed"
]);

export const claimPriorityEnum = pgEnum("claim_priority", [
  "low",
  "medium",
  "high",
  "critical"
]);

export const claimTypeEnum = pgEnum("claim_type", [
  "grievance_discipline",
  "grievance_schedule",
  "grievance_pay",
  "grievance_benefits",
  "grievance_leave",
  "workplace_safety",
  "discrimination_age",
  "discrimination_gender",
  "discrimination_race",
  "discrimination_disability",
  "discrimination_other",
  "harassment_sexual",
  "harassment_workplace",
  "wage_dispute",
  "contract_dispute",
  "retaliation",
  "wrongful_termination",
  "other",
  "harassment_verbal",
  "harassment_physical"
]);

// Visibility scope enum for dual-surface enforcement (PR-4)
export const visibilityScopeEnum = pgEnum("visibility_scope", [
  "member",
  "staff",
  "admin",
  "system"
]);

// Claims table
// NOTE: Django BaseModel is the canonical source. Drizzle mirrors it.
// PK = id (Django BaseModel auto-PK), claim_id is UNIQUE.
export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: uuid("claim_id").notNull().unique().defaultRandom(),
  claimNumber: varchar("claim_number", { length: 50 }).unique(),
  organizationId: uuid("organization_id"),
  memberId: varchar("member_id", { length: 255 }),
  isAnonymous: boolean("is_anonymous").default(true),
  
  // Claim details
  claimType: claimTypeEnum("claim_type"),
  status: claimStatusEnum("status").notNull().default("submitted"),
  priority: claimPriorityEnum("priority").notNull().default("medium"),
  
  // Incident information
  incidentDate: timestamp("incident_date", { withTimezone: true }),
  location: text("location"),
  description: text("description"),
  desiredOutcome: text("desired_outcome"),
  
  // Witness and reporting information
  witnessesPresent: boolean("witnesses_present").default(false),
  witnessDetails: text("witness_details"),
  previouslyReported: boolean("previously_reported").default(false),
  previousReportDetails: text("previous_report_details"),
  
  // Assignment and tracking
  assignedTo: varchar("assigned_to", { length: 255 }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  
  // AI analysis
  aiScore: integer("ai_score"),
  aiAnalysis: jsonb("ai_analysis"),
  meritConfidence: integer("merit_confidence"),
  precedentMatch: integer("precedent_match"),
  complexityScore: integer("complexity_score"),
  
  // Progress tracking
  progress: integer("progress").default(0),
  
  // Financial information
  claimAmount: varchar("claim_amount", { length: 20 }), // Stored as string to preserve precision
  settlementAmount: varchar("settlement_amount", { length: 20 }),
  legalCosts: varchar("legal_costs", { length: 20 }),
  courtCosts: varchar("court_costs", { length: 20 }),
  
  // Resolution information
  resolutionOutcome: varchar("resolution_outcome", { length: 100 }),
  filedDate: timestamp("filed_date", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  
  // Attachments and evidence
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`),
  
  // Voice transcriptions
  voiceTranscriptions: jsonb("voice_transcriptions").default(sql`'[]'::jsonb`),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// Claim updates/notes table
export const claimUpdates = pgTable("claim_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  updateId: uuid("update_id").unique().defaultRandom(),
  claimId: uuid("claim_id").notNull().references(() => claims.claimId, { onDelete: "cascade" }),
  updateType: varchar("update_type", { length: 50 }),
  message: text("message"),
  createdBy: varchar("created_by", { length: 255 }),
  isInternal: boolean("is_internal").default(false),
  visibilityScope: visibilityScopeEnum("visibility_scope").default("member").notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Type exports
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type ClaimUpdate = typeof claimUpdates.$inferSelect;
export type NewClaimUpdate = typeof claimUpdates.$inferInsert;


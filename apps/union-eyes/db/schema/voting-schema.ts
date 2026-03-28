import { pgTable, uuid, varchar, boolean, timestamp, text, jsonb, integer, decimal, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "../schema-organizations";
import { organizationMembers } from "./organization-members-schema";

// Voting sessions table - convention and ratification voting
export const votingSessions = pgTable("voting_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  meetingType: varchar("meeting_type", { length: 50 }).notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  scheduledEndTime: timestamp("scheduled_end_time", { withTimezone: true }),
  allowAnonymous: boolean("allow_anonymous").default(true),
  requiresQuorum: boolean("requires_quorum").default(true),
  quorumThreshold: integer("quorum_threshold").default(50),
  totalEligibleVoters: integer("total_eligible_voters").default(0),
  settings: jsonb("settings").default(sql`'{}'::jsonb`),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
}, (table) => ({
  checkType: check("valid_type", 
    sql`${table.type} IN ('convention', 'ratification', 'special_vote', 'election', 'strike_authorization', 'bylaw_amendment', 'policy', 'pulse_check')`),
  checkStatus: check("valid_status", 
    sql`${table.status} IN ('draft', 'active', 'paused', 'closed', 'cancelled')`),
  checkMeetingType: check("valid_meeting_type", 
    sql`${table.meetingType} IN ('convention', 'ratification', 'emergency', 'special', 'general_membership', 'annual_general_meeting', 'special_meeting', 'executive_board')`),
  checkTimeRange: check("valid_time_range", 
    sql`${table.endTime} IS NULL OR ${table.startTime} IS NULL OR ${table.endTime} > ${table.startTime}`),
  checkScheduledEnd: check("valid_scheduled_end", 
    sql`${table.scheduledEndTime} IS NULL OR ${table.scheduledEndTime} > ${table.createdAt}`),
  checkQuorum: check("valid_quorum", 
    sql`${table.quorumThreshold} >= 0 AND ${table.quorumThreshold} <= 100`),
}));

// Voting options table - choices available in each session
export const votingOptions = pgTable("voting_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => votingSessions.id, { onDelete: "cascade" }),
  text: varchar("text", { length: 500 }).notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  isDefault: boolean("is_default").default(false),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Voter eligibility table - who can vote in each session
export const voterEligibility = pgTable("voter_eligibility", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => votingSessions.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => organizationMembers.id, { onDelete: "cascade" }),
  isEligible: boolean("is_eligible").default(true),
  eligibilityReason: text("eligibility_reason"),
  votingWeight: decimal("voting_weight", { precision: 5, scale: 2 }).default("1.0"),
  canDelegate: boolean("can_delegate").default(false),
  delegatedTo: uuid("delegated_to"),
  restrictions: text("restrictions").array(),
  verificationStatus: varchar("verification_status", { length: 20 }).default("pending"),
  voterMetadata: jsonb("voter_metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  checkVerificationStatus: check("valid_verification_status", 
    sql`${table.verificationStatus} IN ('pending', 'verified', 'rejected')`),
}));

// Votes table - anonymized voting records
export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => votingSessions.id, { onDelete: "cascade" }),
  optionId: uuid("option_id").notNull().references(() => votingOptions.id, { onDelete: "cascade" }),
  voterId: varchar("voter_id", { length: 100 }).notNull(), // Anonymized
  voterHash: varchar("voter_hash", { length: 100 }), // Hash for verification
  signature: text("signature"),
  receiptId: varchar("receipt_id", { length: 255 }),
  verificationCode: varchar("verification_code", { length: 100 }),
  auditHash: varchar("audit_hash", { length: 255 }),
  castAt: timestamp("cast_at", { withTimezone: true }).defaultNow(),
  isAnonymous: boolean("is_anonymous").default(true),
  voterType: varchar("voter_type", { length: 20 }).default("member"),
  voterMetadata: jsonb("voter_metadata").default(sql`'{}'::jsonb`),
}, (table) => ({
  checkVoterType: check("valid_voter_type", 
    sql`${table.voterType} IN ('member', 'delegate', 'officer', 'guest')`),
}));

// Voting notifications table - alerts for voting events
export const votingNotifications = pgTable("voting_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => votingSessions.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  recipientId: uuid("recipient_id").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium"),
  deliveryMethod: text("delivery_method").array().default(sql`ARRAY['push']`),
  isRead: boolean("is_read").default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
}, (table) => ({
  checkType: check("valid_notification_type", 
    sql`${table.type} IN ('session_started', 'session_ending', 'results_available', 'quorum_reached', 'vote_reminder')`),
  checkPriority: check("valid_priority", 
    sql`${table.priority} IN ('low', 'medium', 'high', 'urgent')`),
}));

// Voting audit log table - cryptographic audit trail for voting integrity
export const votingAuditLog = pgTable("voting_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => votingSessions.id, { onDelete: "cascade" }),
  receiptId: varchar("receipt_id", { length: 255 }).notNull().unique(),
  voteHash: varchar("vote_hash", { length: 255 }).notNull(),
  signature: text("signature").notNull(),
  auditHash: varchar("audit_hash", { length: 255 }).notNull(),
  previousAuditHash: varchar("previous_audit_hash", { length: 255 }),
  votedAt: timestamp("voted_at", { withTimezone: true }).notNull(),
  verificationCode: varchar("verification_code", { length: 100 }),
  isAnonymous: boolean("is_anonymous").default(true),
  chainValid: boolean("chain_valid").default(true),
  tamperedIndicators: text("tampered_indicators").array(),
  auditMetadata: jsonb("audit_metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxSessionId: sql`CREATE INDEX IF NOT EXISTS idx_voting_audit_session ON ${table} (${table.sessionId})`,
  idxReceiptId: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_voting_receipt ON ${table} (${table.receiptId})`,
  idxAuditHash: sql`CREATE INDEX IF NOT EXISTS idx_voting_audit_hash ON ${table} (${table.auditHash})`,
}));

// Export types
export type VotingSession = typeof votingSessions.$inferSelect;
export type NewVotingSession = typeof votingSessions.$inferInsert;
export type VotingOption = typeof votingOptions.$inferSelect;
export type NewVotingOption = typeof votingOptions.$inferInsert;
export type VoterEligibility = typeof voterEligibility.$inferSelect;
export type NewVoterEligibility = typeof voterEligibility.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type VotingNotification = typeof votingNotifications.$inferSelect;
export type NewVotingNotification = typeof votingNotifications.$inferInsert;
export type VotingAuditLog = typeof votingAuditLog.$inferSelect;
export type NewVotingAuditLog = typeof votingAuditLog.$inferInsert;


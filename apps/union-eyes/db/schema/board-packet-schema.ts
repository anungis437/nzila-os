/**
 * Board Packet Schema
 * 
 * Automated board packet generation for governance meetings
 * Includes financials, cases, motions, audit exceptions, and compliance status
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "../schema-organizations";

/**
 * Board Packets Table
 * Monthly governance packets with financial, operational, and compliance reports
 */
export const boardPackets = pgTable("board_packets", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Packet metadata
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  packetType: varchar("packet_type", { length: 50 }).notNull(), // 'monthly' | 'quarterly' | 'annual' | 'special'
  
  // Organization
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  
  // Period covered
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalQuarter: integer("fiscal_quarter"), // 1-4, null for monthly
  
  // Generation
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
  generatedBy: varchar("generated_by", { length: 255 }).notNull(),
  
  // Status
  status: varchar("status", { length: 50 }).notNull().default("draft"), // 'draft' | 'finalized' | 'distributed' | 'archived'
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  distributedAt: timestamp("distributed_at", { withTimezone: true }),
  
  // Content sections (JSON)
  financialSummary: jsonb("financial_summary").notNull(), // Revenue, expenses, reserves, arrears
  membershipStats: jsonb("membership_stats").notNull(), // Total, new, inactive, growth rate
  caseSummary: jsonb("case_summary").notNull(), // Open cases, SLA risks, closed cases
  motionsAndVotes: jsonb("motions_and_votes"), // Decisions requiring board action
  auditExceptions: jsonb("audit_exceptions"), // Compliance issues, control failures
  complianceStatus: jsonb("compliance_status").notNull(), // Regulatory compliance checklist
  
  // Actions and follow-ups
  actionItems: jsonb("action_items"), // [{ item, owner, deadline, status }]
  
  // Distribution
  recipientRoles: text("recipient_roles").array().notNull(), // ['board_member', 'executive', 'auditor']
  distributionList: jsonb("distribution_list"), // [{ name, email, role }]
  
  // Documents
  pdfUrl: text("pdf_url"), // Generated PDF URL
  attachments: jsonb("attachments"), // [{ name, type, url }]
  
  // Signature/checksum for integrity
  contentHash: varchar("content_hash", { length: 255 }), // SHA-256 hash of content
  signedBy: varchar("signed_by", { length: 255 }), // Who certified the packet
  signedAt: timestamp("signed_at", { withTimezone: true }),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

/**
 * Board Packet Distribution Log
 * Tracks who received which packets and when
 */
export const boardPacketDistributions = pgTable("board_packet_distributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Packet reference
  packetId: uuid("packet_id").notNull().references(() => boardPackets.id, { onDelete: "cascade" }),
  
  // Recipient
  recipientId: uuid("recipient_id").notNull(), // User ID
  recipientName: varchar("recipient_name", { length: 255 }).notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  recipientRole: varchar("recipient_role", { length: 50 }).notNull(),
  
  // Distribution
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  deliveryMethod: varchar("delivery_method", { length: 50 }).notNull(), // 'email' | 'portal' | 'physical'
  
  // Tracking
  opened: boolean("opened").default(false),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  downloaded: boolean("downloaded").default(false),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
  
  // Acknowledgment
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgmentSignature: text("acknowledgment_signature"),
  
  // Audit trail
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Export types
export type BoardPacket = typeof boardPackets.$inferSelect;
export type NewBoardPacket = typeof boardPackets.$inferInsert;
export type BoardPacketDistribution = typeof boardPacketDistributions.$inferSelect;
export type NewBoardPacketDistribution = typeof boardPacketDistributions.$inferInsert;

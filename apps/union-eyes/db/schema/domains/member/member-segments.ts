/**
 * Member Segments Schema
 * 
 * Phase 1.3: Search & Segmentation
 * 
 * Stores saved member searches (segments) that can be executed dynamically.
 * Supports faceted search, export controls, and audit logging.
 * 
 * @module db/schema/domains/member/member-segments
 */

import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// MEMBER SEGMENTS
// =============================================================================

/**
 * Member Segments Table
 * 
 * Stores saved search queries that can be re-executed dynamically.
 * Used for creating reusable member lists (e.g., "Active Stewards", "Site A Workers").
 */
export const memberSegments = pgTable("member_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  
  // Segment identification
  name: text("name").notNull(),
  description: text("description"),
  
  // Segment definition (stored as JSON for flexibility)
  filters: jsonb("filters").notNull().$type<MemberSegmentFilters>(),
  
  // Metadata
  createdBy: text("created_by").notNull(), // Clerk user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // Usage tracking
  lastExecutedAt: timestamp("last_executed_at"),
  executionCount: integer("execution_count").default(0).notNull(),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isPublic: boolean("is_public").default(false).notNull(), // Can other users see this segment?
});

/**
 * Segment Filters Type
 * 
 * Defines all possible filter criteria for member search.
 */
export type MemberSegmentFilters = {
  // Text search
  searchQuery?: string;
  
  // Member attributes
  status?: Array<"active" | "inactive" | "on-leave" | "suspended">;
  role?: Array<"member" | "steward" | "officer" | "admin">;
  membershipType?: Array<string>; // e.g., "full", "associate", "honorary"
  
  // Organization structure
  employerId?: string[];
  worksiteId?: string[];
  bargainingUnitId?: string[];
  committeeId?: string[];
  
  // Employment attributes (Phase 1.2 integration)
  employmentStatus?: Array<"active" | "terminated" | "on_leave" | "probation">;
  jobClassification?: string[];
  checkoffAuthorized?: boolean;
  
  // Date ranges
  joinDateFrom?: string; // ISO date
  joinDateTo?: string;
  hireDateFrom?: string;
  hireDateTo?: string;
  seniorityDateFrom?: string;
  seniorityDateTo?: string;
  
  // Seniority
  seniorityYearsMin?: number;
  seniorityYearsMax?: number;
  
  // Custom fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customFields?: Record<string, any>;
};

export type InsertMemberSegment = typeof memberSegments.$inferInsert;
export type SelectMemberSegment = typeof memberSegments.$inferSelect;

// =============================================================================
// SEGMENT EXECUTIONS (AUDIT TRAIL)
// =============================================================================

/**
 * Segment Executions Table
 * 
 * Tracks every time a segment is executed.
 * Useful for analytics and audit logging.
 */
export const segmentExecutions = pgTable("segment_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  segmentId: uuid("segment_id").notNull().references(() => memberSegments.id, { onDelete: "cascade" }),
  
  // Execution context
  executedBy: text("executed_by").notNull(), // Clerk user ID
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  
  // Results
  resultCount: integer("result_count").notNull(),
  executionTimeMs: integer("execution_time_ms"), // Query performance tracking
  
  // Filters used (snapshot at time of execution)
  filtersSnapshot: jsonb("filters_snapshot").$type<MemberSegmentFilters>(),
});

export type InsertSegmentExecution = typeof segmentExecutions.$inferInsert;
export type SelectSegmentExecution = typeof segmentExecutions.$inferSelect;

// =============================================================================
// SEGMENT EXPORTS (WATERMARKING & AUDIT)
// =============================================================================

/**
 * Segment Exports Table
 * 
 * Tracks all member data exports for compliance and audit.
 * Implements watermarking and export controls.
 */
export const segmentExports = pgTable("segment_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  segmentId: uuid("segment_id").references(() => memberSegments.id, { onDelete: "set null" }),
  
  // Export metadata
  exportedBy: text("exported_by").notNull(), // Clerk user ID
  exportedAt: timestamp("exported_at").defaultNow().notNull(),
  
  // Export configuration
  format: text("format").notNull(), // "csv", "excel", "pdf"
  includeFields: jsonb("include_fields").$type<string[]>(), // Which fields were exported
  
  // Data scope
  memberCount: integer("member_count").notNull(),
  filtersUsed: jsonb("filters_used").$type<MemberSegmentFilters>(),
  
  // Watermarking
  watermark: text("watermark"), // "Exported by [Name] on [Date] for [Org]"
  exportHash: text("export_hash"), // SHA-256 hash of exported data for verification
  
  // Access control
  purpose: text("purpose"), // Why was this exported? (optional field for high-security orgs)
  approvedBy: text("approved_by"), // For orgs requiring export approval
  
  // File storage (if applicable)
  fileUrl: text("file_url"),
  fileSize: integer("file_size"), // bytes
  
  // Compliance
  dataRetentionDays: integer("data_retention_days").default(90), // Auto-delete after 90 days
  deletedAt: timestamp("deleted_at"),
});

export type InsertSegmentExport = typeof segmentExports.$inferInsert;
export type SelectSegmentExport = typeof segmentExports.$inferSelect;

// =============================================================================
// RELATIONS
// =============================================================================

export const memberSegmentsRelations = relations(memberSegments, ({ many }) => ({
  executions: many(segmentExecutions),
  exports: many(segmentExports),
}));

export const segmentExecutionsRelations = relations(segmentExecutions, ({ one }) => ({
  segment: one(memberSegments, {
    fields: [segmentExecutions.segmentId],
    references: [memberSegments.id],
  }),
}));

export const segmentExportsRelations = relations(segmentExports, ({ one }) => ({
  segment: one(memberSegments, {
    fields: [segmentExports.segmentId],
    references: [memberSegments.id],
  }),
}));

/**
 * Local Drizzle table references for tables NOT exported from @nzila/db.
 *
 * These reference the same physical tables in the nzila_automation DB.
 * Used by Deal Engine adapters to query UE ingestion data without
 * creating a cross-app package dependency.
 */
import { pgTable, uuid, varchar, integer, timestamp, jsonb, text, real, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── UE Ingestion tables (source: apps/union-eyes/db/schema/ingestion-schema.ts) ──

export const ingestionBatches = pgTable("ingestion_batches", {
  id: uuid("id").primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  sourceSystem: varchar("source_system", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  totalRecords: integer("total_records").notNull(),
  processed: integer("processed").notNull(),
  succeeded: integer("succeeded").notNull(),
  failed: integer("failed").notNull(),
  skipped: integer("skipped").notNull(),
  errorSummary: jsonb("error_summary"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_ingestion_batches_org").on(table.organizationId),
  index("idx_ingestion_batches_status").on(table.status),
]);

export const ingestionRecords = pgTable("ingestion_records", {
  id: uuid("id").primaryKey(),
  batchId: uuid("batch_id").notNull(),
  recordIndex: integer("record_index").notNull(),
  recordType: varchar("record_type", { length: 50 }).notNull(),
  externalId: varchar("external_id", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull(),
  resolvedId: uuid("entity_id"),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  fingerprint: varchar("fingerprint", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  index("idx_ingestion_records_batch").on(table.batchId),
  index("idx_ingestion_records_status").on(table.status),
]);

export const dataQualityWarnings = pgTable("data_quality_warnings", {
  id: uuid("id").primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  recordType: varchar("record_type", { length: 30 }).notNull(),
  recordId: uuid("record_id").notNull(),
  batchId: uuid("batch_id"),
  severity: varchar("severity", { length: 10 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }),
  message: text("message").notNull(),
  resolved: boolean("resolved").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("idx_quality_warnings_batch").on(table.batchId),
]);

export const duplicateGroups = pgTable("duplicate_groups", {
  id: uuid("id").primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  groupType: varchar("group_type", { length: 30 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  autoScore: real("auto_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("idx_duplicate_groups_org").on(table.organizationId),
]);

// ── Deal Engine pilot tracking ──────────────────────────

export const dealEnginePilots = pgTable("deal_engine_pilots", {
  id: uuid("id").primaryKey(),
  dealId: varchar("deal_id", { length: 255 }).notNull(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  product: varchar("product", { length: 50 }).notNull(),
  pilotStatus: varchar("pilot_status", { length: 30 }).notNull(),
  successCriteria: jsonb("success_criteria").notNull().default([]),
  startDate: timestamp("start_date", { withTimezone: true }),
  targetReviewDate: timestamp("target_review_date", { withTimezone: true }),
  owner: varchar("owner", { length: 255 }).notNull(),
  ingestionStatus: varchar("ingestion_status", { length: 30 }),
  checklist: jsonb("checklist").notNull().default({}),
  currentBlockers: jsonb("current_blockers").notNull().default([]),
  daysActive: integer("days_active").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("idx_de_pilots_deal").on(table.dealId),
  index("idx_de_pilots_status").on(table.pilotStatus),
]);

// ── Deal Engine follow-up tasks ─────────────────────────

export const dealEngineFollowUps = pgTable("deal_engine_follow_ups", {
  id: uuid("id").primaryKey(),
  dealId: varchar("deal_id", { length: 255 }),
  pilotId: varchar("pilot_id", { length: 255 }),
  accountName: varchar("account_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  owner: varchar("owner", { length: 255 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  isOverdue: boolean("is_overdue").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  trigger: varchar("trigger", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("idx_de_followups_owner").on(table.owner),
  index("idx_de_followups_due").on(table.dueDate),
]);

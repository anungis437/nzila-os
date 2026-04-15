import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  numeric,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { memberEmployment, jobClassifications } from "../member/member-employment";
import { employers, worksites, bargainingUnits } from "../../union-structure-schema";

export const employerTimesheetBatchStatusEnum = pgEnum("employer_timesheet_batch_status", [
  "uploaded",
  "normalizing",
  "validated",
  "rejected",
  "processed",
]);

export const employerTimesheetEntryStatusEnum = pgEnum("employer_timesheet_entry_status", [
  "pending",
  "valid",
  "invalid",
  "duplicate",
]);

export const employerTimesheetBatches = pgTable(
  "employer_timesheet_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    employerId: uuid("employer_id").notNull().references(() => employers.id, { onDelete: "restrict" }),
    worksiteId: uuid("worksite_id").references(() => worksites.id, { onDelete: "set null" }),
    bargainingUnitId: uuid("bargaining_unit_id").references(() => bargainingUnits.id, {
      onDelete: "set null",
    }),
    batchCode: varchar("batch_code", { length: 120 }).notNull(),
    sourceFileName: varchar("source_file_name", { length: 255 }).notNull(),
    sourceFileHash: varchar("source_file_hash", { length: 64 }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: employerTimesheetBatchStatusEnum("status").notNull().default("uploaded"),
    validationSummary: jsonb("validation_summary").$type<Record<string, unknown>>().notNull().default({}),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_timesheet_batches_org_idx").on(table.organizationId),
    employerIdx: index("employer_timesheet_batches_employer_idx").on(table.employerId),
    periodIdx: index("employer_timesheet_batches_period_idx").on(table.periodStart, table.periodEnd),
    statusIdx: index("employer_timesheet_batches_status_idx").on(table.status),
  }),
);

export const employerTimesheetEntries = pgTable(
  "employer_timesheet_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => employerTimesheetBatches.id, { onDelete: "cascade" }),
    memberEmploymentId: uuid("member_employment_id").references(() => memberEmployment.id, {
      onDelete: "set null",
    }),
    employerId: uuid("employer_id").references(() => employers.id, { onDelete: "set null" }),
    worksiteId: uuid("worksite_id").references(() => worksites.id, { onDelete: "set null" }),
    bargainingUnitId: uuid("bargaining_unit_id").references(() => bargainingUnits.id, {
      onDelete: "set null",
    }),
    jobClassificationId: uuid("job_classification_id").references(() => jobClassifications.id, {
      onDelete: "set null",
    }),
    employeeExternalId: varchar("employee_external_id", { length: 120 }).notNull(),
    shiftDate: date("shift_date").notNull(),
    regularHours: numeric("regular_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    overtimeHours: numeric("overtime_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    doubletimeHours: numeric("doubletime_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    premiumCode: varchar("premium_code", { length: 120 }),
    travelHours: numeric("travel_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    rowNumber: integer("row_number").notNull(),
    sourceRowHash: varchar("source_row_hash", { length: 64 }).notNull(),
    validationErrors: jsonb("validation_errors").$type<string[]>().notNull().default([]),
    status: employerTimesheetEntryStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_timesheet_entries_org_idx").on(table.organizationId),
    batchIdx: index("employer_timesheet_entries_batch_idx").on(table.batchId),
    employmentIdx: index("employer_timesheet_entries_employment_idx").on(table.memberEmploymentId),
    dateIdx: index("employer_timesheet_entries_shift_date_idx").on(table.shiftDate),
    statusIdx: index("employer_timesheet_entries_status_idx").on(table.status),
    rowHashIdx: index("employer_timesheet_entries_row_hash_idx").on(table.sourceRowHash),
  }),
);

export type EmployerTimesheetBatch = typeof employerTimesheetBatches.$inferSelect;
export type NewEmployerTimesheetBatch = typeof employerTimesheetBatches.$inferInsert;
export type EmployerTimesheetEntry = typeof employerTimesheetEntries.$inferSelect;
export type NewEmployerTimesheetEntry = typeof employerTimesheetEntries.$inferInsert;

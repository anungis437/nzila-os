import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  numeric,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { cbaRuleVersions } from "./employer-execution-core";
import { employerTimesheetBatches, employerTimesheetEntries } from "./employer-timesheets";
import { memberEmployment } from "../member/member-employment";

export const employerPayrollRunTypeEnum = pgEnum("employer_payroll_run_type", ["preview", "official"]);
export const employerPayrollRunStatusEnum = pgEnum("employer_payroll_run_status", [
  "draft",
  "calculated",
  "approved",
  "posted",
  "replayed",
  "failed",
]);

export const employerPayrollRuns = pgTable(
  "employer_payroll_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    runCode: varchar("run_code", { length: 120 }).notNull(),
    runType: employerPayrollRunTypeEnum("run_type").notNull().default("preview"),
    status: employerPayrollRunStatusEnum("status").notNull().default("draft"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    sourceBatchId: uuid("source_batch_id").references(() => employerTimesheetBatches.id, {
      onDelete: "set null",
    }),
    cbaRuleVersionId: uuid("cba_rule_version_id").references(() => cbaRuleVersions.id, {
      onDelete: "set null",
    }),
    engineVersion: varchar("engine_version", { length: 100 }).notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    calcTrace: jsonb("calc_trace").$type<Record<string, unknown>>().notNull().default({}),
    calcTraceHash: varchar("calc_trace_hash", { length: 64 }).notNull(),
    totalGross: numeric("total_gross", { precision: 14, scale: 2 }).notNull().default("0"),
    totalNet: numeric("total_net", { precision: 14, scale: 2 }).notNull().default("0"),
    totalDues: numeric("total_dues", { precision: 14, scale: 2 }).notNull().default("0"),
    totalBenefits: numeric("total_benefits", { precision: 14, scale: 2 }).notNull().default("0"),
    totalPension: numeric("total_pension", { precision: 14, scale: 2 }).notNull().default("0"),
    immutableSnapshotLocked: boolean("immutable_snapshot_locked").notNull().default(false),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_payroll_runs_org_idx").on(table.organizationId),
    runCodeIdx: index("employer_payroll_runs_run_code_idx").on(table.runCode),
    periodIdx: index("employer_payroll_runs_period_idx").on(table.periodStart, table.periodEnd),
    statusIdx: index("employer_payroll_runs_status_idx").on(table.status),
  }),
);

export const employerPayrollRunItems = pgTable(
  "employer_payroll_run_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => employerPayrollRuns.id, { onDelete: "cascade" }),
    memberEmploymentId: uuid("member_employment_id").references(() => memberEmployment.id, {
      onDelete: "set null",
    }),
    timesheetEntryId: uuid("timesheet_entry_id").references(() => employerTimesheetEntries.id, {
      onDelete: "set null",
    }),
    employeeExternalId: varchar("employee_external_id", { length: 120 }).notNull(),
    grossPay: numeric("gross_pay", { precision: 14, scale: 2 }).notNull().default("0"),
    netPay: numeric("net_pay", { precision: 14, scale: 2 }).notNull().default("0"),
    duesAmount: numeric("dues_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    benefitAmount: numeric("benefit_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    pensionAmount: numeric("pension_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    remittanceGroupKey: varchar("remittance_group_key", { length: 120 }).notNull(),
    traceJson: jsonb("trace_json").$type<Record<string, unknown>>().notNull().default({}),
    traceHash: varchar("trace_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_payroll_run_items_org_idx").on(table.organizationId),
    runIdx: index("employer_payroll_run_items_run_idx").on(table.payrollRunId),
    employmentIdx: index("employer_payroll_run_items_employment_idx").on(table.memberEmploymentId),
    groupIdx: index("employer_payroll_run_items_group_idx").on(table.remittanceGroupKey),
  }),
);

export const employerPayrollAdjustments = pgTable(
  "employer_payroll_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => employerPayrollRuns.id, { onDelete: "cascade" }),
    payrollRunItemId: uuid("payroll_run_item_id")
      .notNull()
      .references(() => employerPayrollRunItems.id, { onDelete: "cascade" }),
    reasonCode: varchar("reason_code", { length: 120 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    adjustmentTrace: jsonb("adjustment_trace").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_payroll_adjustments_org_idx").on(table.organizationId),
    runIdx: index("employer_payroll_adjustments_run_idx").on(table.payrollRunId),
    itemIdx: index("employer_payroll_adjustments_item_idx").on(table.payrollRunItemId),
  }),
);

export type EmployerPayrollRun = typeof employerPayrollRuns.$inferSelect;
export type EmployerPayrollRunItem = typeof employerPayrollRunItems.$inferSelect;
export type EmployerPayrollAdjustment = typeof employerPayrollAdjustments.$inferSelect;

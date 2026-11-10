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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from 'drizzle-orm';
import { employerPayrollRuns } from "./employer-payroll-runs";

export const employerRemittanceRunStatusEnum = pgEnum("employer_remittance_run_status", [
  "draft",
  "generated",
  "sealed",
  "submitted",
  "failed",
]);

export const employerRemittanceRuns = pgTable(
  "employer_remittance_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => employerPayrollRuns.id, { onDelete: "restrict" }),
    runCode: varchar("run_code", { length: 120 }).notNull(),
    status: employerRemittanceRunStatusEnum("status").notNull().default("draft"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    dueDate: date("due_date").notNull(),
    totalDue: numeric("total_due", { precision: 14, scale: 2 }).notNull().default("0"),
    packageSchemaVersion: varchar('package_schema_version', { length: 40 }).notNull().default('ue-remittance-v1'),
    sourceRevisionHash: varchar('source_revision_hash', { length: 64 }).notNull(),
    evidenceManifestHash: varchar('evidence_manifest_hash', { length: 64 }),
    packageSummary: jsonb("package_summary").$type<Record<string, unknown>>().notNull().default({}),
    outputFormats: jsonb("output_formats").$type<string[]>().notNull().default(["csv", "json"]),
    immutableSnapshotLocked: boolean("immutable_snapshot_locked").notNull().default(false),
    generatedBy: text("generated_by"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_remittance_runs_org_idx").on(table.organizationId),
    payrollRunIdx: index("employer_remittance_runs_payroll_run_idx").on(table.payrollRunId),
    onePerPayrollRunIdx: uniqueIndex("employer_remittance_runs_one_per_payroll_run_uidx").on(table.payrollRunId),
    dueDateIdx: index("employer_remittance_runs_due_date_idx").on(table.dueDate),
    statusIdx: index("employer_remittance_runs_status_idx").on(table.status),
  }),
);

export const employerRemittanceSubmissions = pgTable('employer_remittance_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  remittanceRunId: uuid('remittance_run_id').notNull().references(() => employerRemittanceRuns.id, { onDelete: 'restrict' }),
  idempotencyKeyHash: varchar('idempotency_key_hash', { length: 64 }).notNull(),
  status: varchar('status', { length: 20 }).$type<'prepared' | 'submitted' | 'acknowledged' | 'rejected'>().notNull().default('prepared'),
  submissionAuthorityRef: varchar('submission_authority_ref', { length: 255 }).notNull(),
  packageDigest: varchar('package_digest', { length: 64 }).notNull(),
  providerReceiptRef: varchar('provider_receipt_ref', { length: 255 }),
  submittedBy: text('submitted_by').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reconciledBy: text('reconciled_by'),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  keyUq: uniqueIndex('employer_remittance_submissions_run_key_uniq').on(table.remittanceRunId, table.idempotencyKeyHash),
  receiptUq: uniqueIndex('employer_remittance_submissions_receipt_uniq').on(table.providerReceiptRef).where(sql`${table.providerReceiptRef} IS NOT NULL`),
  orgStatusIdx: index('employer_remittance_submissions_org_status_idx').on(table.organizationId, table.status),
}));

export const employerRemittanceRunItems = pgTable(
  "employer_remittance_run_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    remittanceRunId: uuid("remittance_run_id")
      .notNull()
      .references(() => employerRemittanceRuns.id, { onDelete: "cascade" }),
    groupKey: varchar("group_key", { length: 120 }).notNull(),
    contributionType: varchar("contribution_type", { length: 100 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    memberCount: numeric("member_count", { precision: 14, scale: 2 }).notNull().default("0"),
    traceJson: jsonb("trace_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_remittance_run_items_org_idx").on(table.organizationId),
    runIdx: index("employer_remittance_run_items_run_idx").on(table.remittanceRunId),
    groupIdx: index("employer_remittance_run_items_group_idx").on(table.groupKey),
  }),
);

export type EmployerRemittanceRun = typeof employerRemittanceRuns.$inferSelect;
export type EmployerRemittanceRunItem = typeof employerRemittanceRunItems.$inferSelect;
export type EmployerRemittanceSubmission = typeof employerRemittanceSubmissions.$inferSelect;

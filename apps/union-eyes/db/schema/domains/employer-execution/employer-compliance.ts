import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { employerPayrollRuns } from "./employer-payroll-runs";
import { employerRemittanceRuns } from "./employer-remittance-runs";

export const employerExecutionComplianceSeverityEnum = pgEnum(
  "employer_execution_compliance_severity",
  ["info", "warning", "error", "critical"],
);

export const employerExecutionComplianceStatusEnum = pgEnum(
  "employer_execution_compliance_status",
  ["open", "acknowledged", "resolved", "waived"],
);

export const employerExecutionComplianceBlockingEnum = pgEnum(
  "employer_execution_compliance_blocking",
  ["yes", "no"],
);

export const employerExecutionComplianceEvents = pgTable(
  "employer_execution_compliance_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    payrollRunId: uuid("payroll_run_id").references(() => employerPayrollRuns.id, {
      onDelete: "set null",
    }),
    remittanceRunId: uuid("remittance_run_id").references(() => employerRemittanceRuns.id, {
      onDelete: "set null",
    }),
    eventCode: varchar("event_code", { length: 120 }).notNull(),
    severity: employerExecutionComplianceSeverityEnum("severity").notNull().default("warning"),
    status: employerExecutionComplianceStatusEnum("status").notNull().default("open"),
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    blocking: employerExecutionComplianceBlockingEnum("blocking").notNull().default("no"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_execution_compliance_events_org_idx").on(table.organizationId),
    runIdx: index("employer_execution_compliance_events_run_idx").on(table.payrollRunId),
    remittanceIdx: index("employer_execution_compliance_events_remit_idx").on(table.remittanceRunId),
    severityIdx: index("employer_execution_compliance_events_severity_idx").on(table.severity),
    statusIdx: index("employer_execution_compliance_events_status_idx").on(table.status),
  }),
);

export type EmployerExecutionComplianceEvent = typeof employerExecutionComplianceEvents.$inferSelect;

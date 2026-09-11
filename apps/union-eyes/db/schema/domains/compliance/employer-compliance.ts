/**
 * Employer Compliance Schema
 *
 * Tracks employers, compliance reports, and automated alerts
 * for the Employer Compliance Dashboard.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// Canonical `employers` declaration lives in ../../union-structure-schema
// (live-DB-verified 2026-09-01: 33 columns). This file's own 8-column
// declaration used org_id/industry/contactEmail/contactPhone field names
// that do not physically exist at all — re-exported here instead of
// re-declared (PR #752 review round 3), keeping complianceAlerts/
// employerReports' `.references(() => employers.id)` pointed at the one
// real physical relation.
import { employers } from "../../union-structure-schema";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const complianceAlertSeverityEnum = pgEnum(
  "compliance_alert_severity",
  ["low", "medium", "high", "critical"],
);

export const complianceAlertTypeEnum = pgEnum("compliance_alert_type", [
  "contract_violation",
  "safety_violation",
  "dispatch_non_compliance",
  "reporting_overdue",
  "grievance_spike",
  "dues_non_remittance",
]);

export const complianceReportTypeEnum = pgEnum("compliance_report_type", [
  "quarterly_review",
  "annual_audit",
  "incident_report",
  "dispatch_fulfillment",
  "grievance_summary",
  "safety_inspection",
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export { employers };

/**
 * Periodic compliance reports for an employer.
 */
export const employerReports = pgTable(
  "employer_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    reportType: complianceReportTypeEnum("report_type").notNull(),
    dataJson: jsonb("data_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_employer_reports_employer").on(table.employerId),
    index("idx_employer_reports_type").on(table.reportType),
    index("idx_employer_reports_created").on(table.createdAt),
  ],
);

/**
 * Automated compliance alerts when thresholds are breached.
 */
export const complianceAlerts = pgTable(
  "compliance_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "cascade" }),
    alertType: complianceAlertTypeEnum("alert_type").notNull(),
    severity: complianceAlertSeverityEnum("severity").notNull(),
    message: text("message"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_compliance_alerts_org").on(table.orgId),
    index("idx_compliance_alerts_employer").on(table.employerId),
    index("idx_compliance_alerts_severity").on(table.severity),
    index("idx_compliance_alerts_type").on(table.alertType),
    index("idx_compliance_alerts_created").on(table.createdAt),
  ],
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type ComplianceAlertSeverity =
  (typeof complianceAlertSeverityEnum.enumValues)[number];
export type ComplianceAlertType =
  (typeof complianceAlertTypeEnum.enumValues)[number];
export type ComplianceReportType =
  (typeof complianceReportTypeEnum.enumValues)[number];

export type Employer = typeof employers.$inferSelect;
export type EmployerInsert = typeof employers.$inferInsert;
export type EmployerReport = typeof employerReports.$inferSelect;
export type EmployerReportInsert = typeof employerReports.$inferInsert;
export type ComplianceAlert = typeof complianceAlerts.$inferSelect;
export type ComplianceAlertInsert = typeof complianceAlerts.$inferInsert;

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

export const employerExecutionArtifactTypeEnum = pgEnum("employer_execution_artifact_type", [
  "payroll_snapshot",
  "payroll_trace",
  "remittance_csv",
  "remittance_json",
  "summary",
  "evidence_manifest",
  "evidence_seal",
  "replay_diff",
]);

export const employerExecutionReplayModeEnum = pgEnum("employer_execution_replay_mode", [
  "exact",
  "simulated",
]);

export const employerExecutionArtifacts = pgTable(
  "employer_execution_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    payrollRunId: uuid("payroll_run_id").references(() => employerPayrollRuns.id, {
      onDelete: "set null",
    }),
    remittanceRunId: uuid("remittance_run_id").references(() => employerRemittanceRuns.id, {
      onDelete: "set null",
    }),
    artifactType: employerExecutionArtifactTypeEnum("artifact_type").notNull(),
    artifactName: varchar("artifact_name", { length: 255 }).notNull(),
    storageRef: text("storage_ref").notNull(),
    artifactHash: varchar("artifact_hash", { length: 64 }).notNull(),
    manifestJson: jsonb("manifest_json").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_execution_artifacts_org_idx").on(table.organizationId),
    payrollRunIdx: index("employer_execution_artifacts_payroll_idx").on(table.payrollRunId),
    remittanceRunIdx: index("employer_execution_artifacts_remittance_idx").on(table.remittanceRunId),
    artifactTypeIdx: index("employer_execution_artifacts_type_idx").on(table.artifactType),
  }),
);

export const employerExecutionReplays = pgTable(
  "employer_execution_replays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    sourcePayrollRunId: uuid("source_payroll_run_id")
      .notNull()
      .references(() => employerPayrollRuns.id, { onDelete: "cascade" }),
    replayPayrollRunId: uuid("replay_payroll_run_id").references(() => employerPayrollRuns.id, {
      onDelete: "set null",
    }),
    mode: employerExecutionReplayModeEnum("mode").notNull().default("exact"),
    sourceEngineVersion: varchar("source_engine_version", { length: 100 }).notNull(),
    replayEngineVersion: varchar("replay_engine_version", { length: 100 }).notNull(),
    diffJson: jsonb("diff_json").$type<Record<string, unknown>>().notNull().default({}),
    diffSummary: text("diff_summary"),
    diffHash: varchar("diff_hash", { length: 64 }).notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_execution_replays_org_idx").on(table.organizationId),
    sourceRunIdx: index("employer_execution_replays_source_run_idx").on(table.sourcePayrollRunId),
    replayRunIdx: index("employer_execution_replays_replay_run_idx").on(table.replayPayrollRunId),
    modeIdx: index("employer_execution_replays_mode_idx").on(table.mode),
  }),
);

export type EmployerExecutionArtifact = typeof employerExecutionArtifacts.$inferSelect;
export type EmployerExecutionReplay = typeof employerExecutionReplays.$inferSelect;

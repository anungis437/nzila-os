import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { collectiveAgreements } from "../agreements/collective-agreements";
import { employers, worksites, bargainingUnits } from "../../union-structure-schema";
import { employerExecutionProfiles } from "./employer-runtime-profile";

export const cbaRuleVersionStatusEnum = pgEnum("cba_rule_version_status", [
  "draft",
  "active",
  "retired",
  "superseded",
]);

export const cbaRuleSetItemTypeEnum = pgEnum("cba_rule_set_item_type", [
  "base_rate",
  "overtime",
  "doubletime",
  "premium",
  "travel",
  "dues",
  "benefit",
  "pension",
  "compliance",
]);

export const cbaRuleVersions = pgTable(
  "cba_rule_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => employerExecutionProfiles.id, { onDelete: "cascade" }),
    collectiveAgreementId: uuid("collective_agreement_id").references(() => collectiveAgreements.id, {
      onDelete: "set null",
    }),
    employerId: uuid("employer_id").references(() => employers.id, { onDelete: "set null" }),
    worksiteId: uuid("worksite_id").references(() => worksites.id, { onDelete: "set null" }),
    bargainingUnitId: uuid("bargaining_unit_id").references(() => bargainingUnits.id, {
      onDelete: "set null",
    }),
    ruleVersionCode: varchar("rule_version_code", { length: 120 }).notNull(),
    status: cbaRuleVersionStatusEnum("status").notNull().default("draft"),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    sourceHash: varchar("source_hash", { length: 64 }).notNull(),
    sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>().notNull().default({}),
    rulesJson: jsonb("rules_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => ({
    orgIdx: index("cba_rule_versions_org_idx").on(table.organizationId),
    profileIdx: index("cba_rule_versions_profile_idx").on(table.profileId),
    agreementIdx: index("cba_rule_versions_agreement_idx").on(table.collectiveAgreementId),
    effectiveIdx: index("cba_rule_versions_effective_idx").on(table.effectiveFrom, table.effectiveTo),
    orgCodeUniqueIdx: uniqueIndex("cba_rule_versions_org_code_idx").on(
      table.organizationId,
      table.ruleVersionCode,
    ),
  }),
);

export const cbaRuleSetItems = pgTable(
  "cba_rule_set_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    cbaRuleVersionId: uuid("cba_rule_version_id")
      .notNull()
      .references(() => cbaRuleVersions.id, { onDelete: "cascade" }),
    itemType: cbaRuleSetItemTypeEnum("item_type").notNull(),
    ruleCode: varchar("rule_code", { length: 120 }).notNull(),
    precedence: integer("precedence").notNull().default(0),
    classificationCode: varchar("classification_code", { length: 120 }),
    worksiteCode: varchar("worksite_code", { length: 120 }),
    regionCode: varchar("region_code", { length: 50 }),
    conditionJson: jsonb("condition_json").$type<Record<string, unknown>>().notNull().default({}),
    actionJson: jsonb("action_json").$type<Record<string, unknown>>().notNull().default({}),
    ruleHash: varchar("rule_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("cba_rule_set_items_org_idx").on(table.organizationId),
    versionIdx: index("cba_rule_set_items_version_idx").on(table.cbaRuleVersionId),
    ruleCodeIdx: index("cba_rule_set_items_rule_code_idx").on(table.ruleCode),
    precedenceIdx: index("cba_rule_set_items_precedence_idx").on(table.precedence),
  }),
);

export type CbaRuleVersion = typeof cbaRuleVersions.$inferSelect;
export type NewCbaRuleVersion = typeof cbaRuleVersions.$inferInsert;
export type CbaRuleSetItem = typeof cbaRuleSetItems.$inferSelect;
export type NewCbaRuleSetItem = typeof cbaRuleSetItems.$inferInsert;

/**
 * Member Breaks Schema
 *
 * Models union break entitlements, scheduling, and compliance tracking.
 *
 * Break provisions are typically defined in CBA clauses (hours_scheduling,
 * working_conditions) and vary by shift type, job classification, and
 * bargaining unit. This schema captures:
 *
 * - Break policies (CBA-derived rules per org/bargaining unit)
 * - Scheduled/actual break records per member per shift
 * - Compliance tracking (was the break taken? denied? shortened?)
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  date,
  jsonb,
  index,
  time,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../../../schema-organizations";
import { organizationMembers } from "../../../schema-organizations";
import { memberEmployment } from "./member-employment";

// =============================================================================
// ENUMS
// =============================================================================

/** Type of break */
export const breakTypeEnum = pgEnum("break_type", [
  "meal",            // Meal / lunch break (typically 30-60 min)
  "rest",            // Rest period (typically 10-15 min)
  "union",           // Union business break (steward duties, meetings)
  "nursing",         // Nursing / lactation break
  "prayer",          // Religious observance
  "health",          // Medical / health accommodation break
  "other",
]);

/** Whether the break is paid or unpaid */
export const breakCompensationEnum = pgEnum("break_compensation", [
  "paid",
  "unpaid",
]);

/** Outcome status of a specific break occurrence */
export const breakStatusEnum = pgEnum("break_status", [
  "scheduled",       // Break is on the schedule, not yet taken
  "taken",           // Break was taken as planned
  "shortened",       // Break was taken but cut short
  "missed",          // Break was not taken (member choice or operational)
  "denied",          // Employer denied the break
  "deferred",        // Break moved to a different time in the shift
]);

// =============================================================================
// BREAK POLICIES (CBA-derived rules)
// =============================================================================

/**
 * Break policies define what breaks members are entitled to under
 * a particular CBA or workplace rule. One policy per break type per org
 * (or per bargaining unit / shift type for more granular rules).
 */
export const breakPolicies = pgTable("break_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),

  name: varchar("name", { length: 255 }).notNull(),
  breakType: breakTypeEnum("break_type").notNull(),
  compensation: breakCompensationEnum("compensation").notNull(),

  /** Duration in minutes */
  durationMinutes: integer("duration_minutes").notNull(),
  /** How often per shift — e.g. 1 meal + 2 rest */
  frequencyPerShift: integer("frequency_per_shift").notNull().default(1),

  /** Minimum hours worked before this break is required */
  minHoursForEligibility: integer("min_hours_for_eligibility"),
  /** Max hours between breaks of this type */
  maxHoursBetween: integer("max_hours_between"),

  /** Optional: restrict to a specific shift type */
  applicableShiftType: varchar("applicable_shift_type", { length: 50 }),

  /** CBA clause reference (free-text like "Article 12.3") */
  cbaClauseRef: varchar("cba_clause_ref", { length: 255 }),

  /** Extra rules or notes stored as JSON */
  metadata: jsonb("metadata"),
  notes: text("notes"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
}, (table) => ({
  orgIdx: index("idx_break_policies_org").on(table.organizationId),
  typeIdx: index("idx_break_policies_type").on(table.breakType),
  activeIdx: index("idx_break_policies_active").on(table.isActive),
}));

// =============================================================================
// MEMBER BREAK RECORDS (per-shift / per-day occurrences)
// =============================================================================

/**
 * Records an individual break occurrence for a member on a given work day.
 * Linked to the governing policy and the member's employment record.
 */
export const memberBreaks = pgTable("member_breaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  memberId: uuid("member_id").notNull().references(() => organizationMembers.id),
  memberEmploymentId: uuid("member_employment_id").references(() => memberEmployment.id),

  /** Which policy governs this break */
  breakPolicyId: uuid("break_policy_id").references(() => breakPolicies.id),

  breakType: breakTypeEnum("break_type").notNull(),
  status: breakStatusEnum("break_status").notNull().default("scheduled"),
  compensation: breakCompensationEnum("compensation"),

  /** The work date this break belongs to */
  workDate: date("work_date").notNull(),

  /** Scheduled window */
  scheduledStart: time("scheduled_start"),
  scheduledEnd: time("scheduled_end"),
  scheduledDurationMinutes: integer("scheduled_duration_minutes"),

  /** Actual window (filled in after the fact) */
  actualStart: time("actual_start"),
  actualEnd: time("actual_end"),
  actualDurationMinutes: integer("actual_duration_minutes"),

  /** If denied or shortened — who and why */
  deniedBy: varchar("denied_by", { length: 255 }),
  denialReason: text("denial_reason"),

  /** Member or supervisor notes */
  notes: text("notes"),

  /** Flag for compliance review */
  complianceFlag: boolean("compliance_flag").default(false),
  complianceFlagReason: text("compliance_flag_reason"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar("created_by", { length: 255 }),
}, (table) => ({
  memberIdx: index("idx_member_breaks_member").on(table.memberId),
  orgIdx: index("idx_member_breaks_org").on(table.organizationId),
  workDateIdx: index("idx_member_breaks_work_date").on(table.workDate),
  statusIdx: index("idx_member_breaks_status").on(table.status),
  policyIdx: index("idx_member_breaks_policy").on(table.breakPolicyId),
  complianceIdx: index("idx_member_breaks_compliance").on(table.complianceFlag),
}));

// =============================================================================
// RELATIONS
// =============================================================================

export const breakPoliciesRelations = relations(breakPolicies, ({ one }) => ({
  organization: one(organizations, {
    fields: [breakPolicies.organizationId],
    references: [organizations.id],
  }),
}));

export const memberBreaksRelations = relations(memberBreaks, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberBreaks.organizationId],
    references: [organizations.id],
  }),
  member: one(organizationMembers, {
    fields: [memberBreaks.memberId],
    references: [organizationMembers.id],
  }),
  employment: one(memberEmployment, {
    fields: [memberBreaks.memberEmploymentId],
    references: [memberEmployment.id],
  }),
  policy: one(breakPolicies, {
    fields: [memberBreaks.breakPolicyId],
    references: [breakPolicies.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type BreakPolicy = typeof breakPolicies.$inferSelect;
export type NewBreakPolicy = typeof breakPolicies.$inferInsert;
export type MemberBreak = typeof memberBreaks.$inferSelect;
export type NewMemberBreak = typeof memberBreaks.$inferInsert;
export type BreakType = (typeof breakTypeEnum.enumValues)[number];
export type BreakStatus = (typeof breakStatusEnum.enumValues)[number];
export type BreakCompensation = (typeof breakCompensationEnum.enumValues)[number];

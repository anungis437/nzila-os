/**
 * Steward Management Schema
 *
 * Tracks steward profiles, specializations, regions, and
 * automated case assignments for the Steward Workflow Engine.
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";

// Canonical `stewardAssignments` declaration lives in ../../union-structure-schema
// (live-DB-verified 2026-09-01: 33 columns, including organization_id). This
// file's own 6-column declaration lacked organization_id entirely, which
// meant any insert built against it silently created tenant-orphaned rows
// (PR #752 review round 3) — re-exported here instead of re-declared.
import { stewardAssignments } from "../../union-structure-schema";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const stewardAssignmentStatusEnum = pgEnum(
  "steward_assignment_status",
  ["pending", "accepted", "active", "completed", "declined", "reassigned"],
);

// ─── Tables ──────────────────────────────────────────────────────────────────

/**
 * Steward profiles linked to org users.
 * Tracks region, specialization, and availability for assignment.
 */
export const stewards = pgTable(
  "stewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull(),
    region: varchar("region", { length: 255 }),
    specialization: varchar("specialization", { length: 255 }),
    active: boolean("active").notNull().default(true),
    maxCaseload: integer("max_caseload").notNull().default(10),
    currentCaseload: integer("current_caseload").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_stewards_org").on(table.orgId),
    index("idx_stewards_user").on(table.userId),
    index("idx_stewards_region").on(table.region),
    index("idx_stewards_specialization").on(table.specialization),
    index("idx_stewards_active").on(table.active),
  ],
);

export { stewardAssignments };

// ─── Types ───────────────────────────────────────────────────────────────────

export type StewardAssignmentStatus =
  (typeof stewardAssignmentStatusEnum.enumValues)[number];

export type Steward = typeof stewards.$inferSelect;
export type StewardInsert = typeof stewards.$inferInsert;
export type StewardAssignment = typeof stewardAssignments.$inferSelect;
export type StewardAssignmentInsert = typeof stewardAssignments.$inferInsert;

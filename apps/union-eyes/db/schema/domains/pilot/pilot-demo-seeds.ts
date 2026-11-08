/**
 * Pilot Demo Seeds Schema
 *
 * Tracks which organisations have had demo data seeded,
 * enabling idempotent seed / purge operations.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const pilotDemoSeeds = pgTable(
  "pilot_demo_seeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    seededBy: varchar("seeded_by", { length: 255 }),
    seededAt: timestamp("seeded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    memberCount: integer("member_count").notNull().default(0),
    employerCount: integer("employer_count").notNull().default(0),
    grievanceCount: integer("grievance_count").notNull().default(0),
    // The exact row ids this seed inserted, captured at seed time (generateDemoEmployers/generateDemoGrievances
    // already assign the id client-side before insert). Purge deletes by this list, not by name/email pattern,
    // so it removes only what this seed created. Null on rows seeded before this column existed.
    employerIds: text("employer_ids").array(),
    grievanceIds: text("grievance_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_pilot_demo_seeds_org").on(table.organizationId),
  ],
);

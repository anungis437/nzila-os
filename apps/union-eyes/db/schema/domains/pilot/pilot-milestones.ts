/**
 * Pilot Milestones Schema
 *
 * Tracks pilot program milestones per organization.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const pilotMilestones = pgTable(
  "pilot_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull().default(""),
    status: varchar("status", { length: 50 })
      .notNull()
      .default("pending"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pilot_milestones_org").on(table.organizationId),
  ],
);

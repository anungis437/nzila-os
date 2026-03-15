/**
 * Pilot Enrollment Schema
 *
 * Tracks which organizations are enrolled in the pilot program,
 * their enrollment date, and program status.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  real,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const pilotEnrollments = pgTable(
  "pilot_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    pilotId: varchar("pilot_id", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    enrolledBy: varchar("enrolled_by", { length: 255 }),
    organizerAdoptionRate: real("organizer_adoption_rate").notNull().default(0),
    memberEngagementRate: real("member_engagement_rate").notNull().default(0),
    casesManaged: integer("cases_managed").notNull().default(0),
    avgTimeToResolution: real("avg_time_to_resolution").notNull().default(0),
    healthScore: real("health_score").notNull().default(0),
    lastCalculatedAt: timestamp("last_calculated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_pilot_enrollments_org").on(table.organizationId),
  ],
);

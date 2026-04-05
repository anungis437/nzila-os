/**
 * Pilot Feedback Schema
 *
 * Lightweight in-app feedback capture triggered after first case
 * and after 3–5 uses. Categories: confusing, slow, unnecessary_steps, missing_feature.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const pilotFeedback = pgTable(
  "pilot_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    /** 1–5 ease-of-use rating (1 = very hard, 5 = very easy) */
    easeRating: integer("ease_rating").notNull(),
    /** Optional categories: confusing | slow | unnecessary_steps | missing_feature */
    category: varchar("category", { length: 50 }),
    /** Free-text comment (optional) */
    comment: text("comment"),
    /** What triggered the prompt: first_case | milestone_usage */
    trigger: varchar("trigger", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pilot_feedback_org").on(table.organizationId),
    index("idx_pilot_feedback_user").on(table.userId),
    index("idx_pilot_feedback_created").on(table.createdAt),
  ],
);

export type PilotFeedbackRecord = typeof pilotFeedback.$inferSelect;
export type NewPilotFeedback = typeof pilotFeedback.$inferInsert;

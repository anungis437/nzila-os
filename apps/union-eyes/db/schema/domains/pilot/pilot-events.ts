/**
 * Pilot Events Schema
 *
 * Lightweight event tracking for pilot usage observability.
 * Tracks user actions to derive engagement metrics and detect friction.
 *
 * Events: user_login, session_started, session_ended, first_case_created,
 *         case_created, first_update_added, update_added, case_viewed
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const pilotEvents = pgTable(
  "pilot_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pilot_events_org").on(table.organizationId),
    index("idx_pilot_events_user").on(table.userId),
    index("idx_pilot_events_type").on(table.eventType),
    index("idx_pilot_events_session").on(table.sessionId),
    index("idx_pilot_events_created").on(table.createdAt),
  ],
);

export type PilotEvent = typeof pilotEvents.$inferSelect;
export type NewPilotEvent = typeof pilotEvents.$inferInsert;

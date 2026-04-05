import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

/**
 * User UUID Mapping Table
 * Maps Clerk's text-based userId to internal UUID for foreign key relationships
 */
export const userUuidMapping = pgTable(
  "user_uuid_mapping",
  {
    userUuid: uuid("user_uuid").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    entraOid: text("entra_oid"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    clerkUserIdIdx: index("idx_user_uuid_mapping_clerk_id").on(table.clerkUserId),
  })
);

export type UserUuidMapping = typeof userUuidMapping.$inferSelect;
export type NewUserUuidMapping = typeof userUuidMapping.$inferInsert;


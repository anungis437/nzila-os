import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

/**
 * User UUID Mapping Table
 * Maps auth provider user IDs to internal UUIDs for foreign key relationships.
 * Supports both legacy Clerk IDs (clerk_user_id) and Entra Object IDs (entra_oid).
 */
export const userUuidMapping = pgTable(
  "user_uuid_mapping",
  {
    userUuid: uuid("user_uuid").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    entraOid: text("entra_oid"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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


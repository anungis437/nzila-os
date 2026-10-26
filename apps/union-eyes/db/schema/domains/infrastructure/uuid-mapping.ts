import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

/**
 * User UUID Mapping Table
 * Maps auth provider user IDs to internal UUIDs for foreign key relationships.
 * Stores the provider user ID (authUserId) and the Entra Object ID (entra_oid).
 * The physical column keeps its historical name (clerk_user_id); renaming it requires a governed data migration.
 */
export const userUuidMapping = pgTable(
  "user_uuid_mapping",
  {
    userUuid: uuid("user_uuid").defaultRandom().primaryKey(),
    authUserId: text("clerk_user_id").notNull().unique(),
    entraOid: text("entra_oid"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    authUserIdIdx: index("idx_user_uuid_mapping_clerk_id").on(table.authUserId),
  })
);

export type UserUuidMapping = typeof userUuidMapping.$inferSelect;
export type NewUserUuidMapping = typeof userUuidMapping.$inferInsert;


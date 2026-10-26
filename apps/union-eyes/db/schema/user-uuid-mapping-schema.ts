import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";

/**
 * User UUID Mapping Table
 * Maps the auth provider's text-based userId to an internal UUID for foreign key relationships.
 * The physical column keeps its historical name (clerk_user_id); renaming it requires a governed data migration.
 */
export const userUuidMapping = pgTable(
  "user_uuid_mapping",
  {
    userUuid: uuid("user_uuid").defaultRandom().primaryKey(),
    authUserId: text("clerk_user_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    entraOid: text("entra_oid"),
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


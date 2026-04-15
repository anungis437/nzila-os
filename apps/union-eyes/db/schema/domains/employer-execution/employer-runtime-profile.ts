import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "../../../schema-organizations";

export const employerExecutionProfileStatusEnum = pgEnum("employer_execution_profile_status", [
  "draft",
  "active",
  "suspended",
  "archived",
]);

export const employerExecutionProfiles = pgTable(
  "employer_execution_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    profileCode: varchar("profile_code", { length: 100 }).notNull(),
    status: employerExecutionProfileStatusEnum("status").notNull().default("draft"),
    jurisdiction: varchar("jurisdiction", { length: 50 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CAD"),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdx: index("employer_execution_profiles_org_idx").on(table.organizationId),
    statusIdx: index("employer_execution_profiles_status_idx").on(table.status),
    orgProfileUniqueIdx: uniqueIndex("employer_execution_profiles_org_profile_idx").on(
      table.organizationId,
      table.profileCode,
    ),
  }),
);

export type EmployerExecutionProfile = typeof employerExecutionProfiles.$inferSelect;
export type NewEmployerExecutionProfile = typeof employerExecutionProfiles.$inferInsert;

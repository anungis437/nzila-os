import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const governancePolicies = pgTable("governance_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  category: varchar("category", { length: 50 }).notNull().default("hr"),
  description: text("description"),
  content: text("content"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  updatedBy: varchar("updated_by", { length: 255 }),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

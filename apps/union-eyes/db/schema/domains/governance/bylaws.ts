import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const bylawStatusEnum = ['active', 'proposed', 'archived'] as const;

export const bylaws = pgTable("governance_bylaws", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  article: varchar("article", { length: 100 }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

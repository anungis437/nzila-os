import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const signatories = pgTable("governance_signatories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  authority: varchar("authority", { length: 50 }).notNull().default("limited"),
  activeFrom: timestamp("active_from", { withTimezone: true }).notNull(),
  activeTo: timestamp("active_to", { withTimezone: true }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  documents: jsonb("documents").default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

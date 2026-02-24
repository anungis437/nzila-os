import { pgTable, text, timestamp, uuid, varchar, pgEnum, boolean } from "drizzle-orm/pg-core";
import { organizations } from "../schema-organizations";

// Enums
export const memberCategoryEnum = pgEnum("member_category", [
  "full_member",
  "associate",
  "honorary",
  "retired",
]);

// Organization Members table
export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(), // Changed from varchar to text to match database
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  
  // Role & Status
  role: text("role").notNull(),
  status: text("status").notNull(),
  
  // Member Info
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  department: text("department"),
  
  // Union Info
  membershipNumber: text("membership_number"),
  
  // Membership Details
  isPrimary: boolean("is_primary"),
  memberCategory: memberCategoryEnum("member_category"),
  exemptFromPerCapita: boolean("exempt_from_per_capita"),
  exemptionReason: text("exemption_reason"),
  exemptionApprovedBy: varchar("exemption_approved_by", { length: 255 }),
  exemptionApprovedAt: timestamp("exemption_approved_at", { withTimezone: true }),
  
  // Full-text search
  searchVector: text("search_vector"),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type SelectOrganizationMember = typeof organizationMembers.$inferSelect;


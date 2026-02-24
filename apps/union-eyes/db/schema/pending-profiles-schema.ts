import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { paymentProviderEnum, membershipEnum } from "./profiles-schema";

export const pendingProfilesTable = pgTable("pending_profiles", {
  id: text("id").primaryKey().notNull(), // UUID or generated ID
  email: text("email").notNull().unique(), // User's email address - unique constraint
  token: text("token"), // Verification token from checkout
  
  // Payment details
  membership: membershipEnum("membership").notNull().default("pro"),
  paymentProvider: paymentProviderEnum("payment_provider").default("whop"),
  
  // Whop specific fields
  whopUserId: text("whop_user_id"),
  whopMembershipId: text("whop_membership_id"),
  
  // Plan details
  planDuration: text("plan_duration"), // "monthly" or "yearly"
  billingCycleStart: timestamp("billing_cycle_start"),
  billingCycleEnd: timestamp("billing_cycle_end"),
  nextCreditRenewal: timestamp("next_credit_renewal"),
  
  // Credits information
  usageCredits: integer("usage_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  
  // Claiming status
  claimed: boolean("claimed").default(false),
  claimedByUserId: text("claimed_by_user_id"),
  claimedAt: timestamp("claimed_at"),
  
  // Standard timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
});

export type InsertPendingProfile = typeof pendingProfilesTable.$inferInsert;
export type SelectPendingProfile = typeof pendingProfilesTable.$inferSelect; 

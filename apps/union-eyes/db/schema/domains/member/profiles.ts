import { pgEnum, pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const membershipEnum = pgEnum("membership", ["free", "pro"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "whop"]);

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  email: text("email"),
  membership: membershipEnum("membership").notNull().default("free"),
  paymentProvider: paymentProviderEnum("payment_provider").default("whop"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  whopUserId: text("whop_user_id"),
  whopMembershipId: text("whop_membership_id"),
  planDuration: text("plan_duration"), // "monthly" or "yearly"
  // Billing cycle tracking
  billingCycleStart: timestamp("billing_cycle_start"),
  billingCycleEnd: timestamp("billing_cycle_end"),
  // Credit renewal tracking (separate from billing cycle for yearly plans)
  nextCreditRenewal: timestamp("next_credit_renewal"),
  // Usage credits tracking
  usageCredits: integer("usage_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  // Subscription status tracking
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
}, (table) => {
  return {
    // Enable RLS on this table
    // NOTE: Uses plain PostgreSQL current_setting('app.current_user_id'), NOT Supabase auth.uid()
    // The withRLSContext() helper sets this via: SET LOCAL app.current_user_id = '<userId>'
    rls: sql`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,

    // 1. Allow users to read only their own profile
    readPolicy: sql`
      CREATE POLICY "Users can only view their own profile"
      ON ${table}
      FOR SELECT
      USING (current_setting('app.current_user_id', true) = user_id);
    `,

    // 2. Allow server-side inserts (app never inserts from untrusted client context)
    insertPolicy: sql`
      CREATE POLICY "Allow server-side inserts"
      ON ${table}
      FOR INSERT
      WITH CHECK (true);
    `,

    // 3. Allow users to update only their own profile
    updatePolicy: sql`
      CREATE POLICY "Users can only update their own profile"
      ON ${table}
      FOR UPDATE
      USING (current_setting('app.current_user_id', true) = user_id);
    `,

    // 4. Block direct deletes (admin-only via service connection)
    deletePolicy: sql`
      CREATE POLICY "Block direct client deletes"
      ON ${table}
      FOR DELETE
      USING (false);
    `,
  };
});

// Export alias for backwards compatibility
export const profiles = profilesTable;

export type InsertProfile = typeof profilesTable.$inferInsert;
export type SelectProfile = typeof profilesTable.$inferSelect;


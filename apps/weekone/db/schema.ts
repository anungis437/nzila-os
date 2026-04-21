import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";

export const weekoneUsers = pgTable("weekone_users", {
  id: serial("id").primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const weekoneOrganizations = pgTable("weekone_organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["saas", "agency", "studio", "ecommerce", "services", "other"],
  }).notNull(),
  revenueStage: text("revenue_stage"),
  teamSize: integer("team_size"),
  mainPain: text("main_pain"),
  ownerId: integer("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const weekoneSubscriptions = pgTable("weekone_subscriptions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  plan: text("plan", { enum: ["solo", "team", "growth"] }).notNull(),
  status: text("status").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weekoneCashSnapshots = pgTable("weekone_cash_snapshots", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  cashOnHand: integer("cash_on_hand").notNull(),
  monthlyBurn: integer("monthly_burn").notNull(),
  runwayDays: integer("runway_days").notNull(),
  overdueInvoices: integer("overdue_invoices").default(0).notNull(),
  upcomingBills: integer("upcoming_bills").default(0).notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weekoneInvoices = pgTable("weekone_invoices", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  clientName: text("client_name").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("USD").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status", {
    enum: ["draft", "sent", "overdue", "paid"],
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const weekoneDeals = pgTable("weekone_deals", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  name: text("name").notNull(),
  value: integer("value").notNull(),
  stage: text("stage").notNull(),
  probability: integer("probability").default(50).notNull(),
  expectedCloseDate: timestamp("expected_close_date"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const weekoneWeeklyBriefs = pgTable("weekone_weekly_briefs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  summary: text("summary").notNull(),
  priorities: jsonb("priorities").notNull(),
  moneyWatch: text("money_watch").notNull(),
  pipelineWatch: text("pipeline_watch").notNull(),
  riskWatch: text("risk_watch").notNull(),
  founderRecommendation: text("founder_recommendation").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weekonePriorities = pgTable("weekone_priorities", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  rank: integer("rank").notNull(),
  category: text("category", {
    enum: ["revenue", "risk", "delegation", "stop"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weekoneRecommendations = pgTable("weekone_recommendations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  type: text("type", {
    enum: ["focus", "risk", "opportunity", "overload", "ignore"],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  severity: text("severity"),
  dismissed: boolean("dismissed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weekoneIntegrations = pgTable("weekone_integrations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull(),
  provider: text("provider", {
    enum: ["stripe", "quickbooks", "hubspot", "pipedrive", "manual"],
  }).notNull(),
  status: text("status").notNull(),
  config: jsonb("config"),
  connectedAt: timestamp("connected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

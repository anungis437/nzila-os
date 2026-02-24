/**
 * Platform Subscription Events Table
 * 
 * Tracks all subscription-related events for MRR/ARR calculation,
 * churn analysis, and revenue cohort tracking.
 * 
 * Events tracked:
 * - subscription_started
 * - subscription_upgraded
 * - subscription_downgraded
 * - subscription_cancelled
 * - subscription_reactivated
 * - subscription_paused
 * - subscription_resumed
 * - subscription_expired
 * - billing_cycle_changed
 * - payment_failed
 * - payment_succeeded
 */

import { pgTable, uuid, varchar, timestamp, numeric, text, index, integer } from 'drizzle-orm/pg-core';

export const subscriptionEvents = pgTable('subscription_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Organization (tenant)
  organizationId: uuid('organization_id').notNull(),
  
  // Event details
  eventType: varchar('event_type', { 
    length: 50 
  }).notNull().default('subscription_started'),
  // Types: subscription_started, subscription_upgraded, subscription_downgraded, 
  // subscription_cancelled, subscription_reactivated, subscription_paused, 
  // subscription_resumed, subscription_expired, billing_cycle_changed,
  // payment_failed, payment_succeeded
  
  eventDate: timestamp('event_date', { withTimezone: true, mode: 'string' }).notNull(),
  
  // Subscription details
  planId: varchar('plan_id', { length: 100 }),
  planName: varchar('plan_name', { length: 100 }),
  planTier: varchar('plan_tier', { length: 50 }), // free, starter, pro, enterprise
  
  // Pricing (monthly amounts in USD)
  monthlyAmount: numeric('monthly_amount', { precision: 10, scale: 2 }).default('0'),
  annualAmount: numeric('annual_amount', { precision: 10, scale: 2 }).default('0'),
  
  // Billing cycle
  billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly'), // monthly, yearly
  
  // Previous values (for upgrades/downgrades)
  previousPlanId: varchar('previous_plan_id', { length: 100 }),
  previousMonthlyAmount: numeric('previous_monthly_amount', { precision: 10, scale: 2 }).default('0'),
  previousAnnualAmount: numeric('previous_annual_amount', { precision: 10, scale: 2 }).default('0'),
  
  // MRR impact (change in monthly recurring revenue)
  mrrChange: numeric('mrr_change', { precision: 10, scale: 2 }).default('0'),
  
  // Source
  source: varchar('source', { length: 50 }).default('stripe'), // stripe, whop, manual, system
  sourceEventId: varchar('source_event_id', { length: 255 }), // Stripe subscription ID, etc.
  
  // Attribution (for CAC calculation)
  attributionSource: varchar('attribution_source', { length: 100 }),
  attributionCampaign: varchar('attribution_campaign', { length: 100 }),
  attributionChannel: varchar('attribution_channel', { length: 50 }),
  
  // Payment details (for failed payments)
  paymentAmount: numeric('payment_amount', { precision: 10, scale: 2 }),
  paymentStatus: varchar('payment_status', { length: 20 }),
  failureReason: text('failure_reason'),
  
  // Metadata
  metadata: text('metadata'), // JSON string for additional data
  
  // System fields
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true, mode: 'string' }),
},
(table) => {
  return {
    idxSubscriptionEventsOrg: index('idx_sub_events_org').using('btree', table.organizationId.asc()),
    idxSubscriptionEventsDate: index('idx_sub_events_date').using('btree', table.eventDate.asc()),
    idxSubscriptionEventsType: index('idx_sub_events_type').using('btree', table.eventType.asc()),
    idxSubscriptionEventsSource: index('idx_sub_events_source').using('btree', table.sourceEventId.asc()),
  };
});

// MRR Snapshot (monthly snapshots for historical tracking)
export const mrrSnapshots = pgTable('mrr_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Snapshot period
  snapshotDate: timestamp('snapshot_date', { withTimezone: true, mode: 'string' }).notNull(),
  snapshotMonth: integer('snapshot_month').notNull(), // 1-12
  snapshotYear: integer('snapshot_year').notNull(),
  
  // MRR breakdown
  totalMrr: numeric('total_mrr', { precision: 12, scale: 2 }).default('0'),
  newMrr: numeric('new_mrr', { precision: 12, scale: 2 }).default('0'), // From new subscriptions
  expansionMrr: numeric('expansion_mrr', { precision: 12, scale: 2 }).default('0'), // From upgrades
  contractionMrr: numeric('contraction_mrr', { precision: 12, scale: 2 }).default('0'), // From downgrades
  churnMrr: numeric('churn_mrr', { precision: 12, scale: 2 }).default('0'), // From cancellations
  reactivationMrr: numeric('reactivation_mrr', { precision: 12, scale: 2 }).default('0'), // From reactivations
  
  // Counts
  activeSubscriptions: integer('active_subscriptions').default(0),
  newSubscriptions: integer('new_subscriptions').default(0),
  upgradedSubscriptions: integer('upgraded_subscriptions').default(0),
  downgradedSubscriptions: integer('downgraded_subscriptions').default(0),
  cancelledSubscriptions: integer('cancelled_subscriptions').default(0),
  reactivatedSubscriptions: integer('reactivated_subscriptions').default(0),
  
  // Derived metrics
  grossMrr: numeric('gross_mrr', { precision: 12, scale: 2 }).default('0'), // Total before churn
  netMrr: numeric('net_mrr', { precision: 12, scale: 2 }).default('0'), // After churn
  mrrGrowthRate: numeric('mrr_growth_rate', { precision: 5, scale: 2 }).default('0'), // Percentage
  
  // ARR
  totalArr: numeric('total_arr', { precision: 12, scale: 2 }).default('0'),
  
  // Average values
  avgRevenuePerUser: numeric('arpu', { precision: 10, scale: 2 }).default('0'),
  
  // Metadata
  metadata: text('metadata'),
  
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    idxMrrSnapshotsPeriod: index('idx_mrr_snapshots_period').using('btree', table.snapshotYear.asc(), table.snapshotMonth.asc()),
  };
});

// Customer Acquisition Tracking
export const customerAcquisition = pgTable('customer_acquisition', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  organizationId: uuid('organization_id').notNull(),
  
  // Acquisition details
  acquisitionDate: timestamp('acquisition_date', { withTimezone: true, mode: 'string' }).notNull(),
  acquisitionSource: varchar('acquisition_source', { length: 100 }),
  acquisitionCampaign: varchar('acquisition_campaign', { length: 255 }),
  acquisitionChannel: varchar('acquisition_channel', { length: 50 }), // organic, paid, referral, partner
  
  // Costs
  marketingCost: numeric('marketing_cost', { precision: 10, scale: 2 }).default('0'),
  salesCost: numeric('sales_cost', { precision: 10, scale: 2 }).default('0'),
  totalAcquisitionCost: numeric('total_acquisition_cost', { precision: 10, scale: 2 }).default('0'), // CAC
  
  // Initial subscription
  initialPlan: varchar('initial_plan', { length: 50 }),
  initialMrr: numeric('initial_mrr', { precision: 10, scale: 2 }).default('0'),
  
  // Lifetime value tracking (updated periodically)
  currentMrr: numeric('current_mrr', { precision: 10, scale: 2 }).default('0'),
  totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }).default('0'),
  monthsActive: integer('months_active').default(0),
  
  // LTV calculation
  calculatedLtv: numeric('calculated_ltv', { precision: 12, scale: 2 }).default('0'),
  
  // Status
  status: varchar('status', { length: 20 }).default('active'), // active, churned, paused
  
  // Cohort (for cohort analysis)
  cohortMonth: integer('cohort_month'),
  cohortYear: integer('cohort_year'),
  
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    idxCustomerAcquisitionOrg: index('idx_cust_acq_org').using('btree', table.organizationId.asc()),
    idxCustomerAcquisitionDate: index('idx_cust_acq_date').using('btree', table.acquisitionDate.asc()),
    idxCustomerAcquisitionCohort: index('idx_cust_acq_cohort').using('btree', table.cohortYear.asc(), table.cohortMonth.asc()),
  };
});

// Revenue Cohort Data (aggregated by signup month)
export const revenueCohorts = pgTable('revenue_cohorts', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Cohort period (when customers signed up)
  cohortMonth: integer('cohort_month').notNull(),
  cohortYear: integer('cohort_year').notNull(),
  
  // Initial cohort size
  customersAtStart: integer('customers_at_start').default(0),
  
  // Monthly revenue for this cohort (months 1-24)
  month1Revenue: numeric('month_1_revenue', { precision: 12, scale: 2 }).default('0'),
  month2Revenue: numeric('month_2_revenue', { precision: 12, scale: 2 }).default('0'),
  month3Revenue: numeric('month_3_revenue', { precision: 12, scale: 2 }).default('0'),
  month4Revenue: numeric('month_4_revenue', { precision: 12, scale: 2 }).default('0'),
  month5Revenue: numeric('month_5_revenue', { precision: 12, scale: 2 }).default('0'),
  month6Revenue: numeric('month_6_revenue', { precision: 12, scale: 2 }).default('0'),
  month7Revenue: numeric('month_7_revenue', { precision: 12, scale: 2 }).default('0'),
  month8Revenue: numeric('month_8_revenue', { precision: 12, scale: 2 }).default('0'),
  month9Revenue: numeric('month_9_revenue', { precision: 12, scale: 2 }).default('0'),
  month10Revenue: numeric('month_10_revenue', { precision: 12, scale: 2 }).default('0'),
  month11Revenue: numeric('month_11_revenue', { precision: 12, scale: 2 }).default('0'),
  month12Revenue: numeric('month_12_revenue', { precision: 12, scale: 2 }).default('0'),
  
  // Retention at each month
  month1Retention: numeric('month_1_retention', { precision: 5, scale: 2 }).default('0'),
  month2Retention: numeric('month_2_retention', { precision: 5, scale: 2 }).default('0'),
  month3Retention: numeric('month_3_retention', { precision: 5, scale: 2 }).default('0'),
  month4Retention: numeric('month_4_retention', { precision: 5, scale: 2 }).default('0'),
  month5Retention: numeric('month_5_retention', { precision: 5, scale: 2 }).default('0'),
  month6Retention: numeric('month_6_retention', { precision: 5, scale: 2 }).default('0'),
  month7Retention: numeric('month_7_retention', { precision: 5, scale: 2 }).default('0'),
  month8Retention: numeric('month_8_retention', { precision: 5, scale: 2 }).default('0'),
  month9Retention: numeric('month_9_retention', { precision: 5, scale: 2 }).default('0'),
  month10Retention: numeric('month_10_retention', { precision: 5, scale: 2 }).default('0'),
  month11Retention: numeric('month_11_retention', { precision: 5, scale: 2 }).default('0'),
  month12Retention: numeric('month_12_retention', { precision: 5, scale: 2 }).default('0'),
  
  // Calculated LTV for cohort
  totalLtv: numeric('total_ltv', { precision: 12, scale: 2 }).default('0'),
  averageLtv: numeric('average_ltv', { precision: 10, scale: 2 }).default('0'),
  
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(table) => {
  return {
    idxRevenueCohortsPeriod: index('idx_rev_cohorts_period').using('btree', table.cohortYear.asc(), table.cohortMonth.asc()),
  };
});

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type NewSubscriptionEvent = typeof subscriptionEvents.$inferInsert;
export type MrrSnapshot = typeof mrrSnapshots.$inferSelect;
export type NewMrrSnapshot = typeof mrrSnapshots.$inferInsert;
export type CustomerAcquisition = typeof customerAcquisition.$inferSelect;
export type NewCustomerAcquisition = typeof customerAcquisition.$inferInsert;
export type RevenueCohort = typeof revenueCohorts.$inferSelect;
export type NewRevenueCohort = typeof revenueCohorts.$inferInsert;

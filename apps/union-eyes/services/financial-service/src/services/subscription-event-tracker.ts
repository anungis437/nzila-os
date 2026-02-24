/**
 * Subscription Event Tracker Service
 * 
 * Tracks subscription events for MRR/ARR calculation and churn analysis.
 * Call these methods when subscription events occur (webhooks, API calls, etc.)
 */

import { db } from '../db';
import { subscriptionEvents, customerAcquisition, mrrSnapshots } from '../db/schema-platform-economics';
import { eq, and, sql, desc } from 'drizzle-orm';

// Plan pricing (in USD)
const PLAN_PRICING: Record<string, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  starter: { monthly: 29, annual: 290 },
  pro: { monthly: 99, annual: 990 },
  enterprise: { monthly: 299, annual: 2990 },
};

export type SubscriptionEventType = 
  | 'subscription_started'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_cancelled'
  | 'subscription_reactivated'
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'subscription_expired'
  | 'billing_cycle_changed'
  | 'payment_failed'
  | 'payment_succeeded';

export interface SubscriptionEventInput {
  organizationId: string;
  eventType: SubscriptionEventType;
  planId?: string;
  planName?: string;
  planTier?: string;
  billingCycle?: 'monthly' | 'yearly';
  previousPlanId?: string;
  previousMonthlyAmount?: number;
  previousAnnualAmount?: number;
  source?: 'stripe' | 'whop' | 'manual' | 'system';
  sourceEventId?: string;
  attributionSource?: string;
  attributionCampaign?: string;
  attributionChannel?: string;
  paymentAmount?: number;
  paymentStatus?: 'success' | 'failed';
  failureReason?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Track a subscription event
 * Call this when subscription state changes
 */
export async function trackSubscriptionEvent(input: SubscriptionEventInput): Promise<void> {
  const {
    organizationId,
    eventType,
    planId,
    planName,
    planTier,
    billingCycle = 'monthly',
    previousPlanId,
    previousMonthlyAmount,
    previousAnnualAmount,
    source = 'system',
    sourceEventId,
    attributionSource,
    attributionCampaign,
    attributionChannel,
    paymentAmount,
    paymentStatus,
    failureReason,
    metadata,
  } = input;
  
  // Determine pricing
  const pricing = planTier ? PLAN_PRICING[planTier] : { monthly: 0, annual: 0 };
  const monthlyAmount = pricing?.monthly || 0;
  const annualAmount = pricing?.annual || 0;
  
  // Calculate MRR change based on event type
  let mrrChange = 0;
  if (eventType === 'subscription_started') {
    mrrChange = monthlyAmount;
  } else if (eventType === 'subscription_upgraded') {
    mrrChange = monthlyAmount - (previousMonthlyAmount || 0);
  } else if (eventType === 'subscription_downgraded') {
    mrrChange = monthlyAmount - (previousMonthlyAmount || 0);
  } else if (eventType === 'subscription_cancelled') {
    mrrChange = -(previousMonthlyAmount || monthlyAmount);
  } else if (eventType === 'subscription_reactivated') {
    mrrChange = monthlyAmount;
  } else if (eventType === 'billing_cycle_changed') {
    // Recalculate annual vs monthly
    mrrChange = billingCycle === 'yearly' ? monthlyAmount - (previousMonthlyAmount || 0) : 0;
  }
  
  // Insert event
  await db.insert(subscriptionEvents).values({
    organizationId,
    eventType,
    eventDate: new Date().toISOString(),
    planId,
    planName,
    planTier,
    monthlyAmount: monthlyAmount.toString(),
    annualAmount: annualAmount.toString(),
    billingCycle,
    previousPlanId,
    previousMonthlyAmount: previousMonthlyAmount?.toString() || '0',
    previousAnnualAmount: previousAnnualAmount?.toString() || '0',
    mrrChange: mrrChange.toString(),
    source,
    sourceEventId,
    attributionSource,
    attributionCampaign,
    attributionChannel,
    paymentAmount: paymentAmount?.toString(),
    paymentStatus,
    failureReason,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    processedAt: new Date().toISOString(),
  });
  
  // Update customer acquisition record if applicable
  if (eventType === 'subscription_started') {
    await upsertCustomerAcquisition(organizationId, {
      attributionSource,
      attributionCampaign,
      attributionChannel,
      planTier,
      monthlyAmount,
    });
  } else if (eventType === 'subscription_cancelled') {
    await updateCustomerStatus(organizationId, 'churned');
  } else if (eventType === 'subscription_upgraded' || eventType === 'subscription_downgraded') {
    await updateCustomerMrr(organizationId, monthlyAmount);
  }
}

/**
 * Upsert customer acquisition record
 */
async function upsertCustomerAcquisition(
  organizationId: string,
  data: {
    attributionSource?: string;
    attributionCampaign?: string;
    attributionChannel?: string;
    planTier?: string;
    monthlyAmount?: number;
  }
): Promise<void> {
  const now = new Date();
  const cohortMonth = now.getMonth() + 1;
  const cohortYear = now.getFullYear();
  
  const existing = await db
    .select()
    .from(customerAcquisition)
    .where(eq(customerAcquisition.organizationId, organizationId))
    .limit(1)
    .then(rows => rows[0]);
  
  if (existing) {
    // Update existing
    await db
      .update(customerAcquisition)
      .set({
        currentMrr: data.monthlyAmount?.toString() || '0',
        totalRevenue: (parseFloat(existing.totalRevenue || '0') + (data.monthlyAmount || 0)).toString(),
        monthsActive: existing.monthsActive + 1,
        updatedAt: now.toISOString(),
      })
      .where(eq(customerAcquisition.id, existing.id));
  } else {
    // Insert new
    await db.insert(customerAcquisition).values({
      organizationId,
      acquisitionDate: now.toISOString(),
      acquisitionSource: data.attributionSource,
      acquisitionCampaign: data.attributionCampaign,
      acquisitionChannel: data.attributionChannel,
      initialPlan: data.planTier,
      initialMrr: data.monthlyAmount?.toString() || '0',
      currentMrr: data.monthlyAmount?.toString() || '0',
      totalRevenue: data.monthlyAmount?.toString() || '0',
      monthsActive: 1,
      calculatedLtv: ((data.monthlyAmount || 0) * 24).toString(), // Quick LTV estimate
      status: 'active',
      cohortMonth,
      cohortYear,
    });
  }
}

/**
 * Update customer status
 */
async function updateCustomerStatus(
  organizationId: string,
  status: 'active' | 'churned' | 'paused'
): Promise<void> {
  const existing = await db
    .select()
    .from(customerAcquisition)
    .where(eq(customerAcquisition.organizationId, organizationId))
    .limit(1)
    .then(rows => rows[0]);
  
  if (existing) {
    await db
      .update(customerAcquisition)
      .set({
        status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(customerAcquisition.id, existing.id));
  }
}

/**
 * Update customer MRR (for upgrades/downgrades)
 */
async function updateCustomerMrr(organizationId: string, mrr: number): Promise<void> {
  const existing = await db
    .select()
    .from(customerAcquisition)
    .where(eq(customerAcquisition.organizationId, organizationId))
    .limit(1)
    .then(rows => rows[0]);
  
  if (existing) {
    const newTotalRevenue = parseFloat(existing.totalRevenue || '0') + mrr;
    const monthsActive = existing.monthsActive || 1;
    const calculatedLtv = (newTotalRevenue / monthsActive) * 24; // Simple LTV
    
    await db
      .update(customerAcquisition)
      .set({
        currentMrr: mrr.toString(),
        totalRevenue: newTotalRevenue.toString(),
        calculatedLtv: calculatedLtv.toString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(customerAcquisition.id, existing.id));
  }
}

/**
 * Calculate and store monthly MRR snapshot
 * Call this daily or monthly via cron
 */
export async function calculateMonthlyMrrSnapshot(): Promise<void> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  // Get all subscription events this month
  const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  
  const events = await db
    .select()
    .from(subscriptionEvents)
    .where(sql`${subscriptionEvents.eventDate} >= ${startOfMonth}`);
  
  // Calculate MRR components
  let newMrr = 0;
  let expansionMrr = 0;
  let contractionMrr = 0;
  let churnMrr = 0;
  let reactivationMrr = 0;
  let newSubscriptions = 0;
  let upgradedSubscriptions = 0;
  let downgradedSubscriptions = 0;
  let cancelledSubscriptions = 0;
  let reactivatedSubscriptions = 0;
  
  for (const event of events) {
    const amount = parseFloat(event.mrrChange?.toString() || '0');
    
    switch (event.eventType) {
      case 'subscription_started':
        newMrr += amount;
        newSubscriptions++;
        break;
      case 'subscription_upgraded':
        expansionMrr += amount;
        upgradedSubscriptions++;
        break;
      case 'subscription_downgraded':
        contractionMrr += amount;
        downgradedSubscriptions++;
        break;
      case 'subscription_cancelled':
        churnMrr += Math.abs(amount);
        cancelledSubscriptions++;
        break;
      case 'subscription_reactivated':
        reactivationMrr += amount;
        reactivatedSubscriptions++;
        break;
    }
  }
  
  // Get total active from latest events
  const allEvents = await db
    .select()
    .from(subscriptionEvents)
    .where(sql`${subscriptionEvents.eventDate} < ${startOfMonth}`)
    .orderBy(desc(subscriptionEvents.eventDate));
  
  // Group by org to get current state
  const orgStates = new Map<string, typeof allEvents[0]>();
  for (const event of allEvents) {
    if (!orgStates.has(event.organizationId)) {
      orgStates.set(event.organizationId, event);
    }
  }
  
  let totalMrr = 0;
  let activeCount = 0;
  for (const [, event] of orgStates) {
    if (['subscription_started', 'subscription_upgraded', 'subscription_reactivated', 'subscription_resumed'].includes(event.eventType)) {
      totalMrr += parseFloat(event.monthlyAmount?.toString() || '0');
      activeCount++;
    } else if (event.eventType === 'subscription_downgraded') {
      totalMrr += parseFloat(event.monthlyAmount?.toString() || '0');
    }
  }
  
  const grossMrr = totalMrr + churnMrr;
  const netMrr = totalMrr;
  const arr = totalMrr * 12;
  const arpu = activeCount > 0 ? totalMrr / activeCount : 0;
  
  // Calculate growth rate (vs last month)
  const lastMonth = month === 1 ? 12 : month - 1;
  const lastYear = month === 1 ? year - 1 : year;
  
  const lastSnapshot = await db
    .select()
    .from(mrrSnapshots)
    .where(
      and(
        sql`${mrrSnapshots.snapshotMonth} = ${lastMonth}`,
        sql`${mrrSnapshots.snapshotYear} = ${lastYear}`
      )
    )
    .limit(1)
    .then(rows => rows[0]);
  
  let mrrGrowthRate = 0;
  if (lastSnapshot) {
    const lastMrr = parseFloat(lastSnapshot.totalMrr?.toString() || '0');
    if (lastMrr > 0) {
      mrrGrowthRate = ((totalMrr - lastMrr) / lastMrr) * 100;
    }
  }
  
  // Insert snapshot
  await db.insert(mrrSnapshots).values({
    snapshotDate: now.toISOString(),
    snapshotMonth: month,
    snapshotYear: year,
    totalMrr: totalMrr.toString(),
    newMrr: newMrr.toString(),
    expansionMrr: expansionMrr.toString(),
    contractionMrr: contractionMrr.toString(),
    churnMrr: churnMrr.toString(),
    reactivationMrr: reactivationMrr.toString(),
    activeSubscriptions: activeCount,
    newSubscriptions,
    upgradedSubscriptions,
    downgradedSubscriptions,
    cancelledSubscriptions,
    reactivatedSubscriptions,
    grossMrr: grossMrr.toString(),
    netMrr: netMrr.toString(),
    mrrGrowthRate: mrrGrowthRate.toString(),
    totalArr: arr.toString(),
    avgRevenuePerUser: arpu.toString(),
  });
}

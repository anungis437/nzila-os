/**
 * Subscription Lifecycle Service
 *
 * Handles trial-to-paid conversion, subscription pause/resume,
 * and renewal processing.
 *
 * @domain platform-economics
 * @layer 1.5 — Billing Lifecycle
 */

import { db } from '@/db';
import {
  orgSubscriptions,
  subscriptionEventsLog,
} from '@/db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionAction {
  subscriptionId: string;
  organizationId: string;
  action: string;
  previousStatus: string;
  newStatus: string;
}

// ============================================================================
// Trial Management
// ============================================================================

/**
 * Expire trials whose trialEndDate has passed and status is still 'trialing'.
 * Moves to 'active' if payment method on file, otherwise 'cancelled'.
 *
 * Returns the list of affected subscriptions.
 */
export async function expireTrials(
  hasPaymentMethod: (orgId: string) => Promise<boolean>,
): Promise<SubscriptionAction[]> {
  const expired = await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.status, 'trialing'),
        lte(orgSubscriptions.trialEndDate, new Date()),
      ),
    );

  const actions: SubscriptionAction[] = [];

  for (const sub of expired) {
    const hasPm = await hasPaymentMethod(sub.organizationId);
    const newStatus = hasPm ? 'active' : 'cancelled';
    const eventType = hasPm ? 'trial_converted' : 'trial_expired';

    await db
      .update(orgSubscriptions)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(orgSubscriptions.id, sub.id));

    await db.insert(subscriptionEventsLog).values({
      organizationId: sub.organizationId,
      subscriptionId: sub.id,
      eventType,
      previousState: { status: 'trialing' },
      newState: { status: newStatus },
      reason: hasPm
        ? 'Trial converted — payment method on file'
        : 'Trial expired — no payment method',
    });

    actions.push({
      subscriptionId: sub.id,
      organizationId: sub.organizationId,
      action: eventType,
      previousStatus: 'trialing',
      newStatus,
    });
  }

  return actions;
}

/**
 * Send trial-ending-soon warnings for subscriptions expiring within N days.
 */
export async function getTrialsEndingSoon(withinDays: number = 3) {
  const threshold = new Date(Date.now() + withinDays * 86_400_000);

  return await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.status, 'trialing'),
        lte(orgSubscriptions.trialEndDate, threshold),
        sql`${orgSubscriptions.trialEndDate} > NOW()`,
      ),
    );
}

// ============================================================================
// Pause / Resume
// ============================================================================

/**
 * Pause an active subscription.
 */
export async function pauseSubscription(
  subscriptionId: string,
  pausedBy: string,
  reason?: string,
): Promise<SubscriptionAction> {
  const [sub] = await db
    .update(orgSubscriptions)
    .set({
      status: 'paused',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orgSubscriptions.id, subscriptionId),
        eq(orgSubscriptions.status, 'active'),
      ),
    )
    .returning();

  if (!sub) {
    throw new Error(`Subscription ${subscriptionId} not found or not active`);
  }

  await db.insert(subscriptionEventsLog).values({
    organizationId: sub.organizationId,
    subscriptionId: sub.id,
    eventType: 'paused',
    previousState: { status: 'active' },
    newState: { status: 'paused' },
    triggeredBy: pausedBy,
    reason,
  });

  await auditLog({
    eventType: AuditEventType.DATA_UPDATE,
    severity: AuditSeverity.HIGH,
    organizationId: sub.organizationId,
    resource: 'org_subscription',
    resourceId: sub.id,
    action: 'subscription_paused',
    userId: pausedBy,
  });

  return {
    subscriptionId: sub.id,
    organizationId: sub.organizationId,
    action: 'paused',
    previousStatus: 'active',
    newStatus: 'paused',
  };
}

/**
 * Resume a paused subscription.
 */
export async function resumeSubscription(
  subscriptionId: string,
  resumedBy: string,
): Promise<SubscriptionAction> {
  const [sub] = await db
    .update(orgSubscriptions)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orgSubscriptions.id, subscriptionId),
        eq(orgSubscriptions.status, 'paused'),
      ),
    )
    .returning();

  if (!sub) {
    throw new Error(`Subscription ${subscriptionId} not found or not paused`);
  }

  await db.insert(subscriptionEventsLog).values({
    organizationId: sub.organizationId,
    subscriptionId: sub.id,
    eventType: 'resumed',
    previousState: { status: 'paused' },
    newState: { status: 'active' },
    triggeredBy: resumedBy,
  });

  await auditLog({
    eventType: AuditEventType.DATA_UPDATE,
    severity: AuditSeverity.MEDIUM,
    organizationId: sub.organizationId,
    resource: 'org_subscription',
    resourceId: sub.id,
    action: 'subscription_resumed',
    userId: resumedBy,
  });

  return {
    subscriptionId: sub.id,
    organizationId: sub.organizationId,
    action: 'resumed',
    previousStatus: 'paused',
    newStatus: 'active',
  };
}

// ============================================================================
// Renewal
// ============================================================================

/**
 * Process auto-renewals for contracts/subscriptions nearing expiration.
 * Returns list of renewed subscription IDs.
 */
export async function processAutoRenewals(
  withinDays: number = 7,
): Promise<string[]> {
  const threshold = new Date(Date.now() + withinDays * 86_400_000);

  const expiring = await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.status, 'active'),
        lte(orgSubscriptions.endDate, threshold),
        sql`${orgSubscriptions.endDate} > NOW()`,
      ),
    );

  const renewed: string[] = [];

  for (const sub of expiring) {
    // Extend by billing interval (default 1 month)
    const currentEnd = sub.endDate ?? new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);

    await db
      .update(orgSubscriptions)
      .set({
        endDate: newEnd,
        updatedAt: new Date(),
      })
      .where(eq(orgSubscriptions.id, sub.id));

    await db.insert(subscriptionEventsLog).values({
      organizationId: sub.organizationId,
      subscriptionId: sub.id,
      eventType: 'renewed',
      previousState: { endDate: currentEnd.toISOString() },
      newState: { endDate: newEnd.toISOString() },
      reason: 'Auto-renewal processed',
    });

    renewed.push(sub.id);
  }

  return renewed;
}

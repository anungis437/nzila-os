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
import { getActiveContract } from './contract-service';

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
 * Expire trials whose trialEndDate has passed and status is still 'trialing',
 * scoped to a single organization. Moves to 'active' if payment method on
 * file, otherwise 'cancelled'.
 *
 * organizationId is required: a tenant-facing caller must never expire
 * trials outside its own authorized organization (see PR #752 review —
 * app/api/billing/credits/check-expired/route.ts previously called this
 * with no org filter, mutating every organization's expired trials).
 *
 * Returns the list of affected subscriptions.
 */
export async function expireTrials(
  organizationId: string,
  hasPaymentMethod: (orgId: string) => Promise<boolean>,
): Promise<SubscriptionAction[]> {
  const expired = await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.organizationId, organizationId),
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
 * Send trial-ending-soon warnings for subscriptions expiring within N days,
 * scoped to a single organization (same cross-org rationale as expireTrials).
 */
export async function getTrialsEndingSoon(organizationId: string, withinDays: number = 3) {
  const threshold = new Date(Date.now() + withinDays * 86_400_000);

  return await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.organizationId, organizationId),
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
 *
 * organizationId is required and enforced in the WHERE clause: a
 * tenant-facing caller must never pause a subscription belonging to a
 * different organization merely by supplying its UUID (see PR #752 review
 * — app/api/billing/subscriptions/route.ts previously called this with
 * only subscriptionId, an IDOR allowing any steward to pause/resume any
 * org's subscription).
 */
export async function pauseSubscription(
  organizationId: string,
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
        eq(orgSubscriptions.organizationId, organizationId),
        eq(orgSubscriptions.status, 'active'),
      ),
    )
    .returning();

  if (!sub) {
    throw new Error(`Subscription ${subscriptionId} not found, not active, or not owned by this organization`);
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
 *
 * organizationId is required and enforced in the WHERE clause — see
 * pauseSubscription's doc comment for the cross-org rationale.
 */
export async function resumeSubscription(
  organizationId: string,
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
        eq(orgSubscriptions.organizationId, organizationId),
        eq(orgSubscriptions.status, 'paused'),
      ),
    )
    .returning();

  if (!sub) {
    throw new Error(`Subscription ${subscriptionId} not found, not paused, or not owned by this organization`);
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
 *
 * Deliberately cross-organization (a global renewal sweep) — has zero
 * production callers as of PR #752's audit. If wired to a cron job, that
 * job must invoke this through withSystemContext, not the ordinary tenant
 * runtime connection; it must never be exposed via a tenant-facing route.
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
    // Guard: do not extend subscription beyond contract expiration
    const contract = await getActiveContract(sub.organizationId);
    if (!contract) {
      continue; // No active contract — skip renewal
    }

    // Extend by billing interval (default 1 month)
    const currentEnd = sub.endDate ?? new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);

    // Cap renewal at contract expiration
    if (contract.expirationDate && newEnd > contract.expirationDate) {
      newEnd.setTime(contract.expirationDate.getTime());
    }

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

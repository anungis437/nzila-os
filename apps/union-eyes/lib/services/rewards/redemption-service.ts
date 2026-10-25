/**
 * Redemption Service
 * Handles member redemption lifecycle. Every state change commits with its audit record in one transaction.
 */

import { db } from '@/db';
import {
  rewardRedemptions,
  type RewardRedemption,
} from '@/db/schema';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { applyLedgerEntry } from './wallet-service';
import { auditRewards, rewardsActor } from './audit';

export interface InitiateRedemptionOptions {
  orgId: string;
  userId: string;
  programId: string;
  creditsToSpend: number;
  provider: 'shopify';
  providerDetails?: Record<string, unknown>;
}

/**
 * Initiate a redemption request
 * Deducts credits immediately from wallet
 * Returns redemption record for checkout creation
 */
export async function initiateRedemption(
  options: InitiateRedemptionOptions
): Promise<RewardRedemption> {
  const { orgId, userId, programId, creditsToSpend, provider, providerDetails } = options;

  return await db.transaction(async (tx) => {
    // Apply ledger entry (spend credits)
    await applyLedgerEntry(tx, {
      orgId,
      userId,
      eventType: 'spend',
      amountCredits: -creditsToSpend,
      sourceType: 'redemption',
      memo: `Redemption initiated via ${provider}`,
    });

    // Create redemption record
    const [redemption] = await tx
      .insert(rewardRedemptions)
      .values({
        orgId,
        userId,
        programId,
        creditsSpent: creditsToSpend,
        status: 'initiated',
        provider,
        providerPayloadJson: providerDetails,
        updatedAt: new Date(),
      })
      .returning();

    await auditRewards(tx, {
      organizationId: orgId,
      userId,
      action: 'rewards.redemption.initiate',
      resourceType: 'reward_redemptions',
      resourceId: redemption.id,
      details: { programId, provider, creditsSpent: creditsToSpend },
    });

    return redemption;
  });
}

/**
 * Update redemption with checkout details
 * Called after Shopify checkout is created
 */
export async function updateRedemptionCheckout(
  redemptionId: string,
  orgId: string,
  checkoutId: string,
  checkoutUrl: string,
  actorUserId?: string
): Promise<RewardRedemption> {
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(rewardRedemptions)
      .set({
        providerCheckoutId: checkoutId,
        status: 'pending_payment',
        providerPayloadJson: {
          checkoutId,
          checkoutUrl,
        },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rewardRedemptions.id, redemptionId),
          eq(rewardRedemptions.orgId, orgId),
          eq(rewardRedemptions.status, 'initiated')
        )
      )
      .returning();
    if (!updated) throw new Error('Redemption not found or not awaiting checkout');

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(actorUserId),
      action: 'rewards.redemption.checkout',
      resourceType: 'reward_redemptions',
      resourceId: redemptionId,
      details: { checkoutId },
    });
    return updated;
  });
}

/**
 * Mark redemption as ordered
 * Called from Shopify orders/paid webhook
 */
export async function markRedemptionOrdered(
  redemptionId: string,
  orgId: string,
  orderId: string,
  orderPayload: Record<string, unknown>,
  actorUserId?: string
): Promise<RewardRedemption> {
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(rewardRedemptions)
      .set({
        status: 'ordered',
        providerOrderId: orderId,
        providerPayloadJson: orderPayload,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rewardRedemptions.id, redemptionId),
          eq(rewardRedemptions.orgId, orgId),
          inArray(rewardRedemptions.status, ['initiated', 'pending_payment'])
        )
      )
      .returning();
    if (!updated) throw new Error('Redemption not found or not awaiting payment');

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(actorUserId, 'system:shopify-webhook'),
      action: 'rewards.redemption.ordered',
      resourceType: 'reward_redemptions',
      resourceId: redemptionId,
      details: { orderId },
    });
    return updated;
  });
}

/**
 * Mark redemption as fulfilled
 * Called from Shopify orders/fulfilled webhook
 */
export async function markRedemptionFulfilled(
  redemptionId: string,
  orgId: string,
  fulfillmentPayload: Record<string, unknown>,
  actorUserId?: string
): Promise<RewardRedemption> {
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(rewardRedemptions)
      .set({
        status: 'fulfilled',
        providerPayloadJson: fulfillmentPayload,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rewardRedemptions.id, redemptionId),
          eq(rewardRedemptions.orgId, orgId),
          eq(rewardRedemptions.status, 'ordered')
        )
      )
      .returning();
    if (!updated) throw new Error('Redemption not found or not awaiting fulfilment');

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(actorUserId, 'system:shopify-webhook'),
      action: 'rewards.redemption.fulfilled',
      resourceType: 'reward_redemptions',
      resourceId: redemptionId,
      details: {},
    });
    return updated;
  });
}

export interface CancelRedemptionActor {
  userId: string;
  /** When set, only the member who owns the redemption may cancel it; anyone else sees "not found". */
  mustOwn?: boolean;
}

/**
 * Cancel a redemption
 * Returns credits to user wallet
 */
export async function cancelRedemption(
  redemptionId: string,
  orgId: string,
  reason: string,
  actor?: CancelRedemptionActor
): Promise<{
  redemption: RewardRedemption;
  newBalance: number;
}> {
  return await db.transaction(async (tx) => {
    // Get redemption
    const redemption = await tx.query.rewardRedemptions.findFirst({
      where: and(
        eq(rewardRedemptions.id, redemptionId),
        eq(rewardRedemptions.orgId, orgId)
      ),
    });

    if (!redemption || (actor?.mustOwn && redemption.userId !== actor.userId)) {
      throw new Error('Redemption not found');
    }

    if (!['initiated', 'pending_payment'].includes(redemption.status)) {
      throw new Error(`Cannot cancel redemption with status: ${redemption.status}`);
    }

    // Update redemption status first: the status predicate stops a concurrent cancel or order from also refunding.
    const [updated] = await tx
      .update(rewardRedemptions)
      .set({
        status: 'cancelled',
        providerPayloadJson: {
          ...((redemption.providerPayloadJson || {}) as Record<string, unknown>),
          cancelledReason: reason,
          cancelledAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rewardRedemptions.id, redemptionId),
          eq(rewardRedemptions.orgId, orgId),
          eq(rewardRedemptions.status, redemption.status)
        )
      )
      .returning();
    if (!updated) throw new Error('Cannot cancel redemption: it was changed concurrently');

    // Refund credits
    const ledgerEntry = await applyLedgerEntry(tx, {
      orgId: redemption.orgId,
      userId: redemption.userId,
      eventType: 'refund',
      amountCredits: redemption.creditsSpent,
      sourceType: 'redemption',
      sourceId: redemption.id,
      memo: `Redemption cancelled: ${reason}`,
    });

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(actor?.userId),
      action: 'rewards.redemption.cancel',
      resourceType: 'reward_redemptions',
      resourceId: redemptionId,
      details: { reason, creditsRefunded: redemption.creditsSpent, memberUserId: redemption.userId },
    });

    return {
      redemption: updated,
      newBalance: ledgerEntry.balanceAfter,
    };
  });
}

/**
 * Process refund from Shopify webhook
 * Returns credits to user wallet
 */
export async function processRedemptionRefund(
  redemptionId: string,
  orgId: string,
  refundPayload: Record<string, unknown>,
  actorUserId?: string
): Promise<{
  redemption: RewardRedemption;
  newBalance: number;
}> {
  return await db.transaction(async (tx) => {
    // Get redemption
    const redemption = await tx.query.rewardRedemptions.findFirst({
      where: and(
        eq(rewardRedemptions.id, redemptionId),
        eq(rewardRedemptions.orgId, orgId)
      ),
    });

    if (!redemption) {
      throw new Error('Redemption not found');
    }

    if (redemption.status === 'refunded') {
      // Already refunded (idempotency)
      return {
        redemption,
        newBalance: 0, // Will be recalculated below
      };
    }

    // Update redemption status first: the status predicate stops a concurrent refund from crediting twice.
    const [updated] = await tx
      .update(rewardRedemptions)
      .set({
        status: 'refunded',
        providerPayloadJson: {
          ...((redemption.providerPayloadJson || {}) as Record<string, unknown>),
          refundPayload,
          refundedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rewardRedemptions.id, redemptionId),
          eq(rewardRedemptions.orgId, orgId),
          eq(rewardRedemptions.status, redemption.status)
        )
      )
      .returning();
    if (!updated) throw new Error('Redemption refund conflicts with a concurrent change');

    // Refund credits
    const ledgerEntry = await applyLedgerEntry(tx, {
      orgId: redemption.orgId,
      userId: redemption.userId,
      eventType: 'refund',
      amountCredits: redemption.creditsSpent,
      sourceType: 'redemption',
      sourceId: redemption.id,
      memo: `Redemption refunded via Shopify`,
    });

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(actorUserId, 'system:shopify-webhook'),
      action: 'rewards.redemption.refund',
      resourceType: 'reward_redemptions',
      resourceId: redemptionId,
      details: { creditsRefunded: redemption.creditsSpent, memberUserId: redemption.userId },
    });

    return {
      redemption: updated,
      newBalance: ledgerEntry.balanceAfter,
    };
  });
}

/**
 * Get redemption by ID
 */
export async function getRedemptionById(
  redemptionId: string,
  orgId: string
): Promise<RewardRedemption | null> {
  const redemption = await db.query.rewardRedemptions.findFirst({
    where: and(
      eq(rewardRedemptions.id, redemptionId),
      eq(rewardRedemptions.orgId, orgId)
    ),
  });

  return redemption || null;
}

/**
 * Internal-only lookup by ID (no org scope)
 */
export async function getRedemptionByIdInternal(
  redemptionId: string
): Promise<RewardRedemption | null> {
  const redemption = await db.query.rewardRedemptions.findFirst({
    where: eq(rewardRedemptions.id, redemptionId),
  });

  return redemption || null;
}

/**
 * Get redemption by provider order ID
 */
export async function getRedemptionByOrderId(
  orderId: string,
  orgId?: string
): Promise<RewardRedemption | null> {
  const redemption = await db.query.rewardRedemptions.findFirst({
    where: orgId
      ? and(
          eq(rewardRedemptions.providerOrderId, orderId),
          eq(rewardRedemptions.orgId, orgId)
        )
      : eq(rewardRedemptions.providerOrderId, orderId),
  });

  return redemption || null;
}

/**
 * List user redemptions
 */
export async function listUserRedemptions(
  orgId: string,
  userId: string,
  limit = 20,
  offset = 0
): Promise<{
  redemptions: RewardRedemption[];
  total: number;
}> {
  const redemptions = await db.query.rewardRedemptions.findMany({
    where: and(
      eq(rewardRedemptions.orgId, orgId),
      eq(rewardRedemptions.userId, userId)
    ),
    orderBy: [desc(rewardRedemptions.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const [{ total: totalCount }] = await db
    .select({ total: count() })
    .from(rewardRedemptions)
    .where(
      and(
        eq(rewardRedemptions.orgId, orgId),
        eq(rewardRedemptions.userId, userId)
      )
    );

  return {
    redemptions,
    total: totalCount,
  };
}

/**
 * List all redemptions for an organization
 * Admin view
 */
export async function listOrgRedemptions(
  orgId: string,
  limit = 50,
  offset = 0
): Promise<{
  redemptions: RewardRedemption[];
  total: number;
}> {
  const redemptions = await db.query.rewardRedemptions.findMany({
    where: eq(rewardRedemptions.orgId, orgId),
    orderBy: [desc(rewardRedemptions.createdAt)],
    limit,
    offset,
  });

  const [{ total: totalCount }] = await db
    .select({ total: count() })
    .from(rewardRedemptions)
    .where(eq(rewardRedemptions.orgId, orgId));

  return {
    redemptions,
    total: totalCount,
  };
}


/**
 * Redemption Service
 * Handles member redemption lifecycle
 */

import { db } from '@/db';
import {
  rewardRedemptions,
  type RewardRedemption,
} from '@/db/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { applyLedgerEntry } from './wallet-service';

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
  checkoutUrl: string
): Promise<RewardRedemption> {
  const [updated] = await db
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
        eq(rewardRedemptions.orgId, orgId)
      )
    )
    .returning();

  return updated;
}

/**
 * Mark redemption as ordered
 * Called from Shopify orders/paid webhook
 */
export async function markRedemptionOrdered(
  redemptionId: string,
  orgId: string,
  orderId: string,
  orderPayload: Record<string, unknown>
): Promise<RewardRedemption> {
  const [updated] = await db
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
        eq(rewardRedemptions.orgId, orgId)
      )
    )
    .returning();

  return updated;
}

/**
 * Mark redemption as fulfilled
 * Called from Shopify orders/fulfilled webhook
 */
export async function markRedemptionFulfilled(
  redemptionId: string,
  orgId: string,
  fulfillmentPayload: Record<string, unknown>
): Promise<RewardRedemption> {
  const [updated] = await db
    .update(rewardRedemptions)
    .set({
      status: 'fulfilled',
      providerPayloadJson: fulfillmentPayload,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(rewardRedemptions.id, redemptionId),
        eq(rewardRedemptions.orgId, orgId)
      )
    )
    .returning();

  return updated;
}

/**
 * Cancel a redemption
 * Returns credits to user wallet
 */
export async function cancelRedemption(
  redemptionId: string,
  orgId: string,
  reason: string
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

    if (!['initiated', 'pending_payment'].includes(redemption.status)) {
      throw new Error(`Cannot cancel redemption with status: ${redemption.status}`);
    }

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

    // Update redemption status
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
      .where(eq(rewardRedemptions.id, redemptionId))
      .returning();

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
  refundPayload: Record<string, unknown>
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

    // Update redemption status
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
      .where(eq(rewardRedemptions.id, redemptionId))
      .returning();

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


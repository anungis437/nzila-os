/**
 * Rewards Statistics Utilities
 * Helper functions for calculating reward totals and stats
 * 
 * Part of Week 2 P1 Implementation - Dashboard Data Loading Fixes
 */

import { db } from '@/db/db';
import { rewardWalletLedger } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface RewardTotals {
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  currentBalance: number;
}

/**
 * Calculate reward totals for a user
 */
export async function calculateRewardTotals(
  userId: string,
  organizationId: string
): Promise<RewardTotals> {
  try {
    // Aggregate ledger entries by type
    const result = await db
      .select({
        eventType: rewardWalletLedger.transactionType,
        total: sql<number>`CAST(SUM(${rewardWalletLedger.pointsChange}) AS INTEGER)`,
      })
      .from(rewardWalletLedger)
      .where(
        and(
          eq(rewardWalletLedger.userId, userId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq((rewardWalletLedger as any).orgId, organizationId)
        )
      )
      .groupBy(rewardWalletLedger.transactionType);

    // Initialize totals
    const totals: RewardTotals = {
      totalEarned: 0,
      totalRedeemed: 0,
      totalExpired: 0,
      currentBalance: 0,
    };

    // Sum up the totals by type
    result.forEach(row => {
      const amount = Math.abs(row.total || 0);
      
      switch (row.eventType) {
        case 'earn':
        case 'adjust':
        case 'refund':
          totals.totalEarned += amount;
          totals.currentBalance += amount;
          break;
        case 'spend':
          totals.totalRedeemed += amount;
          totals.currentBalance -= amount;
          break;
        case 'expire':
        case 'revoke':
          totals.totalExpired += amount;
          totals.currentBalance -= amount;
          break;
      }
    });

    return totals;
  } catch (_error) {
return {
      totalEarned: 0,
      totalRedeemed: 0,
      totalExpired: 0,
      currentBalance: 0,
    };
  }
}

/**
 * Get earned credits total (simpler version)
 */
export async function getTotalEarned(userId: string, organizationId: string): Promise<number> {
  try {
    const result = await db
      .select({
        total: sql<number>`CAST(SUM(${rewardWalletLedger.pointsChange}) AS INTEGER)`,
      })
      .from(rewardWalletLedger)
      .where(
        and(
          eq(rewardWalletLedger.userId, userId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq((rewardWalletLedger as any).orgId, organizationId),
          sql`${rewardWalletLedger.transactionType} IN ('earn', 'adjust', 'refund')`
        )
      );

    return result[0]?.total || 0;
  } catch (_error) {
return 0;
  }
}

/**
 * Get redeemed credits total (simpler version)
 */
export async function getTotalRedeemed(userId: string, organizationId: string): Promise<number> {
  try {
    const result = await db
      .select({
        total: sql<number>`CAST(SUM(${rewardWalletLedger.pointsChange}) AS INTEGER)`,
      })
      .from(rewardWalletLedger)
      .where(
        and(
          eq(rewardWalletLedger.userId, userId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq((rewardWalletLedger as any).orgId, organizationId),
          eq(rewardWalletLedger.transactionType, 'spend')
        )
      );

    return Math.abs(result[0]?.total || 0);
  } catch (_error) {
return 0;
  }
}

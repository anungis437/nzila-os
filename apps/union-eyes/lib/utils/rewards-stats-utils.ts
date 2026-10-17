/**
 * Tenant-scoped current credit ledger totals.
 * Empty wallets are zero; database/schema failures propagate to the caller.
 */
import { db } from '@/db/db';
import { rewardWalletLedger } from '@/db/schema/domains/infrastructure/rewards';
import { eq, and, sql } from 'drizzle-orm';

export interface RewardTotals {
  totalEarned: number;
  totalRedeemed: number;
  totalExpired: number;
  currentBalance: number;
}

export async function calculateRewardTotals(
  userId: string,
  organizationId: string
): Promise<RewardTotals> {
  const result = await db
    .select({
      eventType: rewardWalletLedger.eventType,
      total: sql<number>`CAST(SUM(${rewardWalletLedger.amountCredits}) AS INTEGER)`,
    })
    .from(rewardWalletLedger)
    .where(and(
      eq(rewardWalletLedger.userId, userId),
      eq(rewardWalletLedger.orgId, organizationId)
    ))
    .groupBy(rewardWalletLedger.eventType);

  const totals: RewardTotals = {
    totalEarned: 0,
    totalRedeemed: 0,
    totalExpired: 0,
    currentBalance: 0,
  };
  for (const row of result) {
    const amount = Number(row.total ?? 0);
    // Adjustments can be debits. Taking abs() here would inflate the balance.
    totals.currentBalance += amount;
    switch (row.eventType) {
      case 'earn':
      case 'adjust':
      case 'refund':
        totals.totalEarned += amount;
        break;
      case 'spend':
        totals.totalRedeemed -= amount;
        break;
      case 'expire':
      case 'revoke':
        totals.totalExpired -= amount;
        break;
    }
  }
  return totals;
}

export async function getTotalEarned(userId: string, organizationId: string): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`CAST(SUM(${rewardWalletLedger.amountCredits}) AS INTEGER)`,
    })
    .from(rewardWalletLedger)
    .where(and(
      eq(rewardWalletLedger.userId, userId),
      eq(rewardWalletLedger.orgId, organizationId),
      sql`${rewardWalletLedger.eventType} IN ('earn', 'adjust', 'refund')`
    ));
  return Number(result[0]?.total ?? 0);
}

export async function getTotalRedeemed(userId: string, organizationId: string): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`CAST(SUM(${rewardWalletLedger.amountCredits}) AS INTEGER)`,
    })
    .from(rewardWalletLedger)
    .where(and(
      eq(rewardWalletLedger.userId, userId),
      eq(rewardWalletLedger.orgId, organizationId),
      eq(rewardWalletLedger.eventType, 'spend')
    ));
  const total = Number(result[0]?.total ?? 0);
  return total === 0 ? 0 : -total;
}

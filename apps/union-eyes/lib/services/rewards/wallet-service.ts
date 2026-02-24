/**
 * Wallet Service
 * Handles wallet balance, ledger queries, and transactional ledger writes
 */

import { type PgTransaction } from 'drizzle-orm/pg-core';
import { type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { db } from '@/db';
import {
  rewardWalletLedger,
  type RewardWalletLedgerEntry,
} from '@/db/schema/domains/infrastructure/rewards';
import { eq, and, desc, sql } from 'drizzle-orm';

type DbTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

export interface LedgerEntryOptions {
  orgId: string;
  userId: string;
  eventType: 'earn' | 'spend' | 'expire' | 'revoke' | 'adjust' | 'refund';
  amountCredits: number; // Can be negative for spend/revoke
  sourceType: 'award' | 'redemption' | 'admin_adjustment' | 'system';
  sourceId?: string;
  memo?: string;
}

/**
 * Get user's current wallet balance
 * Returns the balance_after from the most recent ledger entry
 */
export async function getBalance(
  orgId: string,
  userId: string
): Promise<number> {
  const [latestEntry] = await db
    .select()
    .from(rewardWalletLedger)
    .where(and(
      eq(rewardWalletLedger.orgId, orgId),
      eq(rewardWalletLedger.userId, userId)
    ))
    .orderBy(desc(rewardWalletLedger.createdAt))
    .limit(1);

  return latestEntry?.balanceAfter ?? 0;
}

/**
 * List ledger entries for a user
 */
export async function listLedger(
  orgId: string,
  userId: string,
  limit = 20,
  offset = 0
): Promise<{
  entries: RewardWalletLedgerEntry[];
  total: number;
}> {
  const entries = await db
    .select()
    .from(rewardWalletLedger)
    .where(and(
      eq(rewardWalletLedger.orgId, orgId),
      eq(rewardWalletLedger.userId, userId)
    ))
    .orderBy(desc(rewardWalletLedger.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rewardWalletLedger)
    .where(
      and(
        eq(rewardWalletLedger.orgId, orgId),
        eq(rewardWalletLedger.userId, userId)
      )
    );

  return {
    entries,
    total: count,
  };
}

/**
 * Apply a ledger entry (transactional)
 * Calculates new balance and ensures non-negative balance (unless override)
 * 
 * IMPORTANT: This function should be called within a transaction
 */
export async function applyLedgerEntry(
  tx: DbTransaction | typeof db,
  options: LedgerEntryOptions,
  allowNegativeBalance = false
): Promise<RewardWalletLedgerEntry> {
  const { orgId, userId, eventType, amountCredits, sourceType, sourceId, memo } = options;

  // Get current balance (lock row for update to prevent race conditions)
  const [latestEntry] = await tx
    .select()
    .from(rewardWalletLedger)
    .where(and(
      eq(rewardWalletLedger.orgId, orgId),
      eq(rewardWalletLedger.userId, userId)
    ))
    .orderBy(desc(rewardWalletLedger.createdAt))
    .limit(1);

  const currentBalance = latestEntry?.balanceAfter ?? 0;
  const newBalance = currentBalance + amountCredits;

  // Validate non-negative balance
  if (!allowNegativeBalance && newBalance < 0) {
    throw new Error(
      `Insufficient balance. Current: ${currentBalance}, Requested: ${Math.abs(amountCredits)}`
    );
  }

  // Insert ledger entry
  const [entry] = await tx
    .insert(rewardWalletLedger)
    .values({
      orgId,
      userId,
      eventType,
      amountCredits,
      balanceAfter: newBalance,
      sourceType,
      sourceId,
      memo,
    })
    .returning();

  return entry;
}

/**
 * Admin adjustment: manually adjust wallet balance
 * Allows negative balance with explicit override
 */
export async function adminAdjustBalance(
  orgId: string,
  userId: string,
  amountCredits: number,
  adminUserId: string,
  memo: string,
  allowNegative = false
): Promise<RewardWalletLedgerEntry> {
  return await db.transaction(async (tx) => {
    return await applyLedgerEntry(
      tx,
      {
        orgId,
        userId,
        eventType: 'adjust',
        amountCredits,
        sourceType: 'admin_adjustment',
        memo: `Admin adjustment by ${adminUserId}: ${memo}`,
      },
      allowNegative
    );
  });
}

/**
 * Get ledger summary for an organization
 * Returns aggregate stats for admin reporting
 */
export async function getLedgerSummary(
  orgId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCreditsIssued: number;
  totalCreditsSpent: number;
  totalCreditsOutstanding: number;
  activeMembers: number;
}> {
  let whereClause = eq(rewardWalletLedger.orgId, orgId);

  if (startDate && endDate) {
    whereClause = and(
      whereClause,
      sql`${rewardWalletLedger.createdAt} >= ${startDate}`,
      sql`${rewardWalletLedger.createdAt} <= ${endDate}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
  }

  const [summary] = await db
    .select({
      totalIssued: sql<number>`COALESCE(SUM(CASE WHEN ${rewardWalletLedger.eventType} = 'earn' THEN ${rewardWalletLedger.amountCredits} ELSE 0 END), 0)::int`,
      totalSpent: sql<number>`COALESCE(SUM(CASE WHEN ${rewardWalletLedger.eventType} = 'spend' THEN ABS(${rewardWalletLedger.amountCredits}) ELSE 0 END), 0)::int`,
      activeMembers: sql<number>`COUNT(DISTINCT ${rewardWalletLedger.userId})::int`,
    })
    .from(rewardWalletLedger)
    .where(whereClause);

  // Get total outstanding (sum of all latest balances)
  const [outstanding] = await db.execute(sql`
    WITH latest_balances AS (
      SELECT DISTINCT ON (user_id)
        user_id,
        balance_after
      FROM ${rewardWalletLedger}
      WHERE ${whereClause}
      ORDER BY user_id, created_at DESC
    )
    SELECT COALESCE(SUM(balance_after), 0)::int AS total
    FROM latest_balances
  `);

  return {
    totalCreditsIssued: summary.totalIssued,
    totalCreditsSpent: summary.totalSpent,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalCreditsOutstanding: (outstanding as any).total,
    activeMembers: summary.activeMembers,
  };
}

/**
 * Get wallet balances for multiple users
 * Useful for bulk operations or admin views
 */
export async function getBulkBalances(
  orgId: string,
  userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const results = await db.execute(sql`
    WITH latest_entries AS (
      SELECT DISTINCT ON (user_id)
        user_id,
        balance_after
      FROM ${rewardWalletLedger}
      WHERE org_id = ${orgId}
        AND user_id = ANY(${userIds})
      ORDER BY user_id, created_at DESC
    )
    SELECT user_id, balance_after
    FROM latest_entries
  `);

  const balanceMap = new Map<string, number>();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of results as any) {
    balanceMap.set(row.user_id, row.balance_after);
  }

  // Fill in zero balances for users with no entries
  for (const userId of userIds) {
    if (!balanceMap.has(userId)) {
      balanceMap.set(userId, 0);
    }
  }

  return balanceMap;
}


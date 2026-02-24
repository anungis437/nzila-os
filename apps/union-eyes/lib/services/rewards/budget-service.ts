/**
 * Budget Service
 * Handles budget envelope management, usage tracking, and reservations
 * 
 * Features:
 * - Budget envelope creation and management
 * - Real-time usage tracking with limit enforcement
 * - Budget reservations for pending awards
 * - Automatic expiration and cleanup of reservations
 */

import { db } from '@/db';
import {
  rewardBudgetEnvelopes,
  budgetReservations,
  type NewRewardBudgetEnvelope,
  type RewardBudgetEnvelope,
} from '@/db/schema';
import { eq, and, sql, lte, gte, desc, asc, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export interface BudgetCheckResult {
  hasEnoughBudget: boolean;
  availableBudget: number;
  reservedBudget: number;
  totalBudget: number;
  envelopeId?: string;
}

/**
 * Create a budget envelope
 */
export async function createBudgetEnvelope(
  data: NewRewardBudgetEnvelope
): Promise<RewardBudgetEnvelope> {
  const [envelope] = await db
    .insert(rewardBudgetEnvelopes)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .returning();

  return envelope;
}

/**
 * Get budget envelope by ID
 */
export async function getBudgetEnvelopeById(
  envelopeId: string,
  orgId: string
): Promise<RewardBudgetEnvelope | null> {
  const envelope = await db.query.rewardBudgetEnvelopes.findFirst({
    where: and(
      eq(rewardBudgetEnvelopes.id, envelopeId),
      eq(rewardBudgetEnvelopes.orgId, orgId)
    ),
  });

  return envelope || null;
}

/**
 * List budget envelopes for a program
 */
export async function listBudgetEnvelopes(
  programId: string,
  orgId: string,
  activeOnly = false
): Promise<RewardBudgetEnvelope[]> {
  const now = new Date();
  
  let conditions = and(
    eq(rewardBudgetEnvelopes.programId, programId),
    eq(rewardBudgetEnvelopes.orgId, orgId)
  );

  if (activeOnly) {
    conditions = and(
      conditions,
      lte(rewardBudgetEnvelopes.startsAt, now),
      gte(rewardBudgetEnvelopes.endsAt, now)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
  }

  const envelopes = await db.query.rewardBudgetEnvelopes.findMany({
    where: conditions,
    orderBy: [desc(rewardBudgetEnvelopes.startsAt)],
  });

  return envelopes;
}

/**
 * Update budget envelope
 */
export async function updateBudgetEnvelope(
  envelopeId: string,
  orgId: string,
  data: Partial<NewRewardBudgetEnvelope>
): Promise<RewardBudgetEnvelope> {
  const [updated] = await db
    .update(rewardBudgetEnvelopes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(rewardBudgetEnvelopes.id, envelopeId),
        eq(rewardBudgetEnvelopes.orgId, orgId)
      )
    )
    .returning();

  return updated;
}

/**
 * Check budget availability for a program
 * Returns true if there is an active envelope with sufficient credits
 */
export async function checkBudgetAvailability(
  programId: string,
  creditsNeeded: number
): Promise<boolean> {
  const now = new Date();

  const envelope = await db.query.rewardBudgetEnvelopes.findFirst({
    where: and(
      eq(rewardBudgetEnvelopes.programId, programId),
      eq(rewardBudgetEnvelopes.scopeType, 'org'),
      lte(rewardBudgetEnvelopes.startsAt, now),
      gte(rewardBudgetEnvelopes.endsAt, now)
    ),
    orderBy: [desc(rewardBudgetEnvelopes.createdAt)],
  });

  if (!envelope) {
    return true;
  }

  const available = envelope.amountLimit - envelope.amountUsed;
  return available >= creditsNeeded;
}

/**
 * Apply budget usage
 * @param amount Can be positive (usage) or negative (refund/revoke)
 */
export async function applyBudgetUsage(
  programId: string,
  amount: number
): Promise<void> {
  const now = new Date();

  const envelope = await db.query.rewardBudgetEnvelopes.findFirst({
    where: and(
      eq(rewardBudgetEnvelopes.programId, programId),
      eq(rewardBudgetEnvelopes.scopeType, 'org'),
      lte(rewardBudgetEnvelopes.startsAt, now),
      gte(rewardBudgetEnvelopes.endsAt, now)
    ),
    orderBy: [desc(rewardBudgetEnvelopes.createdAt)],
  });

  if (!envelope) {
    return;
  }

  await db
    .update(rewardBudgetEnvelopes)
    .set({
      amountUsed: sql`${rewardBudgetEnvelopes.amountUsed} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(rewardBudgetEnvelopes.id, envelope.id));
}

/**
 * Apply budget usage with limit enforcement
 */
export async function applyBudgetUsageChecked(
  programId: string,
  amount: number
): Promise<boolean> {
  if (amount <= 0) {
    await applyBudgetUsage(programId, amount);
    return true;
  }

  const now = new Date();

  const envelope = await db.query.rewardBudgetEnvelopes.findFirst({
    where: and(
      eq(rewardBudgetEnvelopes.programId, programId),
      eq(rewardBudgetEnvelopes.scopeType, 'org'),
      lte(rewardBudgetEnvelopes.startsAt, now),
      gte(rewardBudgetEnvelopes.endsAt, now)
    ),
    orderBy: [desc(rewardBudgetEnvelopes.createdAt)],
  });

  if (!envelope) {
    return true;
  }

  const [updated] = await db
    .update(rewardBudgetEnvelopes)
    .set({
      amountUsed: sql`${rewardBudgetEnvelopes.amountUsed} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(rewardBudgetEnvelopes.id, envelope.id),
        sql`${rewardBudgetEnvelopes.amountUsed} + ${amount} <= ${rewardBudgetEnvelopes.amountLimit}`
      )
    )
    .returning();

  return !!updated;
}

/**
 * Get budget usage summary
 */
export async function getBudgetUsageSummary(
  orgId: string,
  programId?: string
): Promise<Array<{
  envelopeId: string;
  envelopeName: string;
  used: number;
  limit: number;
  percentage: number;
  isActive: boolean;
}>> {
  const now = new Date();

  let whereClause = eq(rewardBudgetEnvelopes.orgId, orgId);
  if (programId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    whereClause = and(whereClause, eq(rewardBudgetEnvelopes.programId, programId)) as any;
  }

  const envelopes = await db.query.rewardBudgetEnvelopes.findMany({
    where: whereClause,
    orderBy: [desc(rewardBudgetEnvelopes.startsAt)],
  });

  return envelopes.map((envelope) => ({
    envelopeId: envelope.id,
    envelopeName: envelope.name,
    used: envelope.amountUsed,
    limit: envelope.amountLimit,
    percentage: Math.round((envelope.amountUsed / envelope.amountLimit) * 100),
    isActive: now >= envelope.startsAt && now <= envelope.endsAt,
  }));
}

// ============== BUDGET RESERVATION IMPLEMENTATION ==============

/**
 * Reserve budget for a pending award
 */
export async function reserveBudget(
  programId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  expiresInMinutes = 60 * 24
): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);

    const envelope = await db.query.rewardBudgetEnvelopes.findFirst({
      where: and(
        eq(rewardBudgetEnvelopes.programId, programId),
        eq(rewardBudgetEnvelopes.scopeType, 'org'),
        lte(rewardBudgetEnvelopes.startsAt, now),
        gte(rewardBudgetEnvelopes.endsAt, now)
      ),
      orderBy: [desc(rewardBudgetEnvelopes.createdAt)],
    });

    if (!envelope) {
      return { success: true };
    }

    const reservations = await db.query.budgetReservations.findMany({
      where: and(
        eq(budgetReservations.poolId, envelope.id),
        ne(budgetReservations.status, 'released'),
        ne(budgetReservations.status, 'expired')
      ),
    });

    const totalReserved = reservations.reduce((sum, r) => sum + (r.reservedAmount || 0), 0);
    const available = envelope.amountLimit - envelope.amountUsed - totalReserved;

    if (available < amount) {
      return { 
        success: false, 
        error: `Insufficient budget. Available: ${available}, Requested: ${amount}` 
      };
    }

    const reservationId = uuidv4();
    await db.insert(budgetReservations).values({
      id: reservationId,
      poolId: envelope.id,
      reservedAmount: amount,
      status: 'pending',
      referenceType,
      referenceId,
      expiresAt,
    });

    logger.info('[Budget] Reserved credits', {
      amount,
      referenceType,
      referenceId,
      programId,
    });
    return { success: true, reservationId };
  } catch (error) {
    logger.error('[Budget] Error reserving budget', {
      error,
      programId,
      referenceType,
      referenceId,
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Confirm a budget reservation (called when award is issued)
 */
export async function confirmBudgetReservation(
  reservationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const reservation = await db.query.budgetReservations.findFirst({
      where: eq(budgetReservations.id, reservationId),
    });

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    if (reservation.status !== 'pending') {
      return { success: false, error: `Reservation already ${reservation.status}` };
    }

    await db.update(budgetReservations)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(budgetReservations.id, reservationId));

    return { success: true };
  } catch (error) {
    logger.error('[Budget] Error confirming reservation', { error, reservationId });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Release reserved budget
 */
export async function releaseReservedBudget(
  reservationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const reservation = await db.query.budgetReservations.findFirst({
      where: eq(budgetReservations.id, reservationId),
    });

    if (!reservation) {
      return { success: false, error: 'Reservation not found' };
    }

    if (reservation.status === 'released') {
      return { success: true };
    }

    await db.update(budgetReservations)
      .set({ status: 'released', updatedAt: new Date() })
      .where(eq(budgetReservations.id, reservationId));

    return { success: true };
  } catch (error) {
    logger.error('[Budget] Error releasing reservation', { error, reservationId });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Release reservations by reference
 */
export async function releaseReservationsByReference(
  referenceType: string,
  referenceId: string
): Promise<{ released: number; error?: string }> {
  try {
    const reservations = await db.query.budgetReservations.findMany({
      where: and(
        eq(budgetReservations.referenceType, referenceType),
        eq(budgetReservations.referenceId, referenceId),
        ne(budgetReservations.status, 'released')
      ),
    });

    for (const reservation of reservations) {
      await db.update(budgetReservations)
        .set({ status: 'released', updatedAt: new Date() })
        .where(eq(budgetReservations.id, reservation.id));
    }

    return { released: reservations.length };
  } catch (error) {
    logger.error('[Budget] Error releasing reservations', {
      error,
      referenceType,
      referenceId,
    });
    return { 
      released: 0,
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get detailed budget status including reservations
 */
export async function getBudgetStatus(
  programId: string,
  orgId: string
): Promise<{
  envelope: RewardBudgetEnvelope | null;
  totalBudget: number;
  used: number;
  reserved: number;
  available: number;
  reservationCount: number;
}> {
  const now = new Date();

  const envelope = await db.query.rewardBudgetEnvelopes.findFirst({
    where: and(
      eq(rewardBudgetEnvelopes.programId, programId),
      eq(rewardBudgetEnvelopes.orgId, orgId),
      lte(rewardBudgetEnvelopes.startsAt, now),
      gte(rewardBudgetEnvelopes.endsAt, now)
    ),
  });

  if (!envelope) {
    return {
      envelope: null,
      totalBudget: 0,
      used: 0,
      reserved: 0,
      available: 0,
      reservationCount: 0,
    };
  }

  const reservations = await db.query.budgetReservations.findMany({
    where: and(
      eq(budgetReservations.poolId, envelope.id),
      ne(budgetReservations.status, 'released'),
      ne(budgetReservations.status, 'expired')
    ),
  });

  const totalReserved = reservations.reduce((sum, r) => sum + (r.reservedAmount || 0), 0);

  return {
    envelope,
    totalBudget: envelope.amountLimit,
    used: envelope.amountUsed,
    reserved: totalReserved,
    available: envelope.amountLimit - envelope.amountUsed - totalReserved,
    reservationCount: reservations.length,
  };
}

/**
 * Clean up expired reservations
 */
export async function cleanupExpiredReservations(): Promise<{
  cleaned: number;
  released: number;
}> {
  const now = new Date();

  const expiredReservations = await db.query.budgetReservations.findMany({
    where: and(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ne(budgetReservations.status, 'released' as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ne(budgetReservations.status, 'expired' as any),
      lte(budgetReservations.expiresAt, now)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any,
  });

  let released = 0;
  for (const reservation of expiredReservations) {
    await db.update(budgetReservations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(budgetReservations.id, reservation.id));
    released += reservation.reservedAmount || 0;
  }

  return {
    cleaned: expiredReservations.length,
    released,
  };
}

/**
 * Check budget with reservations
 */
export async function checkBudgetWithReservations(
  programId: string,
  orgId: string,
  requestedAmount: number
): Promise<BudgetCheckResult> {
  const status = await getBudgetStatus(programId, orgId);

  if (!status.envelope) {
    return {
      hasEnoughBudget: true,
      availableBudget: requestedAmount,
      reservedBudget: 0,
      totalBudget: requestedAmount,
    };
  }

  return {
    hasEnoughBudget: status.available >= requestedAmount,
    availableBudget: status.available,
    reservedBudget: status.reserved,
    totalBudget: status.totalBudget,
    envelopeId: status.envelope.id,
  };
}

/**
 * Get all active reservations
 */
export async function getActiveReservations(poolId?: string) {
  const _now = new Date();
  
  let whereClause = and(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ne(budgetReservations.status, 'released' as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ne(budgetReservations.status, 'expired' as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  if (poolId) {
    whereClause = and(whereClause, eq(budgetReservations.poolId, poolId));
  }

  return await db.query.budgetReservations.findMany({
    where: whereClause,
    orderBy: [asc(budgetReservations.expiresAt)],
  });
}


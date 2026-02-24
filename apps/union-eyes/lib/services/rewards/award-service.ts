/**
 * Award Service
 * Handles award lifecycle: creation, approval, issuance, revocation
 */

import { db } from '@/db';
import {
  recognitionAwards,
  recognitionAwardTypes,
  type RecognitionAward,
} from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { applyLedgerEntry } from './wallet-service';
import { applyBudgetUsage, applyBudgetUsageChecked } from './budget-service';

export interface CreateAwardOptions {
  orgId: string;
  programId: string;
  awardTypeId: string;
  recipientUserId: string;
  issuerUserId?: string;
  reason: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadataJson?: Record<string, any>;
}

export interface ApproveAwardOptions {
  awardId: string;
  orgId: string;
  approvedByUserId: string;
}

export interface IssueAwardOptions {
  awardId: string;
  orgId: string;
  approvedByUserId?: string; // For auto-approve flow
}

export interface RevokeAwardOptions {
  awardId: string;
  orgId: string;
  revokedByUserId: string;
  reason: string;
}

/**
 * Create a new award request
 * Auto-approves if award type doesn&apos;t require approval
 */
export async function createAwardRequest(
  options: CreateAwardOptions
): Promise<RecognitionAward> {
  const { orgId, awardTypeId, recipientUserId, issuerUserId, reason, metadataJson } = options;

  // Get award type to check approval requirements
  const awardType = await db.query.recognitionAwardTypes.findFirst({
    where: and(
      eq(recognitionAwardTypes.id, awardTypeId),
      eq(recognitionAwardTypes.orgId, orgId)
    ),
  });

  if (!awardType) {
    throw new Error('Award type not found');
  }

  // Determine initial status
  const initialStatus = awardType.requiresApproval ? 'pending' : 'approved';

  const [award] = await db
    .insert(recognitionAwards)
    .values({
      orgId,
      programId: awardType.programId,
      awardTypeId,
      recipientUserId,
      issuerUserId,
      reason,
      status: initialStatus,
      approvedAt: initialStatus === 'approved' ? new Date() : undefined,
      approvedByUserId: initialStatus === 'approved' ? issuerUserId : undefined,
      metadataJson,
      updatedAt: new Date(),
    })
    .returning();

  return award;
}

/**
 * Approve a pending award
 */
export async function approveAward(
  options: ApproveAwardOptions
): Promise<RecognitionAward> {
  const { awardId, orgId, approvedByUserId } = options;

  // Get current award
  const award = await db.query.recognitionAwards.findFirst({
    where: and(
      eq(recognitionAwards.id, awardId),
      eq(recognitionAwards.orgId, orgId)
    ),
  });

  if (!award) {
    throw new Error('Award not found');
  }

  if (award.status !== 'pending') {
    throw new Error(`Cannot approve award with status: ${award.status}`);
  }

  const [updated] = await db
    .update(recognitionAwards)
    .set({
      status: 'approved',
      approvedByUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(recognitionAwards.id, awardId),
        eq(recognitionAwards.orgId, orgId)
      )
    )
    .returning();

  return updated;
}

/**
 * Issue an approved award
 * Writes to wallet ledger and updates budget
 * This is a transactional operation
 */
export async function issueAward(
  options: IssueAwardOptions
): Promise<{
  award: RecognitionAward;
  newBalance: number;
}> {
  const { awardId, orgId } = options;

  return await db.transaction(async (tx) => {
    // Get award with award type
    const award = await tx.query.recognitionAwards.findFirst({
      where: and(
        eq(recognitionAwards.id, awardId),
        eq(recognitionAwards.orgId, orgId)
      ),
      with: {
        awardType: true,
      },
    });

    if (!award || !award.awardType) {
      throw new Error('Award or award type not found');
    }

    if (award.status !== 'approved') {
      throw new Error(`Cannot issue award with status: ${award.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const awardType = award.awardType as Record<string, any>;
    const creditAmount = awardType.defaultCreditAmount;

    // Apply ledger entry (earn credits)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ledgerEntry = await applyLedgerEntry(tx as any, {
      orgId: award.orgId,
      userId: award.recipientUserId,
      eventType: 'earn',
      amountCredits: creditAmount,
      sourceType: 'award',
      sourceId: award.id,
      memo: `Award: ${awardType.name}`,
    });

    // Apply budget usage with limit enforcement
    const budgetApplied = await applyBudgetUsageChecked(
      award.programId,
      creditAmount
    );

    if (!budgetApplied) {
      throw new Error('Insufficient budget to issue award');
    }

    // Update award status
    const [updatedAward] = await tx
      .update(recognitionAwards)
      .set({
        status: 'issued',
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(recognitionAwards.id, awardId))
      .returning();

    return {
      award: updatedAward,
      newBalance: ledgerEntry.balanceAfter,
    };
  });
}

/**
 * Revoke an issued award
 * Creates negative ledger entry and refunds budget
 */
export async function revokeAward(
  options: RevokeAwardOptions
): Promise<{
  award: RecognitionAward;
  newBalance: number;
}> {
  const { awardId, orgId, revokedByUserId, reason } = options;

  return await db.transaction(async (tx) => {
    // Get award with award type
    const award = await tx.query.recognitionAwards.findFirst({
      where: and(
        eq(recognitionAwards.id, awardId),
        eq(recognitionAwards.orgId, orgId)
      ),
      with: {
        awardType: true,
      },
    });

    if (!award) {
      throw new Error('Award not found');
    }

    if (award.status !== 'issued') {
      throw new Error(`Cannot revoke award with status: ${award.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const awardType = award.awardType as Record<string, any>;
    const creditAmount = awardType.defaultCreditAmount;

    // Apply negative ledger entry (revoke credits)
    const ledgerEntry = await applyLedgerEntry(tx, {
      orgId: award.orgId,
      userId: award.recipientUserId,
      eventType: 'revoke',
      amountCredits: -creditAmount,
      sourceType: 'award',
      sourceId: award.id,
      memo: `Award revoked: ${reason}`,
    });

    // Refund budget (negative usage)
    await applyBudgetUsage(award.programId, -creditAmount);

    // Update award status
    const [updatedAward] = await tx
      .update(recognitionAwards)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
        metadataJson: {
          ...((award.metadataJson || {}) as Record<string, unknown>),
          revokedBy: revokedByUserId,
          revokedReason: reason,
          revokedAt: new Date().toISOString(),
        },
      })
      .where(eq(recognitionAwards.id, awardId))
      .returning();

    return {
      award: updatedAward,
      newBalance: ledgerEntry.balanceAfter,
    };
  });
}

/**
 * Reject a pending award
 */
export async function rejectAward(
  awardId: string,
  orgId: string,
  rejectedByUserId: string,
  reason: string
): Promise<RecognitionAward> {
  const [updated] = await db
    .update(recognitionAwards)
    .set({
      status: 'rejected',
      updatedAt: new Date(),
      metadataJson: {
        rejectedBy: rejectedByUserId,
        rejectedReason: reason,
        rejectedAt: new Date().toISOString(),
      },
    })
    .where(
      and(
        eq(recognitionAwards.id, awardId),
        eq(recognitionAwards.orgId, orgId),
        eq(recognitionAwards.status, 'pending')
      )
    )
    .returning();

  if (!updated) {
    throw new Error('Award not found or cannot be rejected');
  }

  return updated;
}

/**
 * Get award by ID
 */
export async function getAwardById(
  awardId: string,
  orgId: string
): Promise<RecognitionAward | null> {
  const award = await db.query.recognitionAwards.findFirst({
    where: and(
      eq(recognitionAwards.id, awardId),
      eq(recognitionAwards.orgId, orgId)
    ),
    with: {
      awardType: true,
      program: true,
    },
  });

  return award || null;
}

/**
 * List awards by status
 */
export async function listAwardsByStatus(
  orgId: string,
  statuses: Array<'pending' | 'approved' | 'issued' | 'rejected' | 'revoked'>,
  limit = 50,
  offset = 0
): Promise<RecognitionAward[]> {
  const awards = await db.query.recognitionAwards.findMany({
    where: and(
      eq(recognitionAwards.orgId, orgId),
      inArray(recognitionAwards.status, statuses)
    ),
    with: {
      awardType: true,
      program: true,
    },
    orderBy: [desc(recognitionAwards.createdAt)],
    limit,
    offset,
  });

  return awards;
}

/**
 * List awards for a specific user (recipient)
 */
export async function listUserAwards(
  orgId: string,
  userId: string,
  limit = 50,
  offset = 0
): Promise<RecognitionAward[]> {
  const awards = await db.query.recognitionAwards.findMany({
    where: and(
      eq(recognitionAwards.orgId, orgId),
      eq(recognitionAwards.recipientUserId, userId)
    ),
    with: {
      awardType: true,
      program: true,
    },
    orderBy: [desc(recognitionAwards.createdAt)],
    limit,
    offset,
  });

  return awards;
}


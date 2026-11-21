import { randomUUID } from 'node:crypto'
import { activeMembershipSource } from '@/lib/authority/store/active-membership-source'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { isPrincipalId, isUuid, sessionActor } from '@/lib/authority/store/executor'
import { MAX_PENDING_PEER_NOMINATIONS } from '@/db/auth/reward-nomination-guards'
import { requireRewardsInstitutionalAuthority } from '@/lib/rewards/credit-authority'
/**
 * Award Service
 * Handles award lifecycle: creation, approval, issuance, revocation
 */

import { db } from '@/db'
import {
  recognitionAwards,
  recognitionAwardTypes,
  recognitionPrograms,
  type RecognitionAward,
} from '@/db/schema'
import { eq, and, count, inArray, desc, sql } from 'drizzle-orm'
import { applyLedgerEntry } from './wallet-service'
import { applyBudgetUsage, applyBudgetUsageChecked } from './budget-service'
import { auditRewards, rewardsActor } from './audit'
import { UserFacingError } from '@/lib/errors/user-facing-error'

/** How many nominations a member can have waiting for review at once: the administrators' queue is not theirs to fill. */
export const MAX_PENDING_NOMINATIONS_PER_MEMBER = MAX_PENDING_PEER_NOMINATIONS

export interface NominatePeerOptions {
  orgId: string
  awardTypeId: string
  recipientUserId: string
  nominatorUserId: string
  reason: string
  /** Run inside an existing transaction (savepoint) instead of opening a new one on another connection. */
  executor?: typeof db
}

export interface CreateAwardOptions {
  orgId: string
  programId: string
  awardTypeId: string
  recipientUserId: string
  issuerUserId?: string
  reason: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadataJson?: Record<string, any>
  /** Run inside an existing transaction (savepoint) instead of opening a new one on another connection. */
  executor?: typeof db
}

export interface ApproveAwardOptions {
  awardId: string
  orgId: string
  approvedByUserId: string
}

export interface IssueAwardOptions {
  awardId: string
  orgId: string
  approvedByUserId?: string // For auto-approve flow
  /** Run inside an existing transaction (savepoint) instead of opening a new one on another connection. */
  executor?: typeof db
}

export interface RevokeAwardOptions {
  awardId: string
  orgId: string
  revokedByUserId: string
  reason: string
}

/**
 * Create a new award request
 * Auto-approves if award type doesn&apos;t require approval
 */
export async function createAwardRequest(options: CreateAwardOptions): Promise<RecognitionAward> {
  requireRewardsInstitutionalAuthority()
  const { orgId, awardTypeId, recipientUserId, issuerUserId, reason, metadataJson } = options
  const runner = options.executor ?? db

  // Get award type to check approval requirements
  const awardType = await runner.query.recognitionAwardTypes.findFirst({
    where: and(eq(recognitionAwardTypes.id, awardTypeId), eq(recognitionAwardTypes.orgId, orgId)),
  })

  if (!awardType) {
    throw new UserFacingError('Award type not found')
  }

  // Determine initial status
  const initialStatus = awardType.requiresApproval ? 'pending' : 'approved'

  return await runner.transaction(async (tx) => {
    const [award] = await tx
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
      .returning()

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(issuerUserId, 'system:rewards-automation'),
      action: 'rewards.award.create',
      resourceType: 'recognition_awards',
      resourceId: award.id,
      details: { awardTypeId, recipientUserId, status: initialStatus },
    })
    return award
  })
}

/**
 * A member nominates a colleague for a peer award. Always a request for review: the award is created pending whatever the type says about
 * approval, because a nomination is somebody's opinion, not an administrator's decision; credits move only when an administrator approves and
 * issues it. The nominator is the issuer on the row, the award type must be a peer one of an active program of the organization, and a
 * nominator cannot nominate themselves, nominate the same colleague for the same award twice while the first waits, or keep more than
 * MAX_PENDING_NOMINATIONS_PER_MEMBER waiting.
 */
export type PeerNomination = Pick<
  RecognitionAward,
  | 'id'
  | 'orgId'
  | 'programId'
  | 'awardTypeId'
  | 'recipientUserId'
  | 'issuerUserId'
  | 'reason'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
>

export async function createPeerNomination(options: NominatePeerOptions): Promise<PeerNomination> {
  const { recipientUserId, nominatorUserId, reason } = options
  if (
    !isUuid(options.orgId) ||
    !isUuid(options.awardTypeId) ||
    !isPrincipalId(nominatorUserId) ||
    !isPrincipalId(recipientUserId)
  )
    throw new UserFacingError('Recognition context required')
  const orgId = options.orgId.toLowerCase(),
    awardTypeId = options.awardTypeId.toLowerCase()
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500)
    throw new UserFacingError('A short recognition message is required')
  if (recipientUserId === nominatorUserId) throw new UserFacingError('You cannot nominate yourself')
  const runner = options.executor ?? db

  return runner.transaction(async (tx) => {
    const exec = drizzleExecutor(tx)
    if ((await sessionActor(exec)) !== nominatorUserId)
      throw new UserFacingError('Recognition actor changed')
    // Same sorted principal/resource protocol as identity/authority revocation.
    // The issuer lock also serializes this member's duplicate and pending-cap checks.
    await exec.query(
      `SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lock_key,0))
      FROM (SELECT DISTINCT 0 AS tier,'ue.case-mail.principal:'||person AS lock_key FROM unnest($1::text[]) person
        UNION SELECT 1 AS tier,'ue.case-mail.resource:'||$2::text AS lock_key) locks ORDER BY tier,lock_key`,
      [[...new Set([nominatorUserId, recipientUserId])].sort(), awardTypeId],
    )
    const memberships = await activeMembershipSource(exec, orgId, [
      nominatorUserId,
      recipientUserId,
    ])
    for (const principal of [nominatorUserId, recipientUserId]) {
      const matches = memberships.filter(
        (row) => row.userId === principal && row.organizationId === orgId,
      )
      if (matches.length !== 1 || matches[0].status !== 'active')
        throw new UserFacingError('Recognition requires current members of this organization')
    }
    const awardType = await tx.query.recognitionAwardTypes.findFirst({
      columns: { id: true, orgId: true, programId: true, kind: true },
      where: and(eq(recognitionAwardTypes.id, awardTypeId), eq(recognitionAwardTypes.orgId, orgId)),
    })
    if (!awardType || awardType.kind !== 'peer') throw new UserFacingError('Award type not found')
    const program = await tx.query.recognitionPrograms.findFirst({
      columns: { id: true },
      where: and(
        eq(recognitionPrograms.id, awardType.programId),
        eq(recognitionPrograms.orgId, orgId),
        eq(recognitionPrograms.status, 'active'),
      ),
    })
    if (!program) throw new UserFacingError('This recognition program is not accepting nominations')
    const waiting = and(
      eq(recognitionAwards.orgId, orgId),
      eq(recognitionAwards.issuerUserId, nominatorUserId),
      eq(recognitionAwards.status, 'pending'),
    )
    const [duplicate] = await tx
      .select({ id: recognitionAwards.id })
      .from(recognitionAwards)
      .where(
        and(
          waiting,
          eq(recognitionAwards.recipientUserId, recipientUserId),
          eq(recognitionAwards.awardTypeId, awardTypeId),
        ),
      )
      .limit(1)
    if (duplicate)
      throw new UserFacingError(
        'You have already nominated this colleague for this award; it is waiting for review',
      )
    const [{ pending }] = await tx
      .select({ pending: count() })
      .from(recognitionAwards)
      .where(waiting)
    if (pending >= MAX_PENDING_NOMINATIONS_PER_MEMBER)
      throw new UserFacingError(
        'You have too many nominations waiting for review; wait for a decision on one before nominating again',
      )

    // Explicit columns avoid INSERT privileges on even DEFAULT approval fields.
    // No caller input can assign approval, issuance, amount, balance or provenance.
    const result = await exec.query<
      Omit<PeerNomination, 'createdAt' | 'updatedAt'> & {
        createdAt: string | Date
        updatedAt: string | Date
      }
    >(
      `
      INSERT INTO public.recognition_awards
        (id,org_id,program_id,award_type_id,recipient_user_id,issuer_user_id,reason,status,metadata_json,updated_at)
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,'pending','{"nomination":true}'::jsonb,pg_catalog.statement_timestamp())
      RETURNING id,org_id AS "orgId",program_id AS "programId",award_type_id AS "awardTypeId",
        recipient_user_id AS "recipientUserId",issuer_user_id AS "issuerUserId",reason,status,
        created_at AS "createdAt",updated_at AS "updatedAt"`,
      [
        randomUUID(),
        orgId,
        program.id,
        awardType.id,
        recipientUserId,
        nominatorUserId,
        reason.trim(),
      ],
    )
    if (result.rows.length !== 1) throw new Error('Recognition nomination was not stored')
    const row = result.rows[0]
    const award: PeerNomination = {
      ...row,
      createdAt:
        row.createdAt instanceof Date ? new Date(row.createdAt.getTime()) : new Date(row.createdAt),
      updatedAt:
        row.updatedAt instanceof Date ? new Date(row.updatedAt.getTime()) : new Date(row.updatedAt),
    }
    if (!Number.isFinite(award.createdAt.getTime()) || !Number.isFinite(award.updatedAt.getTime()))
      throw new Error('Invalid nomination clock')
    await auditRewards(tx, {
      organizationId: orgId,
      userId: nominatorUserId,
      action: 'rewards.award.nominate',
      resourceType: 'recognition_awards',
      resourceId: award.id,
      details: { awardTypeId, recipientUserId, status: 'pending' },
    })
    return award
  })
}

/**
 * Approve a pending award
 */
export async function approveAward(options: ApproveAwardOptions): Promise<RecognitionAward> {
  requireRewardsInstitutionalAuthority()
  const { awardId, orgId, approvedByUserId } = options

  // Get current award
  const award = await db.query.recognitionAwards.findFirst({
    where: and(eq(recognitionAwards.id, awardId), eq(recognitionAwards.orgId, orgId)),
  })

  if (!award) {
    throw new UserFacingError('Award not found')
  }

  if (award.status !== 'pending') {
    throw new UserFacingError(`Cannot approve award with status: ${award.status}`)
  }

  return await db.transaction(async (tx) => {
    const [updated] = await tx
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
          eq(recognitionAwards.orgId, orgId),
          eq(recognitionAwards.status, 'pending'),
        ),
      )
      .returning()
    if (!updated) throw new UserFacingError('Cannot approve award: it was changed concurrently')

    await auditRewards(tx, {
      organizationId: orgId,
      userId: approvedByUserId,
      action: 'rewards.award.approve',
      resourceType: 'recognition_awards',
      resourceId: awardId,
      details: { recipientUserId: award.recipientUserId },
    })
    return updated
  })
}

/**
 * Issue an approved award
 * Writes to wallet ledger and updates budget
 * This is a transactional operation
 */
export async function issueAward(options: IssueAwardOptions): Promise<{
  award: RecognitionAward
  newBalance: number
}> {
  requireRewardsInstitutionalAuthority()
  const { awardId, orgId } = options

  return await (options.executor ?? db).transaction(async (tx) => {
    const award = await tx.query.recognitionAwards.findFirst({
      where: and(eq(recognitionAwards.id, awardId), eq(recognitionAwards.orgId, orgId)),
      with: {
        awardType: true,
      },
    })

    if (!award || !award.awardType) {
      throw new UserFacingError('Award or award type not found')
    }

    if (award.status !== 'approved') {
      throw new UserFacingError(`Cannot issue award with status: ${award.status}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const awardType = award.awardType as Record<string, any>
    const creditAmount = awardType.defaultCreditAmount

    // Apply ledger entry (earn credits)
    const ledgerEntry = await applyLedgerEntry(tx, {
      orgId: award.orgId,
      userId: award.recipientUserId,
      eventType: 'earn',
      amountCredits: creditAmount,
      sourceType: 'award',
      sourceId: award.id,
      memo: `Award: ${awardType.name}`,
    })

    // Apply budget usage with limit enforcement (same transaction as the
    // ledger entry and award update, scoped to this award's own org).
    const budgetApplied = await applyBudgetUsageChecked(
      tx,
      award.programId,
      award.orgId,
      creditAmount,
    )

    if (!budgetApplied) {
      throw new UserFacingError('Insufficient budget to issue award')
    }

    // Update award status
    const [updatedAward] = await tx
      .update(recognitionAwards)
      .set({
        status: 'issued',
        issuedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(recognitionAwards.id, awardId),
          eq(recognitionAwards.orgId, orgId),
          eq(recognitionAwards.status, 'approved'),
        ),
      )
      .returning()
    if (!updatedAward) throw new UserFacingError('Cannot issue award: it was changed concurrently')

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(options.approvedByUserId, 'system:rewards-automation'),
      action: 'rewards.award.issue',
      resourceType: 'recognition_awards',
      resourceId: awardId,
      details: { recipientUserId: award.recipientUserId, credits: creditAmount },
    })

    return {
      award: updatedAward,
      newBalance: ledgerEntry.balanceAfter,
    }
  })
}

/**
 * Revoke an issued award
 * Creates negative ledger entry and refunds budget
 */
export async function revokeAward(options: RevokeAwardOptions): Promise<{
  award: RecognitionAward
  newBalance: number
}> {
  requireRewardsInstitutionalAuthority()
  const { awardId, orgId, revokedByUserId, reason } = options

  return await db.transaction(async (tx) => {
    // Get award with award type
    const award = await tx.query.recognitionAwards.findFirst({
      where: and(eq(recognitionAwards.id, awardId), eq(recognitionAwards.orgId, orgId)),
      with: {
        awardType: true,
      },
    })

    if (!award) {
      throw new UserFacingError('Award not found')
    }

    if (award.status !== 'issued') {
      throw new UserFacingError(`Cannot revoke award with status: ${award.status}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const awardType = award.awardType as Record<string, any>
    const creditAmount = awardType.defaultCreditAmount

    // Apply negative ledger entry (revoke credits)
    const ledgerEntry = await applyLedgerEntry(tx, {
      orgId: award.orgId,
      userId: award.recipientUserId,
      eventType: 'revoke',
      amountCredits: -creditAmount,
      sourceType: 'award',
      sourceId: award.id,
      memo: `Award revoked: ${reason}`,
    })

    // Refund budget (negative usage), same transaction, scoped to this award's own org.
    await applyBudgetUsage(tx, award.programId, award.orgId, -creditAmount)

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
      .where(
        and(
          eq(recognitionAwards.id, awardId),
          eq(recognitionAwards.orgId, orgId),
          eq(recognitionAwards.status, 'issued'),
        ),
      )
      .returning()
    if (!updatedAward) throw new UserFacingError('Cannot revoke award: it was changed concurrently')

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(revokedByUserId),
      action: 'rewards.award.revoke',
      resourceType: 'recognition_awards',
      resourceId: awardId,
      details: { recipientUserId: award.recipientUserId, credits: creditAmount, reason },
    })

    return {
      award: updatedAward,
      newBalance: ledgerEntry.balanceAfter,
    }
  })
}

/**
 * Reject a pending award
 */
export async function rejectAward(
  awardId: string,
  orgId: string,
  rejectedByUserId: string,
  reason: string,
): Promise<RecognitionAward> {
  requireRewardsInstitutionalAuthority()
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(recognitionAwards)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
        // Added to what the row already records (a nomination marks itself), not instead of it.
        metadataJson: sql`coalesce(${recognitionAwards.metadataJson}, '{}'::jsonb) || ${JSON.stringify(
          {
            rejectedBy: rejectedByUserId,
            rejectedReason: reason,
            rejectedAt: new Date().toISOString(),
          },
        )}::jsonb`,
      })
      .where(
        and(
          eq(recognitionAwards.id, awardId),
          eq(recognitionAwards.orgId, orgId),
          eq(recognitionAwards.status, 'pending'),
        ),
      )
      .returning()

    if (!updated) {
      throw new UserFacingError('Award not found or cannot be rejected')
    }

    await auditRewards(tx, {
      organizationId: orgId,
      userId: rewardsActor(rejectedByUserId),
      action: 'rewards.award.reject',
      resourceType: 'recognition_awards',
      resourceId: awardId,
      details: { reason },
    })
    return updated
  })
}

/**
 * Get award by ID
 */
export async function getAwardById(
  awardId: string,
  orgId: string,
): Promise<RecognitionAward | null> {
  requireRewardsInstitutionalAuthority()
  const award = await db.query.recognitionAwards.findFirst({
    where: and(eq(recognitionAwards.id, awardId), eq(recognitionAwards.orgId, orgId)),
    with: {
      awardType: true,
      program: true,
    },
  })

  return award || null
}

/**
 * List awards by status
 */
export async function listAwardsByStatus(
  orgId: string,
  statuses: Array<'pending' | 'approved' | 'issued' | 'rejected' | 'revoked'>,
  limit = 50,
  offset = 0,
): Promise<RecognitionAward[]> {
  requireRewardsInstitutionalAuthority()
  const awards = await db.query.recognitionAwards.findMany({
    where: and(eq(recognitionAwards.orgId, orgId), inArray(recognitionAwards.status, statuses)),
    with: {
      awardType: true,
      program: true,
    },
    orderBy: [desc(recognitionAwards.createdAt)],
    limit,
    offset,
  })

  return awards
}

/**
 * List awards for a specific user (recipient). Only awards that were decided for the person: a nomination that is still waiting for review,
 * was rejected or is only approved is between its nominator and the administrators, and the person it names is not told about it.
 */
export async function listUserAwards(
  orgId: string,
  userId: string,
  limit = 50,
  offset = 0,
): Promise<RecognitionAward[]> {
  requireRewardsInstitutionalAuthority()
  const awards = await db.query.recognitionAwards.findMany({
    where: and(
      eq(recognitionAwards.orgId, orgId),
      eq(recognitionAwards.recipientUserId, userId),
      inArray(recognitionAwards.status, ['issued', 'revoked']),
    ),
    with: {
      awardType: true,
      program: true,
    },
    orderBy: [desc(recognitionAwards.createdAt)],
    limit,
    offset,
  })

  return awards
}

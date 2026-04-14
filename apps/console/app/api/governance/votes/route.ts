/**
 * API — Governance Vote Casting
 * POST /api/governance/votes — cast a vote on a governance motion
 *
 * Policy-enforced: quorum and self-vote rules (voting-quorum policy).
 * Emits audit event on every attempt (allow or deny).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'
import { enforcePolicies } from '@/lib/policy-enforcement'
import { createLogger } from '@nzila/os-core'
import { platformDb } from '@nzila/db/platform'
import { votes } from '@nzila/db/schema'

const logger = createLogger('api:governance:votes')

const CastVoteSchema = z.object({
  orgId: z.string().uuid(),
  motionId: z.string().uuid(),
  motionType: z.string().min(1),
  vote: z.enum(['for', 'against', 'abstain']),
  /** Current quorum percentage (0-100) — provided by client from live tally */
  quorumPercent: z.number().min(0).max(100),
  /** Whether the voter is also the motion initiator */
  isInitiatorVoting: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateUser()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const parsed = CastVoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { orgId, motionId, motionType, vote, quorumPercent, isInitiatorVoting } =
      parsed.data

    // ── Policy enforcement gate ──────────────────────────────────────────
    const policyResult = await enforcePolicies({
      action: 'vote.cast',
      resource: '/api/governance/votes',
      actor: {
        userId: auth.userId,
        roles: [auth.platformRole],
      },
      context: {
        quorumPercent,
        isInitiatorVoting,
        motionType,
        vote,
      },
      orgId,
      environment: process.env.NODE_ENV ?? 'development',
    })

    if (policyResult.blocked) {
      logger.warn('Vote denied by policy', {
        userId: auth.userId,
        motionId,
        reason: policyResult.reason,
      })

      await recordAuditEvent({
        orgId,
        targetType: 'governance_vote',
        targetId: motionId,
        action: 'vote.denied_by_policy',
        actorClerkUserId: auth.userId,
        afterJson: {
          vote,
          motionType,
          reason: policyResult.reason,
          policyEnforced: true,
        },
      })

      return NextResponse.json(
        {
          error: 'Vote denied by policy',
          detail: policyResult.reason,
          policyEnforced: true,
        },
        { status: 403 },
      )
    }

    // ── Vote recording ───────────────────────────────────────────────────
    const choiceMap = { for: 'yes', against: 'no', abstain: 'abstain' } as const
    const [voteRecord] = await platformDb
      .insert(votes)
      .values({
        orgId,
        approvalId: motionId,
        voterPersonId: auth.userId,
        choice: choiceMap[vote],
      })
      .returning()

    await recordAuditEvent({
      orgId,
      targetType: 'governance_vote',
      targetId: motionId,
      action: 'vote.cast',
      actorClerkUserId: auth.userId,
      afterJson: {
        vote,
        motionType,
        quorumPercent,
        policyEnforced: true,
      },
    })

    logger.info('Vote cast', {
      userId: auth.userId,
      motionId,
      vote,
    })

    return NextResponse.json(voteRecord, { status: 201 })
  } catch (err) {
    logger.error('[Governance Vote Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

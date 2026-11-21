/**
 * API — Governance Vote Casting
 * POST /api/governance/votes — cast a vote on a governance motion
 *
 * The stored model does not bind canonical voters, a verified electorate or
 * authoritative quorum. Authenticated, valid requests remain unavailable
 * until those institutional sources exist. Historical votes remain intact.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser } from '@/lib/api-guards'


import { createLogger } from '@nzila/os-core'



const logger = createLogger('api:governance:votes')

const CastVoteSchema = z.object({
  orgId: z.guid(),
  motionId: z.guid(),
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

    return NextResponse.json(
      { error: 'Verified institutional voting is unavailable', code: 'VERIFIED_VOTING_SOURCE_UNAVAILABLE' },
      { status: 501 },
    )
  } catch (err) {
    logger.error('[Governance Vote Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

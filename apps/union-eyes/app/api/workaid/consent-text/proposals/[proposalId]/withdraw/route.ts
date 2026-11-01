/**
 * POST /api/workaid/consent-text/proposals/[proposalId]/withdraw
 * The proposer withdraws an open proposal. Withdrawn text is not consent wording.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { withdrawConsentWordingProposal } from '@/lib/authority/store/workaid-disclosure'
import { workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  try {
    const { proposalId } = await params
    if (!z.guid().safeParse(proposalId).success) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid proposal id.' }, { status: 400 })
    const actor = await getCaseActor()
    await withRLSContext(async (tx) =>
      withdrawConsentWordingProposal(drizzleExecutor(tx), kernelDeps, { organizationId: actor.organizationId, proposerUserId: actor.userId, proposalId }),
    )
    return NextResponse.json({ success: true, withdrawn: true, current: false })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

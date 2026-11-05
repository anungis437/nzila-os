/**
 * POST /api/workaid/consent-text/proposals/[proposalId]/adopt
 * A different executive adopts the stored proposal. The request body is not the wording.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { adoptConsentWording } from '@/lib/authority/store/workaid-disclosure'
import { workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  try {
    const { proposalId } = await params
    if (!z.guid().safeParse(proposalId).success) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid proposal id.' }, { status: 400 })
    const actor = await getCaseActor()
    const result = await withRLSContext(async (tx) =>
      adoptConsentWording(drizzleExecutor(tx), kernelDeps, { organizationId: actor.organizationId, adopterUserId: actor.userId, proposalId }),
    )
    return NextResponse.json({ success: true, ...result, current: true })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

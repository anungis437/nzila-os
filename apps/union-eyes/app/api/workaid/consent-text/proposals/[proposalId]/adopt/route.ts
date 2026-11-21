/**
 * POST /api/workaid/consent-text/proposals/[proposalId]/adopt — retained WorkAid wording workflow, deferred from the base
 * release. Validates the proposal id (400 when malformed), authenticates the caller's organization membership, then
 * answers 501 WORKAID_WORDING_DEFERRED. It never reaches SQL or the authority store.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { workAidErrorResponse, workAidWordingDeferredResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  try {
    const { proposalId } = await params
    if (!z.guid().safeParse(proposalId).success) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid proposal id.' }, { status: 400 })
    await getCaseActor()
    return workAidWordingDeferredResponse()
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

/**
 * /api/workaid/consent-text/proposals
 *   GET  — open wording proposals for an executive who holds office. A proposal is not consent text.
 *   POST — that executive records institution-supplied wording. The body is not authored here.
 * Nothing becomes current until a different executive adopts it.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { listOpenConsentWordingProposals, proposeConsentWording } from '@/lib/authority/store/workaid-disclosure'
import { parseBody, workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

const proposeSchema = z.object({
  version: z.string().trim().min(1).max(64),
  body: z.string().trim().min(1).max(8000),
})

export async function GET() {
  try {
    const actor = await getCaseActor()
    const proposals = await withRLSContext(async (tx) =>
      listOpenConsentWordingProposals(drizzleExecutor(tx), kernelDeps, { organizationId: actor.organizationId, reviewerUserId: actor.userId }),
    )
    return NextResponse.json({
      success: true,
      proposals: proposals.map((row) => ({ ...row, proposedAt: row.proposedAt.toISOString() })),
    })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCaseActor()
    const body = await parseBody(request, proposeSchema)
    if (!body.ok) return body.response
    const proposalId = await withRLSContext(async (tx) =>
      proposeConsentWording(drizzleExecutor(tx), kernelDeps, {
        organizationId: actor.organizationId,
        proposerUserId: actor.userId,
        version: body.data.version,
        body: body.data.body,
      }),
    )
    return NextResponse.json({ success: true, proposalId, adopted: false }, { status: 201 })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

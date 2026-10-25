/**
 * /api/workaid/consents
 *   GET  — the authenticated member's own consents, referral state and document authorisations.
 *   POST — the member grants explicit, informed, scoped, time-limited consent for one of their own cases.
 * The consenting member is the session principal. A consent authorises nothing by itself and reaches no counsel.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { grantWorkAidConsent, listMemberWorkAidConsents } from '@/lib/authority/store/workaid-disclosure'
import { COUNSEL_SIDE_NOTICE, parseBody, workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

const grantSchema = z.object({
  caseId: z.string().uuid(),
  categories: z.array(z.string().min(1).max(64)).min(1).max(8),
  purpose: z.string().trim().min(1).max(500),
  textVersion: z.string().min(1).max(64),
  acknowledgedTextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  expiresAt: z.string().datetime(),
})

export async function GET() {
  try {
    const actor = await getCaseActor()
    const consents = await withRLSContext(async (tx) => listMemberWorkAidConsents(drizzleExecutor(tx), kernelDeps, { organizationId: actor.organizationId, memberUserId: actor.userId }))
    return NextResponse.json({ success: true, consents })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCaseActor()
    const body = await parseBody(request, grantSchema)
    if (!body.ok) return body.response
    const result = await withRLSContext(async (tx) =>
      grantWorkAidConsent(drizzleExecutor(tx), kernelDeps, {
        organizationId: actor.organizationId,
        memberUserId: actor.userId,
        caseId: body.data.caseId,
        categories: body.data.categories,
        purpose: body.data.purpose,
        textVersion: body.data.textVersion,
        acknowledgedTextSha256: body.data.acknowledgedTextSha256,
        expiresAt: new Date(body.data.expiresAt),
      }),
    )
    return NextResponse.json({ success: true, ...result, ...COUNSEL_SIDE_NOTICE }, { status: 201 })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

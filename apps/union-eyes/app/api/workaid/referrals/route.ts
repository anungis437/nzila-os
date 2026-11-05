/**
 * /api/workaid/referrals
 *   GET  ?caseId=… — consents the authenticated principal may refer today, and referrals already recorded
 *                    on that case when the kernel still allows the same action. Neither list names the member.
 *   POST          — a member (their own case) or an authorised representative refers a consented matter.
 * The member and the case come from the consent record, never from the request. The kernel decides; a recused,
 * removed or unrelated representative is refused. A recorded referral is a union-side record: it is NOT delivery to
 * counsel and NOT counsel acceptance (counsel-side activation and key custody UE-CONV-G-003 are external).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { listCaseWorkAidReferrals, listReferableWorkAidConsents, referMatterToWorkAid } from '@/lib/authority/store/workaid-disclosure'
import { COUNSEL_SIDE_NOTICE, parseBody, workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

const referSchema = z.object({
  matterId: z.guid(),
  categories: z.array(z.string().min(1).max(64)).min(1).max(8).optional(),
})

export async function GET(request: Request) {
  try {
    const caseId = new URL(request.url).searchParams.get('caseId')
    if (!z.guid().safeParse(caseId).success) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'caseId must be a uuid.' }, { status: 400 })
    const actor = await getCaseActor()
    const { referable, recorded } = await withRLSContext(async (tx) => {
      const exec = drizzleExecutor(tx)
      const input = { organizationId: actor.organizationId, actorUserId: actor.userId, caseId: caseId as string }
      const referable = await listReferableWorkAidConsents(exec, kernelDeps, input)
      const recorded = await listCaseWorkAidReferrals(exec, kernelDeps, input)
      return { referable, recorded }
    })
    return NextResponse.json({ success: true, referable, recorded })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getCaseActor()
    const body = await parseBody(request, referSchema)
    if (!body.ok) return body.response
    const result = await withRLSContext(async (tx) =>
      referMatterToWorkAid(drizzleExecutor(tx), kernelDeps, { organizationId: actor.organizationId, referrerUserId: actor.userId, matterId: body.data.matterId, categories: body.data.categories }),
    )
    return NextResponse.json({ success: true, ...result, ...COUNSEL_SIDE_NOTICE }, { status: 201 })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

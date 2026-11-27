/**
 * /api/workaid/consent-text/proposals — retained WorkAid wording workflow, deferred from the base release.
 *   GET  — authenticates the caller's organization membership, then answers 501 WORKAID_WORDING_DEFERRED.
 *   POST — authenticates, validates the released proposal input contract (400 when malformed), then answers 501.
 * Neither handler reaches SQL or the authority store; nothing is proposed or adopted.
 */
import { z } from 'zod'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { parseBody, workAidErrorResponse, workAidWordingDeferredResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

const proposeSchema = z.object({
  version: z.string().trim().min(1).max(64),
  body: z.string().trim().min(1).max(8000),
})

export async function GET() {
  try {
    await getCaseActor()
    return workAidWordingDeferredResponse()
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    await getCaseActor()
    const body = await parseBody(request, proposeSchema)
    if (!body.ok) return body.response
    return workAidWordingDeferredResponse()
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

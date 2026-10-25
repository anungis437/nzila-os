/**
 * POST /api/workaid/shares — release categories and/or per-document authorisations toward counsel on a referred matter.
 * The kernel decides `workaid:refer` for exactly the categories requested (consent scope, relationship, recusal),
 * and each document needs a live authorisation. Recorded on the union side only: no counsel-side system is connected
 * and counsel can read a share only through the counsel verifier port, which this repository does not configure.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { createWorkAidShare } from '@/lib/authority/store/workaid-disclosure'
import { COUNSEL_SIDE_NOTICE, parseBody, workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

const schema = z.object({
  matterId: z.string().uuid(),
  categories: z.array(z.string().min(1).max(64)).max(8).optional(),
  documentAuthorisationIds: z.array(z.string().uuid()).max(100).optional(),
})

export async function POST(request: Request) {
  try {
    const actor = await getCaseActor()
    const body = await parseBody(request, schema)
    if (!body.ok) return body.response
    const shareIds = await withRLSContext(async (tx) =>
      createWorkAidShare(drizzleExecutor(tx), kernelDeps, {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        matterId: body.data.matterId,
        categories: body.data.categories,
        documentAuthorisationIds: body.data.documentAuthorisationIds,
      }),
    )
    return NextResponse.json({ success: true, shareIds, ...COUNSEL_SIDE_NOTICE }, { status: 201 })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

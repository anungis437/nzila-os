/**
 * POST /api/workaid/documents — the consenting member authorises ONE document for disclosure on a matter.
 * Only the member's own non-privileged submissions (or records the institution formally released to them), linked to
 * this matter's case alone, qualify. Revocation: POST /api/workaid/documents/[authorisationId]/revoke.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { authoriseWorkAidDocument } from '@/lib/authority/store/workaid-disclosure'
import { COUNSEL_SIDE_NOTICE, parseBody, workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

const schema = z.object({
  matterId: z.string().uuid(),
  documentId: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
})

export async function POST(request: Request) {
  try {
    const actor = await getCaseActor()
    const body = await parseBody(request, schema)
    if (!body.ok) return body.response
    const authorisationId = await withRLSContext(async (tx) =>
      authoriseWorkAidDocument(drizzleExecutor(tx), kernelDeps, {
        organizationId: actor.organizationId,
        memberUserId: actor.userId,
        matterId: body.data.matterId,
        documentId: body.data.documentId,
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : undefined,
      }),
    )
    return NextResponse.json({ success: true, authorisationId, ...COUNSEL_SIDE_NOTICE }, { status: 201 })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

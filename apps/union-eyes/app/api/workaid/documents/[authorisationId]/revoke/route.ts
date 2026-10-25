/**
 * POST /api/workaid/documents/[authorisationId]/revoke — the consenting member withdraws one document authorisation.
 * The document stops being disclosable at once and its shares are invalidated in the same transaction.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { revokeWorkAidDocumentAuthorisation } from '@/lib/authority/store/workaid-disclosure'
import { workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ authorisationId: string }> }) {
  try {
    const { authorisationId } = await params
    if (!z.string().uuid().safeParse(authorisationId).success) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid authorisation id.' }, { status: 400 })
    const actor = await getCaseActor()
    const result = await withRLSContext(async (tx) =>
      revokeWorkAidDocumentAuthorisation(drizzleExecutor(tx), kernelDeps, { organizationId: actor.organizationId, revokerUserId: actor.userId, authorisationId }),
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

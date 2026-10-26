/**
 * POST /api/workaid/consents/[consentId]/revoke — the consenting member withdraws consent.
 * In one transaction: the consent, every document authorisation and every live share are ended, and an unaccepted
 * referral is withdrawn. Counsel access stops at once. Audited atomically.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import { revokeWorkAidConsent } from '@/lib/authority/store/workaid-disclosure'
import { workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ consentId: string }> }) {
  try {
    const { consentId } = await params
    if (!z.guid().safeParse(consentId).success) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid consent id.' }, { status: 400 })
    const actor = await getCaseActor()
    const result = await withRLSContext(async (tx) => revokeWorkAidConsent(drizzleExecutor(tx), kernelDeps, { organizationId: actor.organizationId, revokerUserId: actor.userId, consentId }))
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

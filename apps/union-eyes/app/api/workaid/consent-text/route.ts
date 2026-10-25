/**
 * GET /api/workaid/consent-text — the institution-recorded wording a member would consent to now.
 * 409 CONSENT_TEXT_UNAVAILABLE until an executive records approved wording: consent cannot be captured without it.
 */
import { NextResponse } from 'next/server'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { getCaseActor } from '@/lib/cases/case-authorization'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { loadCurrentConsentText } from '@/lib/authority/store/workaid-disclosure'
import { workAidErrorResponse } from '@/lib/workaid/route-support'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const actor = await getCaseActor()
    const text = await withRLSContext(async (tx) => loadCurrentConsentText(drizzleExecutor(tx), actor.organizationId))
    if (!text) return NextResponse.json({ success: false, error: 'PRECONDITION', code: 'CONSENT_TEXT_UNAVAILABLE' }, { status: 409 })
    return NextResponse.json({ success: true, consentText: { version: text.version, body: text.body, sha256: text.bodySha256, effectiveAt: text.effectiveAt.toISOString() } })
  } catch (error) {
    return workAidErrorResponse(error)
  }
}

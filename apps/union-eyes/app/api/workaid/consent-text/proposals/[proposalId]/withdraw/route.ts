/** Retained WorkAid wording workflow is deferred from the base release. */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({ success: false, error: 'NOT_IMPLEMENTED', code: 'WORKAID_WORDING_DEFERRED' }, { status: 501 })
}

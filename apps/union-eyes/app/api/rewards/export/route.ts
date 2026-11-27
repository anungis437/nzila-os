import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/framework'
import { RewardsInstitutionalAuthorityUnavailable } from '@/lib/rewards/credit-authority'

export const dynamic = 'force-dynamic'

/** Authentication and administrative membership precede the deferred finance
 * response. No award, wallet, budget, export or audit row is read or written. */
export const GET = withApi({ auth: { minRole: 'admin' } }, async ({ request }) => {
  const requested = new URL(request.url).searchParams.get('type') || 'awards'
  if (!['awards', 'ledger', 'budgets'].includes(requested))
    return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
  const unavailable = new RewardsInstitutionalAuthorityUnavailable()
  return NextResponse.json({ error: unavailable.message, code: unavailable.code }, { status: 501 })
})

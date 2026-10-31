const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
fs.writeFileSync('lib/finance/finance-view-mandate.ts', `import { withRLSContext } from '@/lib/db/with-rls-context'
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'

/**
 * Financial and pension intelligence reads dues, arrears, remittances, ledger and pension data of the organization. An
 * officer role title is not authority over those records: the caller needs a live financial view mandate.
 */
export async function assertFinanceViewMandate(organizationId: string, userId: string): Promise<void> {
  await withRLSContext({ organizationId, userId }, (tx) =>
    requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view' }),
  )
}

/** The same check for a handler that answers with a Response instead of throwing: null when the caller holds the mandate. */
export async function financeViewMandateDenial(organizationId: string, userId: string): Promise<Response | null> {
  try {
    await assertFinanceViewMandate(organizationId, userId)
    return null
  } catch {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'A live financial view mandate is required')
  }
}
`)
edit('app/api/ai/finance/analysis/route.ts', [
  [`import { enforceAISafety } from '@nzila/policies';`, `import { enforceAISafety } from '@nzila/policies';\nimport { assertFinanceViewMandate } from '@/lib/finance/finance-view-mandate';`],
  [`    if (!userId) throw ApiError.unauthorized('User context required');
`, `    if (!userId) throw ApiError.unauthorized('User context required');

    // The report reads dues, arrears, remittances and the ledger: the role title alone is not authority over them.
    await assertFinanceViewMandate(organizationId, userId);
`],
])
const pension = (f, anchor) => edit(f, [
  [`import { enforceAISafety } from '@nzila/policies';`, `import { enforceAISafety } from '@nzila/policies';\nimport { financeViewMandateDenial } from '@/lib/finance/finance-view-mandate';`],
  [anchor, `  // 0. Pension figures need a live financial view mandate, not only an officer role title.
  const noMandate = await financeViewMandateDenial(context.organizationId!, context.userId!);
  if (noMandate) return noMandate;

` + anchor],
])
pension('app/api/ai/pension/plans/[id]/funding/route.ts', `  // 1. Rate limit`)
pension('app/api/ai/pension/members/[id]/projection/route.ts', `  // 1. Rate limit`)
pension('app/api/ai/pension/plans/[id]/trustee-summary/route.ts', `  // 1. Rate limit`)
edit('app/api/__tests__/ai-finance-analysis.route.test.ts', [
  [`vi.mock('@/lib/ai/financial-insights'`, `vi.mock('@/lib/finance/finance-view-mandate', () => ({ assertFinanceViewMandate: m.assertFinanceViewMandate }));
vi.mock('@/lib/ai/financial-insights'`],
])
console.log('ok')

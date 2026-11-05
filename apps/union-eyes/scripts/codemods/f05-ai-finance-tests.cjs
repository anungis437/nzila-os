const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/__tests__/ai-finance-analysis.route.test.ts', [
  [`  generateFinancialInsight: vi.fn(),
}));`, `  generateFinancialInsight: vi.fn(),
  assertFinanceViewMandate: vi.fn(),
}));`],
  [`    m.generateFinancialInsight.mockResolvedValue({ report: 'ok' });
  });`, `    m.generateFinancialInsight.mockResolvedValue({ report: 'ok' });
    m.assertFinanceViewMandate.mockResolvedValue(undefined);
  });

  // DEF-0B2-AI-FINANCE-ROLE-TITLE-GATE
  it('refuses an officer who holds no live financial view mandate, before reading any financial data', async () => {
    const { GET } = await loadRoute();
    m.assertFinanceViewMandate.mockRejectedValueOnce(Object.assign(new Error('Financial mandate required'), { status: 403 }));

    await expect(GET(new NextRequest('http://localhost/api/ai/finance/analysis'), { organizationId: 'org_1', userId: 'u1', query: { type: 'comprehensive', timeframe: '90d' } })).rejects.toMatchObject({ status: 403 });

    expect(m.assertFinanceViewMandate).toHaveBeenCalledWith('org_1', 'u1');
    expect(m.generateFinancialInsight).not.toHaveBeenCalled();
    expect(m.guardAiFeature).not.toHaveBeenCalled();
  });`],
])
fs.writeFileSync('lib/finance/__tests__/finance-view-mandate.test.ts', `import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ withRLSContext: vi.fn(), requireLive: vi.fn(), tx: { marker: 'tx' } }))

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }))
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.requireLive }))
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: (code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: 403 }),
}))

import { assertFinanceViewMandate, financeViewMandateDenial } from '../finance-view-mandate'

describe('finance view mandate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.withRLSContext.mockImplementation(async (_ctx: unknown, work: (tx: unknown) => Promise<unknown>) => work(m.tx))
  })

  it('asks for a live finance:view mandate in the caller\\'s own tenant context', async () => {
    m.requireLive.mockResolvedValue({})
    await assertFinanceViewMandate('org-1', 'user-1')
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'user-1' }, expect.any(Function))
    expect(m.requireLive).toHaveBeenCalledWith(m.tx, { organizationId: 'org-1', userId: 'user-1', action: 'finance:view' })
  })

  it('lets the mandate refusal through unchanged', async () => {
    m.requireLive.mockRejectedValue(new Error('no mandate'))
    await expect(assertFinanceViewMandate('org-1', 'user-1')).rejects.toThrow('no mandate')
  })

  it('answers null for a holder and 403 for anyone else', async () => {
    m.requireLive.mockResolvedValueOnce({})
    expect(await financeViewMandateDenial('org-1', 'user-1')).toBeNull()
    m.requireLive.mockRejectedValueOnce(new Error('no mandate'))
    expect((await financeViewMandateDenial('org-1', 'user-2'))!.status).toBe(403)
  })
})
`)
fs.writeFileSync('lib/api/__tests__/f05-b39-mandate.contract.test.ts', `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F05 financial intelligence needs a live mandate', () => {
  // DEF-0B2-AI-FINANCE-ROLE-TITLE-GATE
  it.each([
    'app/api/ai/pension/plans/[id]/funding/route.ts',
    'app/api/ai/pension/members/[id]/projection/route.ts',
    'app/api/ai/pension/plans/[id]/trustee-summary/route.ts',
  ])('%s checks the financial view mandate before its rate limit, gate, model call or any read', (route) => {
    const source = read(route)
    const mandate = source.indexOf('financeViewMandateDenial(')
    expect(mandate).toBeGreaterThan(0)
    expect(mandate).toBeLessThan(source.indexOf('checkRateLimit('))
    expect(mandate).toBeLessThan(source.indexOf('guardAiFeature('))
  })

  it('the finance analysis checks the mandate before the feature gate and the report', () => {
    const source = read('app/api/ai/finance/analysis/route.ts')
    expect(source.indexOf('assertFinanceViewMandate(organizationId, userId)')).toBeGreaterThan(0)
    expect(source.indexOf('assertFinanceViewMandate(organizationId, userId)')).toBeLessThan(source.indexOf('generateFinancialInsight({'))
  })
})
`)
console.log('ok')

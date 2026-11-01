import { readFileSync } from 'node:fs'
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
    const resource = route.includes('/members/') ? 'memberId' : 'planId'
    expect(source).toContain(`financeViewMandateDenial(context.organizationId!, context.userId!, ${resource})`)
    expect(source.indexOf(`const ${resource} = request.nextUrl.pathname`)).toBeLessThan(mandate)
  })

  it('the finance analysis checks the mandate before the feature gate and the report', () => {
    const source = read('app/api/ai/finance/analysis/route.ts')
    expect(source.indexOf('assertFinanceViewMandate(organizationId, userId)')).toBeGreaterThan(0)
    expect(source.indexOf('assertFinanceViewMandate(organizationId, userId)')).toBeLessThan(source.indexOf('generateFinancialInsight({'))
  })

  // DEF-0B6-EMP-COMPLIANCE-EVENT-FORGEABLE-BY-STEWARD, DEF-0B6-EMP-EXECUTION-READS-AT-MEMBER-FLOOR
  it('payroll compliance events are read and raised by the financial roles only, and a manual flag cannot be critical or blocking', () => {
    const source = read('app/api/employer-execution/compliance/route.ts')
    expect(source.match(/roles: FINANCIAL_MEMBER_DATA_ROLES/g)?.length).toBe(2)
    expect(source).not.toMatch(/minRole: "(member|steward)"/)
    expect(source).toContain('severity: z.enum(["info", "warning"])')
    expect(source).toContain('.strict()')
    expect(source).toContain('blocking: "no"')
    expect(source).toContain('manual_')
    expect(source).toContain('.limit(500)')
  })
})

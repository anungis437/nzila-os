const fs = require('fs')
const path = require('path')
const f = 'lib/api/__tests__/f05-b39-mandate.contract.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trimEnd()
s = s.slice(0, -2) + `
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
`
fs.writeFileSync(f, s)
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B39-F05-FINANCIAL-INTELLIGENCE-NEEDS-A-MANDATE-AND-FLAGS-CANNOT-BE-FORGED'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B39 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const C = A + 'lib/api/__tests__/f05-b39-mandate.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F05: financial intelligence needs a live financial mandate, and a record a person raises cannot pass for an engine record',
  evidenceCommit: null,
  items: [
    item('DEF-0B2-AI-FINANCE-ROLE-TITLE-GATE', [A + 'lib/finance/finance-view-mandate.ts', A + 'lib/finance/__tests__/finance-view-mandate.test.ts', A + 'app/api/ai/finance/analysis/route.ts', A + 'app/api/ai/pension/plans/[id]/funding/route.ts', A + 'app/api/ai/pension/members/[id]/projection/route.ts', A + 'app/api/ai/pension/plans/[id]/trustee-summary/route.ts', A + 'app/api/__tests__/ai-finance-analysis.route.test.ts', C],
      'The finance analysis and the three pension intelligence routes first require a live finance:view mandate (in the caller own tenant context) and answer 403 without it, before the rate limit, feature gate, entitlement or any read. The finance analysis test mock gained the new collaborator and a refusal test.',
      { status: 'PARTIAL', remaining: 'The view mandate is not resource-scoped to a plan or member, and the pension projection still reads any member of the plan by id for an officer.' }),
    item('DEF-0B6-EMP-COMPLIANCE-EVENT-FORGEABLE-BY-STEWARD', [A + 'app/api/employer-execution/compliance/route.ts', C],
      'Raising a compliance event is a financial-role act; a manual flag may be info or warning only, can never block an approval, cannot take an engine event code (it is prefixed manual_), and its summary and code are bounded; unknown body fields are refused.'),
    item('DEF-0B6-EMP-EXECUTION-READS-AT-MEMBER-FLOOR', [A + 'app/api/employer-execution/compliance/route.ts', A + 'app/api/employer-execution/payroll-runs/route.ts', A + 'app/api/employer-execution/remittance-runs/route.ts', C],
      'The compliance event list moves from the member floor to the financial roles and is bounded to 500 rows; the payroll and remittance run lists already require the financial roles and a live view mandate.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B39 added')

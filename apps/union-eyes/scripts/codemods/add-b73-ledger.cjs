const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B73-PENSION-PLAN-FIGURES-AND-READS'
const test = A + 'lib/services/__tests__/s17-pension-plan-figures.test.ts'
if (!ledger.batches.some((x) => x.id === id)) {
  const item = (prefix, files, explanation) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation })
  ledger.batches.push({
    id,
    family: 'Pension plan figures, member list authority and tenant-context reads',
    evidenceCommit: null,
    items: [
      item('DEF-0B10-PEN-PLAN-FIGURES-ARE-ADMINISTRATOR-TYPED-AND-READABLE-BY-ANY-MEMBER', [A + 'lib/pension/plan-input.ts', A + 'app/api/pension/plans/route.ts', A + 'app/api/pension/plans/[id]/route.ts'], 'totalAssets and fundingStatus are validated as the amount and percentage the numeric columns hold, the body is strict, activeMembers is no longer typed in but counted from the plan\'s active enrolments, and a member reads the plan without the assets and funding figures (they are an administrator\'s recorded values). A missing plan is a 404 instead of null.'),
      item('DEF-0B10-PEN-MEMBERS-GET-IS-HELD-TO-THE-CALLER-OWN-ENROLMENT-AT-EVERY-ROLE', [A + 'app/api/pension/members/route.ts'], 'A pension administrator lists the organization\'s pension members (optionally by plan, validated) and the read is recorded in the same transaction; every other caller is still limited to their own enrolment.'),
      item('DEF-0B10-PEN-PENSION-READS-USE-THE-SHARED-DB-HANDLE-WITHOUT-AN-EXPLICIT-TENANT-CONTEXT', [A + 'app/api/pension/members/route.ts', A + 'app/api/pension/plans/route.ts', A + 'app/api/pension/plans/[id]/route.ts', A + 'app/api/pension/retirement-eligibility/route.ts', A + 'app/api/pension/trustee-meetings/route.ts'], 'Members, plans, the plan item, retirement eligibility and the trustee meetings read inside withRLSContext (verified for the last two); none imports the shared db handle.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B73 added')

const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B63-F10-F02-UNMEASURED-FIGURES-AND-PENSION-CONTRIBUTION-REFERENCES'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts'
  ledger.batches.push({
    id,
    family: 'A figure nothing measures is not zero, and a pension contribution names a real pension member',
    evidenceCommit: null,
    items: [
      { prefix: 'DEF-0B8-HS-TRAINING-FIGURES-READ-A-TABLE-NO-ROUTE-WRITES', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [A + 'app/api/health-safety/stats/route.ts', A + 'app/[locale]/dashboard/health-safety/training/page.tsx', test],
        explanation: 'No route or job writes training records, so an organization with none now gets trainingDue null (not measured) with trainingRecordsHeld 0, instead of "0 due"; the training page shows the records held as its total rather than the due count.' },
      { prefix: 'DEF-0B10-PEN-PENSION-WRITES-STORE-TYPED-MEMBER-REFERENCES-NAMES-AND-AM', status: 'PARTIAL', files: [A + 'app/api/pension/contributions/route.ts', A + 'app/api/__tests__/pension-contribution-member.route.test.ts'],
        explanation: 'A contribution is recorded only against a pension member of the caller\'s organization (404 otherwise), under the stored member name (the typed name is ignored), and the amount must be a positive amount of at most ten digits and two decimals. Tested with a mocked transaction.',
        remaining: 'The T4A, benefit-claim, member and plan write routes still store typed references, names and amounts; each needs the same reference and amount checks.' },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B63 added')

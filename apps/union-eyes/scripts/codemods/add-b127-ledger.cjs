const fs = require('fs')
const path = require('path')
const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister

// An item already in the ledger loses its remaining text unless it is given again, so the current text is read back and restated unchanged.
const currentRemaining = (prefix) => {
  const id = register.filter((d) => d.id.startsWith(prefix)).map((d) => d.id)[0]
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
  const entry = ledger.batches.flatMap((b) => b.items).find((i) => register.some((d) => d.id === id && d.id.startsWith(i.prefix)))
  if (!entry) throw new Error('not in the ledger: ' + prefix)
  return entry.remaining
}

const files = [
  A + 'app/api/__tests__/clause-library-audit.route.test.ts',
  A + 'app/api/clause-library/[id]/share/route.ts',
  A + 'app/api/clause-library/[id]/route.ts',
]
for (const f of files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

addBatch({
  id: 'B127-CI-REPAIR-SHARE-ROUTE-AUDIT-TEST-ORDER',
  family: 'CI repair after B125: a route test that still pinned the sharing denial before the clause is read',
  test: A + 'app/api/__tests__/clause-library-audit.route.test.ts',
  previousEvidence: { 'B126-CI-REPAIR-QA-CLOCK-SCIM-EVENT-ORDER-AND-ORGANIZATION-TEST-STUBS': 'f902f8b70' },
  items: [
    {
      prefix: 'DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files,
      explanation:
        'B127: the Full Regression run of f902f8b70 failed one test that B125 had left behind: clause-library-audit.route.test.ts pinned the sharing denial of the share route before the clause is read, and B125 moved it after the ownership check (so a caller who does not own the clause learns nothing from the sharing rule, and the denial can be judged against the level the clause already has). The same repair of the fixture, queueing the owner clause, was made concurrently by another session (43a614ce4, with the tenant-transaction change of the sharing GET in 9b55a6d1c) and is kept as it is; this batch adds the pin that the denial is judged against the clause current level, and records the evidence trail. Found by the CI run, not by the focused run of B125, which covered the route directory but not this file; every test that references the two routes or the denial function was run after the repair (33 files, 342 tests).',
      remaining: currentRemaining('DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS'),
    },
  ],
})

const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B49-F06-REGULATORY-RECORDS-AND-SYNC-HISTORY-ARE-RETAINED'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/api/__tests__/f06-b49-retain.contract.test.ts'
  ledger.batches.push({
    id,
    family: 'F06: regulatory records and integration sync history are not erased by the generic delete',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B4-OHS-REGULATORY-RECORD-HARD-DELETE',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/api/crud-factory.ts', A + 'app/api/cnesst/anti-scab/[id]/route.ts', A + 'app/api/cnesst/hs-committees/[id]/route.ts', test],
        explanation: 'New crud-factory option retainOnDelete: DELETE answers 409 before any lookup or write, so the row is kept. Applied to the anti-scab violation and joint health-and-safety committee item routes, the two tables the defect names. A contract test pins that the refusal comes before any audited write or tx.delete.',
      },
      {
        prefix: 'DEF-0B5-OHS-REFUSAL-EVENT-HARD-DELETE',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/api/crud-factory.ts', A + 'app/api/cnesst/right-of-refusal/[id]/route.ts', test],
        explanation: 'The right-of-refusal item route declares retainOnDelete, so the refusal record and any reprisal complaint are never removed through the generic delete (409).',
        remaining: 'No retention rule is named by a source, so the record is retained rather than archived; a governed withdrawal action is still to be defined.',
      },
      {
        prefix: 'DEF-0B7-PLT-EXT-DELETE-HARD-DELETE-CASCADES-SYNC-LOG-HISTORY',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/extensions/[id]/route.ts', A + 'app/api/__tests__/ae-audit-misc.route.test.ts'],
        explanation: 'Deleting an integration first confirms it belongs to the organization (404 otherwise), then refuses with 409 when any synchronization history exists, so the cascade can never erase it; the integration is disabled instead. The existing extensions test was adapted to the new query sequence and gained the history case (disclosed).',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B49 added')

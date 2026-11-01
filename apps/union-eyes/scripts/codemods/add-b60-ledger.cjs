const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B60-F03-F08-RETENTION-LOG-AND-VERIFIED-PROJECTIONS'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts'
  ledger.batches.push({
    id,
    family: 'Retention evidence that told the truth, and projections verified free of canned values and address logging',
    evidenceCommit: null,
    items: [
      { prefix: 'DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES', status: 'PARTIAL', files: [A + 'services/geofence-privacy-service.ts', A + 'db/__tests__/location-retention-owner.pglite.test.ts', test],
        explanation: 'The deletion log records the real oldest and newest dates of the rows it deleted (read from the deleted rows, tracking recorded_at and event time) instead of the run time for both. The retention owner PGlite test\'s stub tables gained recorded_at and event_time and it now asserts the span (disclosed).',
        remaining: 'The log has no organization column, so a run that deleted several organizations\' rows is still one undifferentiated entry; that needs a column and a per-organization entry.' },
      { prefix: 'DEF-0B9-ORG-DIRECTORY-PROJECTION-FILLS-MISSING-FIELDS-WITH-CANNED-DEPA', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [A + 'app/api/organization/members/route.ts', A + 'app/api/organization/members/search/route.ts', test],
        explanation: 'Existing implementation, verified: the member directory projections no longer substitute a department or a position; pinned by a test.' },
      { prefix: 'DEF-0B12-PLT-ORGANIZATIONS-LEGACY-BRANCH-LOGS-THE-FULL-E-MAIL', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [A + 'app/api/organizations/route.ts', test],
        explanation: 'Existing implementation, verified: the organizations list no longer has the platform-administrator-id legacy branch and does not read or log the caller\'s e-mail address; pinned by a test.' },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B60 added')

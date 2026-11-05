const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B61-F01-F02-VERIFIED-NOT-IMPLEMENTED-PATHS'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts'
  const item = (prefix, files, explanation) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation })
  const note = ' Existing implementation, verified: the path answers 501 behind its role floor and reads and writes nothing; pinned by a test.'
  ledger.batches.push({
    id,
    family: 'Paths that advertised an operation but were generic CRUD over another table, verified as honest 501',
    evidenceCommit: null,
    items: [
      item('DEF-0B11-RPT-SCHEDULED-PATHS-ARE-REPORT-DEFINITION-CRUD', [A + 'app/api/reports/scheduled/route.ts', A + 'app/api/reports/scheduled/[id]/route.ts'], 'The scheduled-report paths no longer expose report-definition CRUD as though it were a schedule.' + note),
      item('DEF-0B10-ORG-ORGANIZER-TASK-CREATE-STORES-UNVERIFIED', [A + 'app/api/organizer/impact/route.ts'], 'The organizer-impact path no longer creates organizer tasks with unverified assignee, member, case and grievance references.' + note),
      item('DEF-0B10-ORG-ORGANIZER-TASKS-READABLE-BY-EVERY-STEWARD', [A + 'app/api/organizer/impact/route.ts'], 'The organizer-impact path no longer returns every organizer task of the organization to any steward.' + note),
      item('DEF-0B11-RPT-BUILDER-AND-DATA-SOURCE-SAMPLE-PATHS', [A + 'app/api/reports/builder/route.ts', A + 'app/api/reports/datasources/sample/route.ts'], 'The report-builder and data-source-sample paths no longer act as report-definition CRUD.' + note),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B61 added')

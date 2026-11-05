const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B75-REPORT-OPERATORS-AND-QUEUE-STATUS'
const test = A + 'lib/services/__tests__/s19-report-operators-and-queue-status.test.ts'
if (!ledger.batches.some((x) => x.id === id)) {
  const item = (prefix, files, explanation) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation })
  const q = [A + 'app/api/union-eyes/queue-status/route.ts']
  ledger.batches.push({
    id,
    family: 'Report filter operators that were silently dropped; queue status verified',
    evidenceCommit: null,
    items: [
      item('DEF-0B11-RPT-EXECUTE-OPERATORS-THE-ROUTE-ACCEPTS-ARE-SKIPPED', [A + 'app/api/reports/execute/route.ts', A + 'lib/report-executor.ts'], 'The route validates filters against the executor\'s own operator vocabulary (translating the earlier names equals, not_equals, contains, greater_than and less_than), requires a bounded value list for in, not_in and between (exactly two for between), and the executor now throws on an operator it does not know instead of skipping the filter, so a filter can no longer be dropped and every row returned.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B75 added')

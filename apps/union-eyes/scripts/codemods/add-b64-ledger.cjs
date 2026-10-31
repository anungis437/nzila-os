const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B64-F05-F06-BATCH-STATUS-ENTITLEMENT-AND-DISCLOSURE'
if (!ledger.batches.some((x) => x.id === id)) {
  const files = [A + 'app/api/billing/batch-status/[jobId]/route.ts', A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts']
  ledger.batches.push({
    id,
    family: 'Newsletter batch status: the right gate and no recipient addresses',
    evidenceCommit: null,
    items: [
      { prefix: 'DEF-0B4-BATCH-STATUS-FINANCE-ENTITLEMENT-ON-NEWSLETTER', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation: 'The finance-suite entitlement no longer gates a newsletter campaign\'s progress (it admitted a union that bought finance but not communications and refused the reverse); the steward floor and the caller\'s-organization campaign scope remain. No communications entitlement exists in the catalogue, so none is substituted; adding one is a product decision.' },
      { prefix: 'DEF-0B4-BATCH-STATUS-RECIPIENT-EMAILS-DISCLOSED', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation: 'Existing implementation, verified: the status response lists no recipient address (earlier B53 work); pinned by a test, so there is no disclosure to audit.' },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B64 added')

const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B58-F06-VERIFIED-AUDIT-AND-COMPLETION-COUNTS'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts'
  ledger.batches.push({
    id,
    family: 'F06 audit and records: verified existing audit and a completion count that measured attendance',
    evidenceCommit: null,
    items: [
      { prefix: 'DEF-0B6-EDU-CONTENT-COMPLETIONS-COUNT-ATTENDED', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [A + 'app/api/content/training/route.ts', A + 'app/api/content/stats/route.ts', test],
        explanation: 'The training list and the content statistics count a completion as a registration with completed true, no longer as attended true, so a member who attended without finishing is not counted as having completed the course.' },
      { prefix: 'DEF-0B2-AI-INVOCATION-NOT-AUDITED', status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [A + 'app/api/ai/classify/route.ts', A + 'app/api/ai/summarize/route.ts', A + 'app/api/ai/match-precedents/route.ts', A + 'app/api/ai/search/route.ts', test],
        explanation: 'Existing implementation, verified: the classify, summarize, match-precedents and search routes now run the model call inside performAuditedOperation, which records intent and outcome and answers a refused audit through operationAuditResponse; pinned by a test. The intent and outcome are separate transactions from the effect (a different, still open defect).' },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B58 added')

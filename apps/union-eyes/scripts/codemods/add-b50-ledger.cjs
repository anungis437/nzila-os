const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B50-F05-SOCIAL-EXPORT-AND-ORG-BOUND-LOOKUPS'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'app/api/__tests__/f05-b50-social.contract.test.ts'
  ledger.batches.push({
    id,
    family: 'F05/F03: the social export is a bounded staff read with safe cells; records are looked up inside the caller organization',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B11-SOC-ANALYTICS-EXPORT-IS-A-DELETE-VERB-READ-AT-MEMBE',
        status: 'PARTIAL',
        files: [A + 'app/api/social-media/analytics/route.ts', test],
        explanation: 'The export is now a steward-floor read with its own rate limit, at most 5000 rows per dataset, CSV cells neutralised through the shared formula-safe helper, zero values no longer blanked, and the campaign export reads each column by its real key (it previously left most columns empty). Existing analytics route tests still pass; a source-contract test pins each point.',
        remaining: 'It is still served on the DELETE verb, and no audit record is written for the export.',
      },
      {
        prefix: 'DEF-0B11-SOC-RECORD-IS-LOADED-BY-ID-ALONE-ON-THE-BARE-DB-HAN',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/social-media/posts/route.ts', A + 'app/api/social-media/analytics/route.ts', A + 'app/api/__tests__/social-posts-and-redemptions-audit.route.test.ts', test],
        explanation: 'The post delete and the campaign analytics lookups name the caller organization inside the query (the post through an inner join to its account), so another organization row is simply not found (404) and the 403-versus-404 existence oracle is gone. The campaign routes already did this. The post delete test mock gained the inner join and now expects 404 for a foreign post (disclosed).',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B50 added')

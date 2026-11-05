const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B48-F05-LITERAL-SEARCH-AND-BOUNDED-ANONYMOUS-JSON'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/api/__tests__/f12-b48-bounds.contract.test.ts'
  ledger.batches.push({
    id,
    family: 'F05/F12: searches match literally and list only active organizations; free-form JSON from callers is bounded and cannot overwrite audited fields',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B10-OPL-06',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/organizations/search/route.ts', A + 'lib/api/like-pattern.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts', test],
        explanation: 'The organization search always excludes the platform organization type and any organization whose status is not active (a missing status counts as active), with or without a term, matches the term literally (percent and underscore escaped), and orders by name then id. The real-SQL pglite test for the search still passes, and a source-contract test pins the predicates.',
      },
      {
        prefix: 'DEF-0B9-ASM-ONBOARDING-EVENT-METADATA-IS-UNBOUNDED',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/onboarding/events/route.ts', test],
        explanation: 'The onboarding event payload bounds targetUserId (255) and role (64), limits metadata to 20 keys of short scalar values, and stores caller metadata before targetUserId and role so it can never replace the values the audit row records.',
        remaining: 'The event is still a caller-asserted milestone (tracked by the companion defect).',
      },
      {
        prefix: 'DEF-0B10-PIL-PUBLIC-APPLICATION-RESPONSES-OBJECT-AND-ASSESSMENT-',
        status: 'PARTIAL',
        files: [A + 'app/api/pilot/apply/route.ts', A + 'lib/api/bounded-json-record.ts', test],
        explanation: 'The anonymous pilot application bounds responses to 16 KB, 60 keys and 4 levels of nesting, and keeps only a finite numeric or short string assessment score instead of a passthrough object. Unit tests cover each bound.',
        remaining: 'The stored responses are still free-form JSON that later reads, proposals and exports consume; no per-key schema exists.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B48 added')

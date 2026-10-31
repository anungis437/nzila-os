// Appends batch B13 to the elimination ledger (idempotent).
const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B13-F03-SHARED-DATASET-AUTHORITY'
if (ledger.batches.some((b) => b.id === ID)) {
  console.log('B13 already present')
  process.exit(0)
}
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
const cba = [
  A + 'app/api/cba-intelligence/review/route.ts', A + 'app/api/cba-intelligence/extraction/route.ts', A + 'app/api/cba-intelligence/ingestion/route.ts',
  A + 'app/api/cba-intelligence/ingestion/run/route.ts', A + 'app/api/cba-intelligence/ingestion/seed/route.ts', A + 'app/api/cba-intelligence/sources/route.ts',
  A + 'app/api/cba-intelligence/sources/[id]/route.ts', A + 'scripts/codemods/f03-cba-intel-platform.cjs', A + 'lib/api/__tests__/shared-dataset-authority.contract.test.ts',
  A + 'app/api/__tests__/ae-audit-misc.route.test.ts', A + 'app/api/__tests__/cba-intelligence-extraction.route.test.ts',
]

ledger.batches.push({
  id: ID,
  family: 'F03: platform-wide datasets are changed only with platform authority; an organization\'s role floor is not authority over rows every organization reads',
  evidenceCommit: null,
  items: [
    item('DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET', cba,
      'The extracted CBA dataset (agreements, findings, wage adjustments, clauses, sources, ingestion) has no organization column. Extraction, ingestion (create, run, seed) and source create/update were open to an organization\'s administrator; each now calls requireSystemAdmin() first. A contract test checks all seven mutating handlers. The extraction route test gained the platform-admin mock and a refusal test.'),
    item('DEF-0B4-CBA-INTEL-TENANT-STEWARD-REVIEWS-SHARED-DATASET', cba,
      'The review queue and review decisions (approve, reject, supersede) changed rows every organization reads at the steward floor of any one organization. Both methods now require a platform administrator and the reviewer role recorded is platform_administrator, not a literal "steward". A refusal test covers the queue and the decision, which write and read nothing.'),
    item('DEF-0B4-CBA-INTEL-SHARED-DATASET-NO-TENANT-PREDICATE', cba,
      'Writes and review are now platform authority. The dataset is shared by design (no organization column), so a tenant predicate does not apply to its reads.',
      { status: 'PARTIAL', remaining: 'Reads (agreements list and detail, benchmark, documents, freshness) remain open to any entitled member or steward of any organization; whether the shared dataset may be read that widely, and under which entitlement, is an institutional decision.' }),
    item('DEF-0B3-ARBITRATION-DECISIONS-ORG-ADMIN-DELETES-SHARED-ROW', [A + 'app/api/arbitration/precedents/[id]/route.ts', A + 'lib/api/__tests__/shared-dataset-authority.contract.test.ts'],
      'The collection and item routes already require the platform content_manager role to write; upstream\'s change, now pinned by a contract test.'),
    item('DEF-0B4-CASE-STUDIES-ORG-ADMIN-WRITES-GLOBAL-CONTENT', [A + 'app/api/case-studies/route.ts', A + 'app/api/case-studies/[slug]/route.ts', A + 'lib/api/__tests__/shared-dataset-authority.contract.test.ts'],
      'Case-study writes need content_manager and the item route (read and write) is limited to it; upstream\'s change, pinned by a contract test.'),
    item('DEF-0B4-CASE-STUDIES-READ-IGNORES-PUBLICATION-STATE', [A + 'app/api/case-studies/route.ts', A + 'lib/api/__tests__/shared-dataset-authority.contract.test.ts'],
      'The public list is limited to public, already published rows for both the rows and the count, and a status other than published is refused; upstream\'s change, pinned by a contract test.'),
    item('DEF-0B3-BARGAINING-PROPOSALS-NO-TENANT-PREDICATE', [A + 'app/api/bargaining/proposals/route.ts', A + 'app/api/bargaining/proposals/[id]/route.ts', A + 'lib/api/__tests__/shared-dataset-authority.contract.test.ts'],
      'Proposals are scoped through their negotiation (parentScope), because the table has no organization column; upstream\'s change, pinned by a contract test.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B13 added')

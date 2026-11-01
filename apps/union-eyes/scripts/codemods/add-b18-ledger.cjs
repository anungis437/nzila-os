const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B18-F06-AUDIT-AND-SIGNATURE-INTEGRITY'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B18 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F06: a read does not write, an effect is audited with its record, and a state is recorded only when the effect it names happened',
  evidenceCommit: null,
  items: [
    item('DEF-0B4-CBA-BENCHMARK-GET-WRITES-SNAPSHOT-NO-AUDIT', [A + 'app/api/cba-intelligence/benchmark/[id]/route.ts', A + 'app/api/__tests__/cba-benchmark-snapshot.route.test.ts', A + 'scripts/codemods/f06-benchmark-post.cjs'],
      'GET computes and returns a benchmark and refuses ?save. Saving a snapshot is a new POST that needs a platform administrator (the dataset has no organization column), records the intent before the write, and stores nothing when that audit cannot be written.'),
    item('DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', [A + 'lib/api/__tests__/no-local-file-writes.contract.test.ts'],
      'No route or cognition library writes the local file system any more (upstream\'s change); a contract test now fails if one does.'),
    item('DEF-0B5-COGNITION-READ-ROUTES-WRITE-FILES-AUDIT-NOT-ATOMIC', [A + 'lib/api/__tests__/no-local-file-writes.contract.test.ts'],
      'Same: the read routes no longer write files, so there is no write to audit separately; pinned by the contract test.'),
    item('DEF-0B7-EXC-AI-ROUTES-APPLY-NO-FEATURE-GATE-SAFETY-CHECK-OR-USER-RATE-LIMIT', [A + 'lib/api/__tests__/ai-routes-controls.contract.test.ts'],
      'Every route under /api/ai calls a feature gate, the AI safety check and a rate limit (upstream\'s change); a contract test fails if a new AI route lacks one. cache-stats is platform-administrator only and audited.'),
    item('DEF-0B11-SOC-VOID-SWALLOWS-THE-PROVIDER-FAILURE-AND-RECORDS-VOIDED', [A + 'lib/signature/signature-service.ts', A + 'lib/signature/__tests__/signature-service.test.ts', A + 'scripts/codemods/f06-signature-void-order.cjs'],
      'A provider failure while voiding is no longer swallowed: the document is not recorded as voided and no void is audited, and the sender is told with a conflict, because the envelope can still be signed at the provider.'),
    item('DEF-0B11-SOC-SIGNING-IGNORES-THE-STORED-EXPIRY-SIGNING-ORDER-AND-AUTHENTICATION-REQUIREMENT', [A + 'lib/signature/signature-service.ts', A + 'lib/signature/__tests__/signature-service.test.ts'],
      'Signing now refuses an expired request and, when sequential signing is set, a signer whose earlier signers have not all signed; the signer must already be the authenticated platform user. The mocked drizzle-orm in the service test gained lt.',
      { status: 'PARTIAL', remaining: 'The stored requireAuthentication flag is not given a second factor: signing relies on the platform session only.' }),
    item('DEF-0B9-ORG-ROSTER-GET-ANY-ORGANIZATION-MEMBER-READS-FULL-ROSTER-WITH-CONTACT-DETAILS', [A + 'app/api/organizations/[id]/members/route.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'The roster is read only by stewards and above, the administrators above the organization and the platform; a member, a suspended member and a stranger are refused (upstream\'s change, proven on real SQL).'),
    item('DEF-0B11-IDS-SETTINGS-PUT-MERGES-ANY-KEY-INTO-THE-JSON-THAT-HOLDS-THE-CREDIT-LEDGER', [A + 'app/api/settings/organization/route.ts', A + 'app/api/__tests__/settings-organization.route.test.ts'],
      'Only an allow-listed set of non-secret preference keys is accepted; authority keys (per-capita rate, credits, remittance day, renewal date, telephone number) are refused with 400 and nothing is saved or audited (upstream\'s change, covered by existing tests; the merge is now transactional, batch B11).'),
    item('DEF-0B11-IDS-STEWARD-ASSIGNMENT-ROWS-READABLE-BY-ANY-MEMBER', [A + 'app/api/stewards/route.ts', A + 'app/api/__tests__/stewards-directory.route.test.ts'],
      'Members receive a member-safe projection of active assignments; only officers receive the full rows, and that read is audited (upstream\'s change, covered by an existing test).'),
    item('DEF-0B10-ORG-CAMPAIGN-ROWS-READABLE-BY-ANY-MEMBER', [A + 'app/api/organizing/campaigns/route.ts', A + 'app/api/__tests__/wave1-route-floors.test.ts'],
      'The campaign route reads and writes at the officer floor; upstream\'s change, pinned by an existing test.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B18 added')

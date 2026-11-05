const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B28-F12-F06-COMPLIANCE-VERDICTS-AND-UNSCOPED-AGGREGATES'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B28 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f12-hs-compliance.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F12/F06: a check states only what it verified, an aggregate never runs without an organization, and an administrative record is read and written as exactly that',
  evidenceCommit: null,
  items: [
    item('DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA', [A + 'app/api/compliance/validate/route.ts', A + 'app/api/__tests__/compliance-validate.route.test.ts', CONTRACT],
      'The strike-vote and certification checks no longer return compliant, warning or violation from numbers the caller typed against thresholds written into the route; each reports the arithmetic, says no validated rule is configured and that the figures are unchecked, as info. Test disclosure: one test added; the existing tests did not assert a verdict.'),
    item('DEF-0B6-CMP-VALIDATE-LITERAL-THRESHOLDS-AND-SWALLOWED-LOOKUP', [A + 'app/api/compliance/validate/route.ts', CONTRACT],
      'The literal thresholds are removed and there is no rule lookup to swallow.'),
    item('DEF-0B8-JUR-COMPLIANCE-CHECK-REPORTS-ZERO-FINDINGS-WHEN-NO-CHECK-APPLIES', [A + 'app/api/compliance/validate/route.ts', CONTRACT],
      'The response carries the number of checks evaluated and, when none applied, a notice that this is not a finding of compliance.'),
    item('DEF-0B6-CMP-AUDIT-LOG-FULL-ROW-READ-BY-OFFICER', [A + 'app/api/compliance/audit-logs/route.ts', A + 'app/api/__tests__/write-routes-atomic-audit.route.test.ts'],
      'The organization audit records are read at the administrator floor, tenant-scoped, bounded to 100 and read-audited (upstream\'s change, existing test).',
      { status: 'PARTIAL', remaining: 'The read still returns the whole audit row; a field projection for the administrator view is not defined.' }),
    item('DEF-0B6-CMP-AUDIT-MANUAL-ENTRY-FREE-REFERENCE', [A + 'app/api/compliance/audit-logs/route.ts', A + 'app/api/__tests__/write-routes-atomic-audit.route.test.ts'],
      'A manual entry is recorded as compliance.manual_entry attributed to the administrator who wrote it, with the declared fields kept as untrusted details, so it cannot pass for a system record (upstream\'s change, existing test).'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B28 added')

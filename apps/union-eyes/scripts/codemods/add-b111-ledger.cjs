const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B111-F06-A5-REPORT-SMALL-GROUP-SUPPRESSION',
  family: 'F06 A5: an officer report cannot identify people through a small group',
  test: A + 'lib/services/__tests__/s51-f06-a5-a7-claimed-controls-operate.test.ts',
  previousEvidence: { 'B110-F06-A6-SIGNATURE-EVIDENCE-INTEGRITY': 'd12cf6a0e' },
  items: [
    {
      prefix: 'DEF-0B11-RPT-EXECUTE-RETURNS-MEMBER-EMAIL',
      status: 'PARTIAL',
      files: [A + 'lib/reports/report-config-validation.ts', A + 'app/api/reports/execute/route.ts', A + 'app/api/__tests__/reports-execute.route.test.ts'],
      explanation: 'Small-group suppression: in a grouped report an officer runs, the server adds its own count column, withholds every group of fewer than five, removes the count before the rows leave, says how many groups were withheld, and records that number in the audit row. An administrator is not suppressed. A grouped report\'s plain fields are group keys, so they no longer count as a row listing. Three tests added.',
      remaining: 'No classification or consent check on the returned fields. Suppression bounds a single grouped report, not differencing across several reports or filters.',
    },
  ],
})

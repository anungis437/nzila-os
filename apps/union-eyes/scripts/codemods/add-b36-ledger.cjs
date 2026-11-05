const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B36-F05-BOUNDED-LISTS-AND-ACCURATE-FILTERS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B36 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f05-b36-bounds.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F05: a list is bounded, a field is bounded, and a filter filters by the values the record can hold',
  evidenceCommit: null,
  items: [
    item('DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION', [A + 'app/api/pension/plans/route.ts', A + 'app/api/pension/trustees/route.ts', A + 'app/api/pension/members/route.ts', A + 'app/api/pension/benefits/route.ts', A + 'app/api/pension/contributions/route.ts', A + 'app/api/pension/t4a/route.ts', A + 'app/api/__tests__/pension-own-records.route.test.ts', CONTRACT],
      'Each of the six pension list reads returns at most 200 rows. Test mock adapted only to expose the added limit call.',
      { status: 'PARTIAL', remaining: 'There is still no pagination: rows beyond the 200 cap are not reachable through these routes.' }),
    item('DEF-0B4-CBAS-LIST-LIMIT-UNBOUNDED', [A + 'app/api/cbas/route.ts', CONTRACT],
      'The agreement list refuses a page outside 1..10000 or a limit outside 1..100 with 400 instead of passing an unparsed number to the query.'),
    item('DEF-0B4-CBAS-DETAIL-GET-WRITES-VIEW-COUNT', [A + 'app/api/cbas/[id]/route.ts', A + 'app/api/__tests__/cbas-bargaining-notes.route.test.ts', CONTRACT],
      'Reading one agreement counts no view, whatever the include flags; the view counter is no longer incremented by a read.'),
    item('DEF-0B6-CMP-COMPLIANCE-LISTS-UNBOUNDED', [A + 'app/api/compliance/alerts/route.ts', A + 'app/api/compliance/reports/route.ts', CONTRACT],
      'The alert and report lists return at most 500 rows (the failure answer was fixed in B33).'),
    item('DEF-0B6-SYS-CONTACT-UNBOUNDED-FIELDS-AND-EMAIL-LOGGED', [A + 'app/api/contact/route.ts', A + 'app/api/__tests__/contact-acknowledgement.route.test.ts'],
      'Every contact field has a length bound (name 100, address 254, organization 200, role and inquiry type 100) and the visitor\'s address is no longer written to the log; tests cover an oversized field and the log content.'),
    item('DEF-0B11-PRP-PRECEDENT-COLLECTION-GET-TAKES-UNBOUNDED-LIMIT-AND-PAGE-FROM-THE-QUERY-STRING', [A + 'app/api/precedents/route.ts', A + 'app/api/__tests__/precedents.route.test.ts'],
      'The precedent collection refuses an invalid page or a limit above 100 with 400 (existing implementation and tests).'),
    item('DEF-0B11-PRP-REDEMPTIONS-GET-IGNORES-THE-STATUS-FILTER-AND-VALIDATES-AGAINST-AN-INCOMPLETE-LIST', [A + 'lib/services/rewards/redemption-service.ts', A + 'app/api/rewards/redemptions/route.ts', A + 'app/api/__tests__/rewards-redemptions-list.route.test.ts'],
      'The status filter reaches the query (and its total), and the accepted values are the six the redemption status can hold, including the ones a redemption starts in. Two existing assertions adapted for the added argument; new tests cover a valid and an invalid status.'),
    item('DEF-0B12-PLT-VOICE-TRANSCRIBE-RETURNS-THE-FILE-SIZE-IN-BYTES-AS-THE-DURATION', [A + 'app/api/voice/transcribe/route.ts', A + 'app/api/__tests__/voice-transcribe.route.test.ts'],
      'The transcription response carries no duration: neither bytes nor a guess is reported as a measured audio duration (existing implementation and test).'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B36 added')

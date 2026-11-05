const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B35-F06-AUDIT-READS-ALIASES-AND-READ-ONLY-GETS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B35 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f06-b35-records.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F06: an audit read serves the record and not the captured values, a recorded position and its audit commit together, and a GET changes nothing',
  evidenceCommit: null,
  items: [
    item('DEF-0B6-CMP-AUDIT-LOG-FULL-ROW-READ-BY-OFFICER', [A + 'app/api/compliance/audit-logs/route.ts', CONTRACT],
      'The organization audit-log list names eight columns (who, what, which resource, severity, outcome, time) and no longer serves the captured old and new values, network address, user agent, session and correlation ids, metadata, error text or archive path. The read is still audited in the same transaction.'),
    item('DEF-0B8-JUR-LOCATION-TRACK-WRITES-ARE-UNAUDITED-AND-REFUSALS-ANSWER-500', [A + 'app/api/location/track/route.ts', A + 'services/geofence-privacy-service.ts', A + 'app/api/__tests__/location-track.route.test.ts', CONTRACT],
      'The position insert and an audit record (purpose, strike or event, never the coordinates) commit in one transaction; a member who has not opted in gets 403, a disabled tracker 503, and any other failure a 500 without internal text. Test mocks extended for the new collaborators; three new route tests.'),
    item('DEF-0B8-JUR-INVESTIGATIONS-PATH-IS-THE-CASE-COLLECTION-NO-INVESTIGATION-RECORD', [A + 'app/api/investigations/route.ts', A + 'scripts/codemods/f02-domain-facades-501.cjs', A + 'lib/api/__tests__/roster-facades.contract.test.ts', CONTRACT],
      'The investigations path was an alias of the case collection (a create made a case); it answers 501 and the roster-facade ratchet pins it.'),
    item('DEF-0B8-JUR-INVESTIGATIONS-AUDIT-PATH-RETURNS-THE-WHOLE-ORGANIZATION-AUDIT-LOG', [A + 'app/api/investigations/audit/route.ts', A + 'lib/api/__tests__/roster-facades.contract.test.ts', CONTRACT],
      'The investigation audit path no longer returns the organization audit log under another name; it answers 501.'),
    item('DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD', [A + 'app/api/investigations/route.ts', A + 'app/api/investigations/audit/route.ts', CONTRACT],
      'The two investigation aliases lost their always-true guard along with their delegation.',
      { status: 'PARTIAL', remaining: 'Other wrappers (governance, intelligence, the oci paths and the communications tracking handlers) still carry a requireOrgAccess that returns true for every request.' }),
    item('DEF-0B4-CLAUSES-ITEM-GET-WRITES-VIEW-COUNT', [A + 'app/api/clauses/[id]/route.ts', A + 'app/api/__tests__/clauses-id.route.test.ts', CONTRACT],
      'Reading a clause by id writes nothing. Test adapted from countView true to false; the clause view counter is no longer incremented by a read.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B35 added')

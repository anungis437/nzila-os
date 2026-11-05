const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B33-F12-TRUTHFUL-READS-SCHEMA-CHECKED-JOBS-AND-RECORD-LIFECYCLE'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B33 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f12-b33-responses.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })

// The shared library routes of B31 are completed here: the service behind them applied no restriction either.
for (const b of ledger.batches) {
  for (const i of b.items) {
    if (i.prefix === 'DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT' && !i.files.includes(A + 'lib/services/precedent-service.ts')) {
      i.files.push(A + 'lib/services/precedent-service.ts', A + 'lib/services/__tests__/precedent-service.test.ts')
      i.explanation += ' The precedent service behind the search, list and by-id reads applies the same restriction (B33).'
    }
  }
}

ledger.batches.push({
  id: ID,
  family: 'F12: a job runs statements the schema declares, a read states a failure as a failure, an acknowledgement means the record exists, and a removed record is no longer read or counted',
  evidenceCommit: null,
  items: [
    item('DEF-0B6-EDU-CRON-QUERIES-REFERENCE-COLUMNS-ABSENT-FROM-SCHEMA', [A + 'lib/education/reminder-queries.ts', A + 'lib/education/__tests__/reminder-queries.pglite.test.ts', A + 'app/api/cron/education-reminders/route.ts', A + 'app/api/__tests__/cron-education-reminders.route.test.ts', CONTRACT],
      'Both reminder statements now name only columns the training schema declares (start_date, venue, lead_instructor_name, certification_number, the organization_members row that carries the name and e-mail) and join every table on the organization; they run against tables created from the declared schema, with positive and negative cases (cancelled, inactive, revoked, other organization). Route test adapted only to the new row field names.',
      { },
    ),
    item('DEF-0B8-JUR-BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS', [A + 'lib/canadian-labour-standards/termination-notice.ts', A + 'lib/canadian-labour-standards/__tests__/termination-notice-tiers.test.ts'],
      'British Columbia now has an open-ended top tier at the statutory maximum of eight weeks, and a test asserts that every jurisdiction ends in an open tier and that tiers are contiguous and non-decreasing. The lower British Columbia tiers were not changed here; they were not checked against the statutory text.'),
    item('DEF-0B8-JUR-WCB-REPORTING-DEADLINE-SERVED-AS-ARBITRATION-DEADLINE', [A + 'app/api/jurisdiction-rules/route.ts', A + 'app/api/__tests__/jurisdiction-rules-deadline.route.test.ts'],
      'The rules route serves the board as a reference with verification required and no deadline number under an arbitration category (existing implementation and test).'),
    item('DEF-0B11-PRP-PROFILE-ME-GET', [A + 'db/queries/profiles-queries.ts', A + 'db/queries/__tests__/profiles-queries.test.ts', A + 'app/api/profile/me/route.ts', A + 'app/api/__tests__/profile-me.route.test.ts'],
      'A new strict lookup throws on a failed or timed-out query (and clears its timer); the profile route answers that as a failure, and says no profile exists only when the lookup completed and found none. The tolerant lookup remains for callers that treat failure as no profile.'),
    item('DEF-0B6-SYS-CONTACT-ACKNOWLEDGES', [A + 'app/api/contact/route.ts', A + 'app/api/__tests__/contact-acknowledgement.route.test.ts'],
      'The contact form answers 503 instead of ok when the CRM did not record the contact or the message, so a visitor is no longer told it was received when nothing recorded it.',
      { status: 'PARTIAL', remaining: 'There is still no local store: a submission exists only in HubSpot, and an unconfigured CRM refuses every contact submission.' }),
    item('DEF-0B6-CMP-READ-FAILURE', [A + 'app/api/compliance/alerts/route.ts', A + 'app/api/compliance/reports/route.ts', A + 'app/api/__tests__/compliance-read-failures.route.test.ts'],
      'A failed alert or report query answers 500 instead of an empty success, and both lists are bounded to 500 rows.'),
    item('DEF-0B12-PLT-QUEUE-STATUS-GIVES-ANY-SIGNED-IN-SESSION', [A + 'app/api/union-eyes/queue-status/route.ts', A + 'app/api/__tests__/queue-status.route.test.ts', CONTRACT],
      'Queue counts and failed task names are for the control-plane key or a platform administrator and refuse a signed-in member (existing implementation; the contract test pins the administrator check before the queue read).'),
    item('DEF-0B12-PLT-ORGANIZATIONS-RESPONSE-FABRICATES', [A + 'app/api/users/me/organizations/route.ts', A + 'app/api/__tests__/users-me-organizations.route.test.ts', CONTRACT],
      'A missing stored creation, update or join time is returned as null rather than the time of the call.',
      { }),
    item('DEF-0B12-PLT-VOCABULARY-ROUTES-SET', [A + 'app/api/vocabulary/route.ts', A + 'app/api/vocabulary/statuses/route.ts', A + 'app/api/vocabulary/severities/route.ts', A + 'app/api/vocabulary/roles/route.ts', A + 'app/api/vocabulary/priorities/route.ts', A + 'app/api/vocabulary/case-types/route.ts', CONTRACT],
      'All six vocabulary routes serve a signed-in response with Cache-Control private, so a shared cache cannot hand it to a caller without a session.'),
    item('DEF-0B11-PRP-PRECEDENT-SEARCH-USES', [A + 'lib/services/precedent-service.ts', A + 'lib/services/__tests__/precedent-service.test.ts', A + 'app/api/precedents/search/route.ts', CONTRACT],
      'Search terms take the LIKE wildcards literally, the search accepts only the two filters it reads (strict, bounded lists), and a filter value outside the column\'s declared values is refused with 400 instead of reaching the database as a 500. The same service also excludes decisions marked not public or restricted.'),
    item('DEF-0B12-WBK-CHECKOUT-READS-THE-USER-OWNED-WORKBOOKS-TABLE-OUTSIDE-ANY-DATABASE-CONTEXT', [A + 'app/api/workbook/checkout/route.ts', A + 'app/api/__tests__/workbook-checkout.route.test.ts', CONTRACT],
      'The unclaimed-workbook read runs under the explicit system context, as the start and claim routes do, instead of on the pooled connection with no user context. Test adapted to the new context call; new tests cover 404 and 503.'),
    item('DEF-0B8-HS-ARCHIVED-ROWS', [A + 'app/api/health-safety/hazards/route.ts', A + 'app/api/health-safety/hazards/[id]/route.ts', A + 'app/api/health-safety/incidents/route.ts', A + 'app/api/health-safety/incidents/[id]/route.ts', A + 'app/api/health-safety/hazards/stats/route.ts', A + 'app/api/health-safety/incidents/stats/route.ts', A + 'app/api/health-safety/incidents/trends/route.ts', A + 'app/api/health-safety/dashboard/route.ts', A + 'lib/api/crud-factory.ts', CONTRACT],
      'An archived incident or hazard is neither listed nor returned by id (the new readCondition), and the statistics, trends and dashboard no longer count it as open, critical or part of a total.',
      { status: 'PARTIAL', remaining: 'The counts are pinned by source only; no test runs the statistics against rows holding an archived status.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B33 added')

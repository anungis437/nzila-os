const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B26-F12-VERIFIED-CREDITS-EDUCATION-ANALYTICS-CALENDAR'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B26 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F12: route-specific defects already repaired in source, credited only where an existing or new test pins the repair',
  evidenceCommit: null,
  items: [
    item('DEF-0B6-EDU-REGISTRATION-MEMBER-SETS-COMPLETION-FEE-AND-APPROVAL-FIELDS', [A + 'app/api/education/registrations/route.ts', A + 'app/api/education/registrations/__tests__/route.test.ts'],
      'A registration forces the member identity and the registered state and ignores every client-sent completion, payment, attendance, grade, certification and subsidy field; its course and session must belong to the organization (upstream\'s change, existing test).'),
    item('DEF-0B6-EDU-CERTIFICATION-ISSUED-WITHOUT-COMPLETION-OR-VERIFICATION', [A + 'app/api/education/certifications/route.ts', A + 'lib/api/__tests__/f12-education-certification.contract.test.ts'],
      'A certification is created only from a completed, passed registration of the organization for a course that issues one, as a pending candidate with no verifier, verification date, badge or certificate URL (upstream\'s change). Only a source contract pins it; the route has no behavioural test.'),
    item('DEF-0B9-ORG-ANALYTICS-ANY-SIGNED-IN-USER-READS-ANY-ORGANIZATION-NAME-TYPE-CHILD-COUNT-AND-AGGREGATES-BY-PATH-ID', [A + 'app/api/organizations/[id]/analytics/route.ts', A + 'app/api/__tests__/organizations-id-analytics.route.test.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'The analytics route answers 404 to a caller with no read authority over the organization named in the path and is officer-level for those who have it (batch B11 and upstream, existing tests including real SQL).'),
    item('DEF-0B4-CALENDAR-OAUTH-STATE-IS-USER-ID', [A + 'lib/external-calendar-sync/oauth-state.ts', A + 'lib/external-calendar-sync/__tests__/oauth-state.test.ts', A + 'app/api/calendar-sync/google/auth/route.ts', A + 'app/api/calendar-sync/microsoft/auth/route.ts'],
      'The OAuth state is an unpredictable signed value bound to the browser, provider, user and organization, expiring, carried in an HttpOnly cookie and verified before any token exchange; it fails closed without a signing key (upstream\'s change, existing test).'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B26 added')

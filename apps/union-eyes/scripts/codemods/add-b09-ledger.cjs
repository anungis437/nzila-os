// Appends batch B09 to the elimination ledger (idempotent).
const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
if (ledger.batches.some((b) => b.id === 'B09-F02-FACADES-AND-PLACEHOLDERS')) {
  console.log('B09 already present')
  process.exit(0)
}
const A = 'apps/union-eyes/'
const roster = [A + 'lib/api/__tests__/roster-facades.contract.test.ts', A + 'scripts/codemods/f02-roster-facades-501.cjs']
const domain = [A + 'lib/api/__tests__/roster-facades.contract.test.ts', A + 'scripts/codemods/f02-domain-facades-501.cjs']
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })

ledger.batches.push({
  id: 'B09-F02-FACADES-AND-PLACEHOLDERS',
  family: 'F02: paths that advertise an operation but were generic CRUD over an unrelated table, or placeholder context routes',
  evidenceCommit: null,
  items: [
    item('DEF-0B1-CRUD-FACADE-ORG-MEMBERS', roster,
      'Every route that was the generic CRUD factory over organization_members under a name that advertises another operation (admin alerts, dues, employment, job classifications, leaves, PKI, roles, segments, system settings, bulk import, member search and others) now answers HTTP 501 behind its original role floor. Only members/[id] still binds the roster table. A contract test fails if another route binds it again. The earlier behaviour (a roster listing presented as the operation, or a refused write) is removed rather than preserved.'),
    item('DEF-0B2-CRUD-FACADE-SEGMENTS-SETTINGS', roster,
      'admin/segments, its item and execute routes and admin/system/settings no longer present another table\'s rows as the operation; they answer 501.'),
    item('DEF-0B7-PLT-EQUITY-ROUTES-ARE-MEMBER-SEGMENT-CRUD-FACADE', domain,
      'equity/monitoring, self-identify and snapshots answered the generic factory over member_segments. Special-category equity data is neither collected nor monitored there, so they answer 501 and expose no segment rows.'),
    item('DEF-0B11-IDS-SUPPORT-METRICS-AND-SLA-ROUTES-SERVE-NOTIFICATION-ROWS', domain,
      'support/metrics and support/sla answered notification rows as support figures; they answer 501.'),
    item('DEF-0B12-CRUD-SUPPORT-TICKET-PATHS-SERVE-NOTIFICATION-ROWS', domain,
      'The ticket collection, item, assign and comments routes answered the same notification rows (assign and comments were the item route); all answer 501.'),
    item('DEF-0B10-ORG-ROUTES-NAMED-FOR-CARD-CHECK-SUPPORT-NOTES-SEQUENCES-FILINGS-AND-FORMS', domain,
      'The fourteen organizing routes named for assignments, card check, committee, forms, labour board, filings, notes, sequences, support percentage and workplace mapping were campaign-row CRUD. They answer 501 at the officer floor; only organizing/campaigns remains a campaign route.'),
    item('DEF-0B6-SYS-INHERITANCE-IS-PENDING-PROFILES-REFUSED-BY-GOVERNANCE', domain,
      'continuity/inheritance answered the pre-signup pending_profiles table. It answers 501; the table is no longer bound, so its governance entry was removed (an unlisted table is refused by the fail-closed default). The route test that pinned the old factory configuration was rewritten to pin the 501.'),
    item('DEF-0B9-ASM-ONBOARDING-TRANSFERS-PATH-IS-THE-EVENT-RECORDER', domain,
      'onboarding/transfers re-exported the event recorder behind a guard that always passed; it answers 501. The test that asserted transfers delegated to the audited recorder (and returned 200) was replaced by an assertion that the route answers 501 and does not reuse the recorder.'),
    item('DEF-0B9-ASM-ONBOARDING-READINESS-IS-THE-PENDING-PROFILES-ROUTE', domain,
      'onboarding/readiness wrapped the pending-profiles handlers behind a placeholder guard; it answers 501.'),
    item('DEF-0B11-RPT-SHARE-ITEM-PATH-SHARES-NOTHING-AND-ITS-DELETE-REMOVES-THE-REPORT', domain,
      'reports/[id]/share no longer exposes the report table; its DELETE can no longer remove a report. It answers 501 until a recipient grant exists.'),
    item('DEF-0B12-CRUD-UPLOAD-PATH-IS-A-JSON-MEDIA-ROW-INSERT', domain,
      'upload answered a JSON insert of a media-library row that receives no file; it answers 501 so a posted file is never reported stored.'),
    item('DEF-0B6-CMP-INTEGRATIONS-ROUTE-OVER-USER-TOKEN-TABLE', domain,
      'enterprise/integrations was the generic factory over oauth_providers (per-user provider ids and tokens, no organization); it answers 501 and the table\'s governance entry was removed with its last binding.'),
    item('DEF-0B7-PLT-ENT-EMPTY-200-WITHOUT-ORGANIZATION-AND-SECOND-RESOLUTION', domain,
      'The enterprise integrations path no longer answers an empty 200 for a caller without an organization; it answers 501.'),
    item('DEF-0B7-PLT-EVENT-OCCURRENCES-PATH-ADDRESSES-WHOLE-EVENT-ROW', domain,
      'events/[id]/occurrences was a byte-for-byte copy of the event item route; it answers 501.'),
    item('DEF-0B6-SYS-CONTINUITY-ALIASES-ARE-THE-DOCUMENT-REPOSITORY-WITH-PLACEHOLDER-GUARD', [A + 'app/api/continuity/inheritance/route.ts'],
      'The inheritance alias is removed (501). The archives and docs aliases still wrap the document repository and are not yet changed.', { status: 'PARTIAL', remaining: 'continuity/archives and continuity/docs remain placeholder-guard wrappers over the document repository.' }),
    item('DEF-0B9-ORG-CURRENT-CONTEXT-ROUTE-RETURNS-PLACEHOLDER-ORGANIZATION', [A + 'app/api/org/current/route.ts', A + 'app/api/__tests__/platform-current-and-queue.route.test.ts'],
      'org/current reads the caller\'s organization (name, slug, tier, enabled features) under its RLS context and answers 404 when there is no row, instead of a placeholder with a null name.'),
    item('DEF-0B12-PLT-TENANT-CURRENT-ANSWERS-200-WITH-NULL-NAME-SLUG-AND-TIER', [A + 'app/api/tenant/current/route.ts', A + 'app/api/__tests__/platform-current-and-queue.route.test.ts'],
      'tenant/current answers 410 Gone, pointing at org/current. Its old route test (asserting the placeholder body) was deleted and superseded by the 410 test.'),
    item('DEF-0B12-PLT-QUEUE-STATUS-ANSWERS-AUTHENTICATION-FAILURE-AS-503', [A + 'app/api/union-eyes/queue-status/route.ts', A + 'app/api/__tests__/platform-current-and-queue.route.test.ts', A + 'app/api/__tests__/queue-status.route.test.ts'],
      'Access is the service key or a signed-in platform administrator (401 / 403 otherwise); the error text is logged, not returned. The existing queue-status test was adapted to mock the platform-admin guard and logger.'),
    item('DEF-0B12-PLT-V2-CATCH-ALL-ANSWERS-200-FOR-POST-PUT-PATCH-AND-DELETE', [A + 'app/api/__tests__/v2-catch-all-gone.route.test.ts'],
      'The catch-all already answers 410 for every method; the source change was upstream\'s and is covered by an existing test.'),
    item('DEF-0B12-PLT-V2-CATCH-ALL-ANSWERS-200-WITH-A-DEPRECATION-OBJECT', [A + 'app/api/__tests__/v2-catch-all-gone.route.test.ts'],
      'Same: 410 with no data body, upstream\'s change, existing test.'),
    item('DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200', [A + 'app/api/__tests__/carbon-not-implemented.route.test.ts'],
      'Carbon routes already answer 501; upstream\'s change, existing test.'),
    item('DEF-0B9-ORG-ACCESS-LOGS-ROUTE-IS-ORGANIZATIONS-ROW-CRUD', [A + 'app/api/__tests__/crud-routes-coverage.test.ts'],
      'The route already answers 501 with no organization row read or written; upstream\'s change, existing test.'),
    item('DEF-0B9-ORG-SHARING-SETTINGS-ROUTE-IS-ORGANIZATIONS-ROW-CRUD', [A + 'app/api/__tests__/crud-routes-coverage.test.ts'],
      'Same as access-logs.'),
    item('DEF-0B9-ML-SLA-CASE-ID-IS-NEVER-VERIFIED', [A + 'lib/ml/sla-breach-score.ts'],
      'The case is verified against the organization (B08).', { status: 'PARTIAL', remaining: 'The case id is still not stored on the prediction row.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B09 added')

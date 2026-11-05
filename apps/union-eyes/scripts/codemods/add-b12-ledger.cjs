// Appends batch B12 to the elimination ledger and completes the B09 continuity item (idempotent).
const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B12-F02-FINANCE-CBA-COMPLIANCE-ICRA-ONBOARDING'

const b09 = ledger.batches.find((b) => b.id === 'B09-F02-FACADES-AND-PLACEHOLDERS')
const cont = b09.items.find((i) => i.prefix.startsWith('DEF-0B6-SYS-CONTINUITY-ALIASES'))
cont.status = 'IMPLEMENTED_PENDING_QUALIFICATION'
delete cont.remaining
cont.explanation = 'The inheritance, archives and docs aliases (the pending-profile table and the document repository behind a guard that always returned true) all answer 501; the document repository itself is reached at /api/documents/repository.'

if (ledger.batches.some((b) => b.id === ID)) {
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
  console.log('B12 already present')
  process.exit(0)
}
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
const facade = [A + 'scripts/codemods/f02-domain-facades-501.cjs', A + 'lib/api/__tests__/roster-facades.contract.test.ts']

ledger.batches.push({
  id: ID,
  family: 'F02: invoices, CBA export and comparison, committee intelligence, dispatch, ICRA checkout, onboarding, reconciliation, testimonials and vocabulary state only what they do',
  evidenceCommit: null,
  items: [
    item('DEF-0B3-EXTERNAL-INVOICES-WRITE-ADVERTISED', [A + 'app/api/billing/invoices/route.ts', A + 'lib/api/crud-governance.ts', A + 'lib/api/__tests__/roster-facades.contract.test.ts'],
      'An external invoice is a copy of a provider record, and nothing ingests one. The collection keeps its mandate-checked read; POST answers 501 instead of writing a hand-made financial row through the generic factory, and the table\'s governance entry was removed with its last binding.'),
    item('DEF-0B3-SEND-INVOICE-NOT-SENT', [...facade, A + 'app/api/billing/send-invoice/route.ts', A + 'app/api/__tests__/billing-send-invoice.route.test.ts'],
      'The route generated a platform invoice and delivered nothing. It answers 501 behind the steward floor (generation remains POST /api/finance/invoices and the billing batch). Its test, which asserted the generation, was replaced by an assertion of the 501 and of the absence of the generator.'),
    item('DEF-0B4-CBA-EXPORT-SILENTLY-TRUNCATED', [A + 'app/api/cba-intelligence/agreements/export/route.ts', A + 'app/api/__tests__/cba-agreements-export.route.test.ts'],
      'The export asked for 10000 rows but the list serves at most 100 a page, so the file silently held the first page. It reads every page and refuses (400) a result set over 10000, naming the count, instead of cutting it.'),
    item('DEF-0B4-CLAUSE-LIBRARY-COMPARE-GET-STUB-AND-EMPTY-KEYWORDS', [A + 'app/api/clause-library/compare/route.ts', A + 'lib/clause-library/common-keywords.ts', A + 'lib/clause-library/__tests__/common-keywords.test.ts', A + 'app/api/__tests__/clause-library-compare.route.test.ts'],
      'The GET stub (a 200 with a usage hint) is removed (405). commonKeywords is now computed from the compared clause texts (words of four letters or more, not stop words, present in every clause, ranked by frequency; English and French). Clause ids are validated as ids and a malformed body is a 400. The route test fixtures use real ids now.'),
    item('DEF-0B5-COMMITTEE-INTELLIGENCE-PLACEHOLDER-RETURNED-AS-RESULT', [A + 'app/api/committees/[id]/intelligence/route.ts'],
      'POST stored a snapshot whose summary said synthesis was pending and whose themes, positions and recommendations were empty. It checks authority and then answers 501; nothing is stored. The snapshot list is unchanged.'),
    item('DEF-0B6-CMP-FIREWALL-POLICY-NO-WRITER-OR-ENFORCER', [...facade, A + 'app/api/compliance/data-classification-policy/route.ts'],
      'The route served a table no route writes and nothing enforces under the name of an employer data firewall. It answers 501 and the table\'s governance entry was removed.'),
    item('DEF-0B6-CMP-DISPATCH-RULES-ENGINE-NEVER-APPLIED', [A + 'lib/services/dispatch-engine.ts', A + 'app/api/dispatch/assign/route.ts', A + 'app/api/__tests__/dispatch-assignment.pglite.test.ts', A + 'lib/services/__tests__/dispatch-engine.test.ts'],
      'An assignment accepted any member ids for a request in any state, in any number, with no check that they were members, and counted the request filled from the ids of one call. It now requires an open or partly filled request of the caller\'s organization (row locked), active members of that organization, no worker already offered or placed, and no more offers than workers requested, with a distinct status for each refusal. Proven on real SQL. Three mock-chain tests of assignWorkersToDispatch were removed because the mocks cannot express these queries; the pglite suite replaces them.',
      { status: 'PARTIAL', remaining: 'rankCandidates still scores a candidate list nothing supplies (no source of member skills or availability), and the assignment is an officer\'s explicit selection, not engine-ranked.' }),
    item('DEF-0B6-CMP-DASHBOARD-STATS-FAILURE-RETURNS-ZEROS', [A + 'app/api/dashboard/stats/route.ts', A + 'app/api/__tests__/dashboard-stats.route.test.ts'],
      'A failed query is an error and the member count is null for an ordinary member, not zero; upstream\'s change, covered by an existing test.'),
    item('DEF-0B6-CMP-EXPORT-CSV-AUTHENTICATION-ONLY-AND-EMPTY-200-OUTSIDE-PRODUCTION', [A + 'app/api/dashboard/export-csv/route.ts', A + 'app/api/__tests__/dashboard-export-csv-containment.route.test.ts'],
      'The export answers 501 in every environment; upstream\'s change, covered by an existing test.'),
    item('DEF-0B8-ICRA-PAID-PDF-REPORT-GATE-REQUIRES-STATUS-COMPLETED-NO-WRITER', [A + 'app/api/icra/report/[assessmentId]/route.ts', A + 'app/api/__tests__/icra-report-assessmentId.route.test.ts'],
      'The report gate accepts submitted as well as completed, so a paid report is no longer refused for a status nothing writes; upstream\'s change, covered by an existing test.'),
    item('DEF-0B8-ICRA-CHECKOUT-SELLS-A-TIER-WITHOUT-REQUIRING-A-SUBMITTED-ASSESSMENT', [A + 'app/api/icra/checkout/route.ts', A + 'app/api/__tests__/icra-checkout.route.test.ts'],
      'Checkout now reads the assessment status and answers 409 with no Stripe session unless the assessment is submitted or completed, so a buyer is never charged for a report the report route would refuse.'),
    item('DEF-0B8-ICRA-INTEGRATION-CREDENTIALS-NEVER-STORED-OR-RESOLVED-YET-REPORTED-STORED', [A + 'lib/integrations/control-plane.ts', A + 'lib/integrations/__tests__/control-plane-audit.test.ts'],
      'The public configuration no longer reports credentialsStored: true for every integration: it reports false, with credentialsResolvable false, because only a reference is held.',
      { status: 'PARTIAL', remaining: 'A credentialRef is still accepted and stored and nothing resolves it to a secret; a vault-backed resolution path does not exist.' }),
    item('DEF-0B9-MOB-MEETING-ROOM-BOOKING-RULES-ARE-STORED-BUT-NO-ROUTE-OR-SERVICE-ENFORCES-A-BOOKING', [A + 'app/api/meeting-rooms/[id]/bookings/route.ts', A + 'lib/services/room-booking-rules.ts'],
      'The bookings route answers 501 and reads and writes nothing; the booking rules are implemented and tested in room-booking-rules.ts.',
      { status: 'PARTIAL', remaining: 'The physical room_bookings table lacks the columns the application declares and has no runtime grant; booking needs that migration before the rules can be wired in.' }),
    item('DEF-0B9-ASM-FEDERATION-MATCH-IGNORES-THE-SECTOR-AND-REPORTS-SIMILAR-SIZE-FOR-ANY-RATIO', [A + 'lib/utils/smart-onboarding.ts', A + 'lib/__tests__/smart-onboarding.test.ts'],
      'The sector now scores (25, case-insensitive match against the federation\'s sectors) and "Similar size" is stated only when the smaller count is at least half the larger. The reason text "Similar size category", which was given for any ratio, is gone and its test was changed to the new text.'),
    item('DEF-0B9-ASM-SMART-DEFAULTS-ARE-A-LITERAL-TABLE-OF-FEATURES-AND-INTEGRATIONS', [...facade, A + 'app/api/onboarding/smart-defaults/route.ts', A + 'app/api/__tests__/onboarding-smart-defaults.route.test.ts'],
      'The route served a literal table of features, integrations and limits by organization type that nothing defines or applies. It answers 501; its test of the table was replaced by an assertion of the 501.'),
    item('DEF-0B11-PRP-RECONCILIATION-RUNS-ARE-NOT-REPEATABLE-AND-THE-BILLING-PERIOD-IS-NOT-BOUND-TO-THE-ORGANIZATION', [A + 'services/platform-economics/reconciliation-service.ts', A + 'services/platform-economics/__tests__/reconciliation-service.test.ts'],
      'For an organization run, the period is locked, a billing period named in the request must be the organization\'s own (404), and a second run for the same period is refused (409, naming the earlier run) instead of adding a second set of exceptions. A period that ends before it starts is refused. The existing mocked test of a run gained the two new checks in its queue; three tests were added.',
      { status: 'PARTIAL', remaining: 'The service still accepts a run with no organization, which reconciles every organization together; no route uses that mode, but it is not removed.' }),
    item('DEF-0B12-CRUD-TESTIMONIAL-APPROVAL-COMPONENT-SENDS-FIELDS-THE-TABLE-DOES-NOT-HAVE', [A + 'components/admin/testimonial-approval-actions.tsx', A + 'app/api/testimonials/[id]/route.ts', A + 'app/api/__tests__/testimonials-approval.route.test.ts'],
      'The component sent status, reviewedAt, reviewedBy, rejectionReason and isFeatured; the table has approvedAt and featured only. It now sends those, the route stamps the approval with the server clock once, and the reject flow is removed because the table cannot record a rejection (the component has no importer).'),
    item('DEF-0B12-PLT-VOCABULARY-SERVES-UNSOURCED-SERVICE-LEVEL-HOURS-ROLE-FLAGS-AND-TRANSITIONS', [A + 'lib/vocabulary/public-vocabulary.ts', A + 'lib/vocabulary/__tests__/public-vocabulary.test.ts', A + 'app/api/vocabulary/route.ts'],
      'The six vocabulary routes serve identifiers, labels, descriptions and categories only. Service-level hours, escalation, legal and settlement flags, role permissions, default priority and severity, and status transitions are no longer served as institutional reference data; the case state machine still reads them from the package server-side.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B12 added')

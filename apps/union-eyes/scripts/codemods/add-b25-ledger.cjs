const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B25-F03-ORGANIZATION-BOUND-REFERENCES-AND-VERIFIED-CREDITS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B25 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F03: a reference in a body names a row of the caller\'s own organization or is refused, and a read over joined or hierarchical data stays inside the caller\'s organization',
  evidenceCommit: null,
  items: [
    item('DEF-0B4-CLAUSES-CREATE-ACCEPTS-ANY-CBA-ID', [A + 'app/api/clauses/route.ts', A + 'app/api/__tests__/clauses-references.route.test.ts'],
      'A clause create verifies that the agreement belongs to the caller\'s organization (404 otherwise) and that any parent clause is a clause of the same agreement, and accepts only author fields: the embedding, hash, confidence, extracted entities and counters are processing outputs.'),
    item('DEF-0B12-CRUD-UNIT-AND-WORKSITE-FOREIGN-KEYS-ARE-TAKEN-FROM-THE-BODY-WITHOUT-AN-ORGANIZATION-CHECK', [A + 'lib/api/org-references.ts', A + 'lib/api/__tests__/org-references.test.ts', A + 'app/api/units/route.ts', A + 'app/api/units/[id]/route.ts', A + 'app/api/worksites/route.ts', A + 'app/api/worksites/[id]/route.ts'],
      'The employer and worksite ids taken from a unit or worksite body are checked against the caller\'s organization on create and update (400 malformed, 404 not the organization\'s). Test disclosure: the two worksite route tests that pin the factory options now expect the reference hook.'),
    item('DEF-0B11-RPT-EXECUTE-JOINED-TABLES-CARRY-NO-ORGANIZATION-PREDICATE-SO-A-CALLER-CONFIGURED-JOIN-SELECTS-ROWS-OF-OTHER-ORGANIZATIONS', [A + 'lib/report-executor.ts', A + 'lib/__tests__/report-executor-tenancy.pglite.test.ts'],
      'Every joined table is bound to the caller\'s organization inside its own ON clause, and a join must follow a declared relationship; proven on real SQL for non-equi, LEFT, RIGHT and FULL joins (upstream\'s change, existing test).'),
    item('DEF-0B11-PRP-PROFILE-ROLES-GET-LISTS-EVERY-USER-BILLING-PROFILE-TO-STEWARD-AND-ABOVE-OF-ANY-ORGANIZATION', [A + 'app/api/profile/roles/route.ts', A + 'app/api/__tests__/profile-roles.route.test.ts'],
      'The route returns only the caller\'s own live roles; it is no longer the generic factory over the unscoped profiles table (upstream\'s change, existing test).'),
    item('DEF-0B5-SURVEY-RESULTS-NO-ORG-PREDICATE-LOADS-ALL-ANSWERS', [A + 'app/api/communications/surveys/[surveyId]/results/route.ts', A + 'app/api/communications/surveys/[surveyId]/results/route.test.ts'],
      'The survey, its responses and its questions are all read with the caller\'s organization predicate (upstream\'s change, existing test).'),
    item('DEF-0B12-CRUD-TESTIMONIAL-ITEM-WRITES-ARE-CONDITIONED-ON-THE-ID-ALONE-FOR-AN-ADMIN-OF-ANY-ORGANIZATION', [A + 'app/api/testimonials/[id]/route.ts', A + 'app/api/__tests__/wave1-route-floors.test.ts'],
      'The unscoped shared item is written only at the platform content-manager floor, so an organization administrator cannot change it by id (upstream\'s change, existing floor test).'),
    item('DEF-0B10-OPL-01', [A + 'app/api/organizations/route.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'The organization list resolves the caller\'s read authority (active membership, an administered ancestor, or platform) and returns a projection under explicit scope instead of relying on the connection role; proven on real SQL (upstream\'s change, existing test).'),
    item('DEF-0B10-OPL-02', [A + 'app/api/organizations/route.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'A malformed parent or status filter is a 400 before any read, and the list is bounded at 1000 rows (existing test).',
      { status: 'PARTIAL', remaining: 'The administration pages still treat the list as the union\'s organizations for choosing a parent; for a caller with no ancestor authority it is only their own row.' }),
    item('DEF-0B10-OPL-05', [A + 'app/api/organizations/search/route.ts', A + 'app/api/__tests__/organization-directory-privacy.contract.test.ts'],
      'The search is limited to the organizations the caller may read and exposes member counts only to administrative readers (upstream\'s change, existing contract test).'),
    item('DEF-0B10-OPL-07', [A + 'app/api/organizations/tree/route.ts', A + 'app/api/organizations/hierarchy/route.ts', A + 'app/api/__tests__/organization-directory-privacy.contract.test.ts'],
      'The tree and hierarchy read the system context only after resolving the caller\'s readable organization ids, and are bounded (upstream\'s change, existing contract test).'),
    item('DEF-0B10-PIL-CUPE-BOOTSTRAP-RESET-DELETES-ALL-GRIEVANCES-MEMBERS-AND-CHECKLIST-ROWS-OF-THE-ORGANIZATION-AT-THE-FIXTURE-SLUG-WITH-NO-DEMO-MARKER', [A + 'app/api/pilot/bootstrap/cupe/route.ts', A + 'app/api/__tests__/pilot-bootstrap-cupe.route.test.ts'],
      'The reset needs a system administrator, a pilot or demo runtime and an explicit confirmation naming the organization (upstream\'s change, existing test).',
      { status: 'PARTIAL', remaining: 'Seeded rows still carry no demo marker, so a reset deletes by organization and slug rather than by marker.' }),
    item('DEF-0B6-CMP-DISPATCH-REFERENCED-IDS-NOT-VERIFIED', [A + 'lib/services/dispatch-engine.ts', A + 'app/api/__tests__/dispatch-assignment.pglite.test.ts'],
      'Dispatch assignment verifies the request and every worker id against the organization with the request locked, proven on real SQL (batch B12).'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B25 added')

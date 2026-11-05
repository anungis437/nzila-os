// Appends batch B11 to the elimination ledger (idempotent).
const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B11-F02-ORG-REPORTS-SOCIAL-SATISFACTION'
if (ledger.batches.some((b) => b.id === ID)) {
  console.log('B11 already present')
  process.exit(0)
}
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })

ledger.batches.push({
  id: ID,
  family: 'F02: organization figures, report engine, signature, social analytics, satisfaction and settings answer from stored records or refuse',
  evidenceCommit: null,
  items: [
    item('DEF-0B9-ORG-ANALYTICS-METRIC-QUERIES-RUN-IN-SESSION-ORGANIZATION-CONTEXT', [A + 'app/api/organizations/[id]/analytics/route.ts', A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts', A + 'app/api/__tests__/organizations-id-analytics.route.test.ts'],
      'The member, grievance and growth figures now run under the organization named in the path (its own identity for a direct member, the system role with the exact organization predicate for a platform or parent administrator already authorized), not the caller\'s own organization, so a federation administrator no longer reads zeros for a local. Average resolution days and the growth rate are null, not 0, when they are undefined. A real-SQL test proves the figures for the officer and for the administrator above. The unit test mocks were adapted to the new call shape (child count first, one members query).'),
    item('DEF-0B9-ORG-HIERARCHY-ROUTES-PASS-UNVALIDATED-PATH-ID-TO-UUID-COLUMN', [A + 'app/api/__tests__/organizations-read-authority.pglite.test.ts'],
      'The children, descendants, ancestors, members and path routes already validate the id (400) and answer 404 for an organization the caller cannot read; the source change was upstream\'s and is covered by an existing real-SQL test.'),
    item('DEF-0B10-OPL-03', [A + 'app/api/organizations/route.ts', A + 'app/api/organizations/__tests__/route.post-record-fields.test.ts'],
      'POST /api/organizations stores description, province_territory, charter_number and affiliation_date; a value of the wrong shape or an impossible date is refused with 400 rather than dropped under a 201.'),
    item('DEF-0B10-OPL-08', [A + 'app/api/organizations/tree/route.ts'],
      'The tree read is bounded to the organizations the caller may read, ordered and limited (upstream), and now runs as the system role like the hierarchy route instead of the ambient connection role.'),
    item('DEF-0B11-RPT-EXECUTE-ROUTE-ALLOWLIST-CHECKS-FILTER-FIELD-ID', [A + 'app/api/reports/execute/route.ts', A + 'app/api/__tests__/reports-execute.route.test.ts'],
      'The route kept its own table allowlist, different from the registry the builder and executor use. It now validates against the executor\'s registry only, so one list governs data sources, fields, filters, joins, having and limits (the executor already resolved and bounded those). The route test mock now uses the real registry.'),
    item('DEF-0B11-RPT-EXECUTE-FAILURE-IS-ANSWERED-200-WITH-NO-MESSAGE', [A + 'lib/report-executor.ts', A + 'app/api/reports/execute/route.ts', A + 'lib/middleware/api-security.ts', A + 'lib/__tests__/report-executor.test.ts', A + 'app/api/__tests__/reports-execute.route.test.ts'],
      'The executor reports a refused configuration (kind invalid) separately from a failed query (kind failed). The route answers 400 with the reason or 500, audits a validation failure or a failure, and never records an unsuccessful run as success or as an authentication failure. A database error message is no longer returned. Two executor tests that asserted the database message was returned were changed to assert it is not.'),
    item('DEF-0B11-RPT-DATA-SOURCE-REGISTRY-ADVERTISES-SOURCES-AND-COLUMNS', [A + 'lib/report-executor.ts', A + 'lib/__tests__/report-data-sources-schema.test.ts'],
      'The registry named columns the tables do not have (claims.outcome, members first_name/last_name, deadlines current_deadline) and a joinable table that is not a source (claim_notes). They now map to the physical columns (resolution_outcome, due_date), the member name is the single field name, and a new ratchet fails if a registry column is not a physical column of its table. A saved report that named first_name or last_name is refused rather than run against a missing column.'),
    item('DEF-0B11-SOC-INTERNAL-SIGNATURE-PROVIDER-IS-A-STUB-THAT-SENDS-NOTHING', [A + 'lib/signature/providers.ts', A + 'lib/signature/signature-service.ts', A + 'app/api/signatures/documents/route.ts', A + 'lib/signature/__tests__/providers.test.ts'],
      'The built-in provider generated envelope ids and sign URLs, stored and sent nothing, and reported every envelope as sent. It is removed: the default provider is a configured DocuSign or HelloSign account or a 501, and the document route refuses any other provider name. The tests of the stub were removed and replaced by tests that there is no built-in provider and no stub fallback.',
      { status: 'PARTIAL', remaining: 'Documents already stored with provider "internal" keep that value; their status sync reports provider_unavailable and their void is attempted against no provider.' }),
    item('DEF-0B11-SOC-ANALYTICS-AND-ENGAGEMENT-FIGURES-HAVE-NO-WRITER', [A + 'lib/social-media/social-media-service.ts', A + 'app/api/social-media/analytics/route.ts', A + 'lib/social-media/__tests__/social-media-service.test.ts', A + 'app/api/__tests__/social-media-analytics.route.test.ts'],
      'fetchAnalytics fetched platform responses it never transformed and returned an empty list as a success. It now answers 501 when nothing was collected, and the analytics read says (data_collected, message) whether analytics were ever collected instead of letting an empty range read as no activity.',
      { status: 'PARTIAL', remaining: 'No collector transforms the Meta, Instagram, Twitter or LinkedIn responses into the analytics table, and nothing calls fetchAnalytics, so no figure exists yet.' }),
    item('DEF-0B11-IDS-STEWARD-ROUTES-SERVE-ASSIGNMENT-ROWS', [A + 'app/api/__tests__/stewards-directory.route.test.ts'],
      'The directory route is a member-safe projection for members, full rows (audited) for officers, and answers 405 to writes; upstream\'s change, covered by an existing test.'),
    item('DEF-0B11-IDS-SATISFACTION-REPRESENTATIVE-FIGURES-FOR-AN-UNKNOWN', [A + 'app/api/satisfaction/lro/[lroId]/route.ts', A + 'app/api/__tests__/satisfaction-lro.route.test.ts'],
      'A representative with no completed surveys, or an unknown id, is a 404 rather than 200 with zero averages; a caller with no organization is refused rather than reading across organizations.'),
    item('DEF-0B11-IDS-SATISFACTION-CREATE-DOES-NOT-CHECK-CLAIM-STATE', [A + 'app/api/satisfaction/route.ts', A + 'app/api/__tests__/write-routes-atomic-audit.route.test.ts'],
      'A survey can only be created for a resolved or closed claim (409 otherwise), and a claim with no assigned representative is refused (400) instead of accepting any representative id. The existing test fixtures were given a claim status and extended with the new refusals.'),
    item('DEF-0B11-IDS-SETTINGS-PUT-IS-UNVALIDATED-AND-MERGES-OUTSIDE-THE-TRANSACTION', [A + 'app/api/settings/organization/route.ts', A + 'app/api/__tests__/settings-organization.route.test.ts'],
      'name (1-200), shortName (at most 50) and provinceTerritory (at most 100) are validated before anything is read; a missing body or organization is a 400, not a server error. The settings merge reads the row under FOR UPDATE and writes in the same transaction, and a missing row is a 404 with no audit.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B11 added')

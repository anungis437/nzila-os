// Appends batch B15 to the elimination ledger (idempotent).
const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B15-F04-DOMAIN-FACADES'
if (ledger.batches.some((b) => b.id === ID)) {
  console.log('B15 already present')
  process.exit(0)
}
const A = 'apps/union-eyes/'
const files = [A + 'scripts/codemods/f02-domain-facades-501.cjs', A + 'lib/api/__tests__/roster-facades.contract.test.ts']
const item = (prefix, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
const orphan = ' Their tables lost their last generic binding, so the governance entries for grievances, clc_sync_log, cms_media_library, cms_pages and organizer_tasks were removed (an unlisted table is refused by the fail-closed default); the "keeps grievances as OWN_ROWS_READ" case was removed from the governance test for that reason.'

ledger.batches.push({
  id: ID,
  family: 'F04: generic-CRUD facades advertising another capability answer 501 behind their original role floor',
  evidenceCommit: null,
  items: [
    item('DEF-0B4-CLC-ROUTES-FACADE-OVER-SYNC-LOG', 'clc/dashboard, clc/remittances and clc/sync served clc_sync_log rows under dashboard, remittance and sync names; all answer 501.' + orphan),
    item('DEF-0B4-CLAUSES-SEARCH-FACADE', 'clauses/search listed the clause table without searching; it answers 501.'),
    item('DEF-0B6-EDU-FACADE-PATHS-ARE-COURSE-CATALOG-CRUD', 'Certificate generation, renewal reminders, completion certificates and notification preferences were the training-course factory; all answer 501. The admin certification manager that posts to renewal-reminders now receives the 501 instead of a course row.'),
    item('DEF-0B6-CMP-COPE-ROUTES-ARE-DONATION-CAMPAIGN-FACADE', 'cope/canvassing and cope/officials served donation-campaign rows; they answer 501. cope/campaigns, the legitimate campaign collection, is unchanged. The canvassing interface component now receives the 501.'),
    item('DEF-0B7-EXP-EXPORT-ROUTES-ARE-REPORT-DEFINITION-CRUD-NO-FILE', 'exports, its item, csv, excel and pdf routes were report-definition CRUD that produced no file; all answer 501.'),
    item('DEF-0B8-FED-FEDERATION-SUBRESOURCE-PATHS-ARE-FEDERATION-ITEM-COPIES', 'Affiliates, dashboard, meetings and remittances under a federation were copies of the federation item route; all answer 501.'),
    item('DEF-0B8-FED-BENCHMARK-ROUTE-IS-GENERIC-GRIEVANCE-CRUD-NOT-A-BENCHMARK', 'federations/benchmark/grievances answered grievance rows as a benchmark; it answers 501.'),
    item('DEF-0B8-FED-LOCALS-PATHS-SERVE-BARGAINING-UNITS-NOT-LOCAL-UNIONS', 'locals and locals/[id] served bargaining units as local unions; both answer 501.'),
    item('DEF-0B8-FED-LOCALS-WRITES-ANY-STEWARD-ANY-FIELD', 'The locals routes no longer write bargaining-unit fields at the steward floor; they answer 501.'),
    item('DEF-0B8-JUR-CLC-AND-DEADLINE-PATHS-ARE-BARGAINING-UNIT-CRUD-NO-VALIDATION', 'jurisdiction/clc-compliance and validate-deadline served bargaining-unit rows with no validation; both answer 501. The deadline calculation paths the UI uses are separate routes and are unchanged.'),
    item('DEF-0B8-JUR-HEALTH-WELFARE-PLANS-PATH-IS-THE-PER-CAPITA-REMITTANCE-LEDGER', 'healthwelfare/plans answered the per-capita remittance ledger under a plan name at the member floor; it answers 501.'),
    item('DEF-0B9-ML-MOVEMENT-TRENDS-ROUTE-IS-NOT-THE-CONSENT-GATED-AGGREGATE', 'movement-insights/trends served stored analytics rows, not the consent-gated aggregate the dashboard uses; it answers 501.'),
    item('DEF-0B10-ORG-ORGANIZER-IMPACT-ROUTE-IS-ORGANIZER-TASK-CRUD-NOT-IMPACT-METRICS', 'organizer/impact served organizer task rows as impact metrics; it answers 501.'),
    item('DEF-0B10-PEN-PORTAL-DOCUMENT-PATHS-ARE-CMS-PAGE-CRUD-WITH-NO-PORTAL-PRINCIPAL', 'portal/documents served CMS pages with no portal principal; it answers 501.'),
    item('DEF-0B10-PEN-PORTAL-UPLOAD-ROUTE-RECEIVES-NO-FILE-AND-STORES-A-CALLER-WRITTEN-FILE-URL', 'portal/documents/upload received no file and stored a caller-written URL; it answers 501, so no URL is stored.'),
    item('DEF-0B11-IDS-STORAGE-USAGE-AND-CLEANUP-ROUTES-SERVE-MEDIA-LIBRARY-ROWS', 'storage/usage and storage/cleanup served media-library rows and computed or deleted nothing; both answer 501.'),
    item('DEF-0B11-RPT-RUN-AND-EXECUTE-ITEM-PATHS-ARE-REPORT-DEFINITION-CRUD', 'reports/[id]/run and reports/[id]/execute were the report item route, so their DELETE removed the report; both answer 501. Ad-hoc execution is POST /api/reports/execute.'),
    item('DEF-0B3-ARBITRATION-DECISION-SUBRESOURCES-FACADE', 'Search, citations and documents under arbitration precedents were the decision table or copies of its item route; all answer 501. The writerole test for those three routes was replaced by assertions of the 501 and of the absence of the table binding; the precedents collection and item keep their content_manager write role.'),
    item('DEF-0B11-IDS-SUPPORT-METRICS-POST-LETS-A-STEWARD-STORE-A-NOTIFICATION', 'support/metrics answers 501 (batch B09), so a steward can no longer store a notification for any user through it.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B15 added')

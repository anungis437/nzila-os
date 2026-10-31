const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B57-F05-INPUT-VALIDATION-AND-BOUNDS-SWEEP'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s5-input-bounds.test.ts'
  const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'F05 input validation and bounds: typed bodies, bounded pages and limited anonymous reads',
    evidenceCommit: null,
    items: [
      item('DEF-0B1-CLC-PUBLIC-CACHE-CONTROL', [A + 'app/api/admin/clc/analytics/trends/route.ts', A + 'app/api/admin/clc/analytics/multi-year-trends/route.ts', A + 'app/api/admin/clc/analytics/annual-report/route.ts', A + 'app/api/admin/clc/analytics/forecast/route.ts'],
        'Existing implementation, verified: the four administrator-only CLC analytics routes answer Cache-Control private, no-store; pinned by a test that also refuses any public value.'),
      item('DEF-0B5-COMMITTEE-LIST-PAGINATION-UNBOUNDED', [A + 'lib/api/list-page.ts', A + 'app/api/committees/[id]/meetings/route.ts', A + 'app/api/committees/[id]/intelligence/route.ts'],
        'The meeting list takes a bounded limit (1..200, default 50) and offset (0..1,000,000) and the intelligence list a bounded limit (1..100, default 20) through listPage; a non-numeric or negative value is the default and NaN never reaches the query.'),
      item('DEF-0B6-EDU-CONTENT-LISTS-UNBOUNDED-OR-UNVALIDATED', [A + 'lib/api/list-page.ts', A + 'app/api/content/training/route.ts', A + 'app/api/content/templates/route.ts'],
        'Both content lists take a bounded limit (1..200; training default 200, templates default 50) and offset through listPage, ordered with the id as a tie-break so a page is stable; a negative or non-numeric limit is the default instead of a SQL error.'),
      item('DEF-0B8-ICRA-READ-ROUTES-HAVE-NO-LIMITER', [A + 'app/api/icra/start/route.ts', A + 'app/api/icra/[assessmentId]/profile/route.ts', A + 'app/api/icra/report/[assessmentId]/route.ts', A + 'app/api/__tests__/icra-report-assessmentId.route.test.ts'],
        'The resume, profile and PDF report reads now pass through guardPublicIntake with the capability bucket before any lookup or render; a limited caller gets 429 (503 when the limiter is unavailable in production). The report route test mocks the guard and gained a test that a limited caller triggers no lookup and no render (disclosed).'),
      item('DEF-0B8-JUR-GEOFENCE-CREATE-BODY-IS-UNVALIDATED', [A + 'app/api/location/geofence/route.ts'],
        'The body is parsed as JSON (400 otherwise) and validated: a trimmed bounded name and description, a type from strike_line, union_hall and safety_zone, numeric coordinates in range, a positive radius of at most 10 km; strikeId is refused because no strike register exists to prove it belongs to the organization. The existing tenant, role and audit tests pass.'),
      item('DEF-0B9-ML-SLA-MODEL-VERSION-IS-CALLER-NAMED', [A + 'lib/ml/sla-breach-score.ts', A + 'app/api/ml/predictions/sla-breach-risk/route.ts', A + 'app/api/ml/predictions/sla-breach-risk/feedback/route.ts'],
        'The prediction accepts only the version the scorer implements (sla-risk-v1), so a steward can no longer create a model row for any typed string; the version stored on the prediction is the model\'s own, and feedback (S02) only scores an existing model and refuses a mismatched version.'),
      item('DEF-0B9-ORG-ITEM-PATCH-BODY-UNVALIDATED', [A + 'lib/organizations/profile-input.ts', A + 'app/api/organizations/[id]/route.ts'],
        'The update body is parsed (400 on malformed JSON) and validated by a strict schema: bounded name, lowercase slug format, e-mail, http(s) website, bounded sectors, a guid parent and a settings object of at most 200 keys and 16 KB; unknown keys are refused. A new slug must be free (409, also on the unique-index race) and settings are merged key by key instead of replacing the stored ones.'),
      item('DEF-0B2-AGREEMENTS-BODY-UNVALIDATED', [A + 'lib/agreements/agreement-input.ts', A + 'app/api/agreements/route.ts', A + 'app/api/__tests__/agreements.route.test.ts'],
        'Creation is validated: required typed and bounded fields, jurisdiction and language from the enums, expiry after the effective date, an https document address, numeric coverage; organization, publication and authorship stay server-owned; a duplicate agreement number is 409. The list parses page and limit so NaN never reaches the query. The route tests, which created agreements from a body holding only a title, now send a valid agreement and gained refusal cases (disclosed).'),
      {
        prefix: 'DEF-0B11-PRP-DUES-PAY-GET-RETURNS-EVERY-LEDGER-ENTRY',
        status: 'PARTIAL',
        files: [A + 'app/api/portal/dues/pay/route.ts', A + 'lib/api/list-page.ts', test],
        explanation: 'The payment history lists payments only (not charges, credits, adjustments or write-offs), omits the processor payment reference, and pages through a bounded limit and offset with a stable order; a non-numeric limit is the default.',
        remaining: 'Pending payment attempts created by POST are still not listed: they live in dues_transactions and need a joined, status-filtered read.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B57 added')

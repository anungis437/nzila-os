const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B68-REGISTERS-SINKS-AND-HONEST-ANSWERS'
const test = A + 'lib/services/__tests__/s12-registers-sinks-and-answers.test.ts'
if (!ledger.batches.some((x) => x.id === id)) {
  const item = (prefix, files, explanation) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation })
  ledger.batches.push({
    id,
    family: 'Read-only registers, observability sinks and answers that stated more than the source computes',
    evidenceCommit: null,
    items: [
      item('DEF-0B6-SYS-OBSERVABILITY-SWEEP-NO-DEDUPE-REPEATS-EVERY-RUN', [A + 'services/observability/realtime-alerting-service.ts'], 'Verified in source: an alert is keyed per organization, signal and clock hour, inserted with conflict-do-nothing, and an hour in which every recipient already holds it adds no execution, tracking row or audit entry.'),
      item('DEF-0B8-ICRA-EVENT-SINK-WRITES-A-TABLE-NO-SCHEMA-DEFINES', [A + 'lib/icra/observability.ts'], 'The sink no longer inserts into an icra_events table that nothing defines inside a try that swallowed every error; each event is a structured log record (kind, ids, hashed address, no personal identifier). Persisting events again needs its own reviewed table and retention.'),
      item('DEF-0B8-FED-FEDERATION-WRITES-REFUSED-NO-ROUTE-MAINTAINS-THE-REGISTER', [A + 'app/api/federations/route.ts', A + 'app/api/federations/[id]/route.ts'], 'The federation routes export only the read, matching the READ_ONLY governance class, so a write is a 405 instead of a configured steward write that always answered 403.'),
      item('DEF-0B8-FED-FLAGS-TYPE-VOCABULARY-ORGANIZATION-NOT-EVALUATED', [A + 'lib/services/feature-flags.ts'], 'The evaluator handles the documented organization flag type as well as the earlier tenant spelling, so an organization flag is no longer answered disabled as an unknown type.'),
      item('DEF-0B9-ML-SLA-FEEDBACK-PILOT-EVENT-IS-AN-AWAITED-POST-COMMIT-WRITE', [A + 'app/api/ml/predictions/sla-breach-risk/feedback/route.ts'], 'The pilot event after the committed feedback is caught and logged, so a telemetry failure no longer turns a recorded result into an error response.'),
      item('DEF-0B9-ORG-ORGANIZATION-ROW-FACADES-CONFIGURE-STEWARD-WRITES', [A + 'app/api/organizations/[id]/access-logs/route.ts', A + 'app/api/organizations/[id]/sharing-settings/route.ts'], 'Verified in source: both routes are explicit admin reads that answer 501 for their own organization and 403 otherwise, with no generic organizations write configured.'),
      item('DEF-0B10-PEN-RETIREMENT-ELIGIBILITY-IS-A-YEARS-OF-SERVICE-COMPARISON', [A + 'app/api/pension/retirement-eligibility/route.ts', A + 'app/api/__tests__/pension-retirement-eligibility.pglite.test.ts'], 'The threshold is required (the silent default of 25 is removed), the route is described as a years-of-service filter and the answer says it is not an eligibility determination. The PGlite test now passes the threshold and gained a required-threshold case (disclosed).'),
      item('DEF-0B10-OPL-11', [A + 'app/api/organizations/platform-id/route.ts'], 'The platform organization id is answered from the organizations table, and a deployment where that row was never provisioned is a 404 instead of a constant the table does not back.'),
      item('DEF-0B11-IDS-STEWARD-ROUTES-ARE-CONFIGURED-AT-THE-STEWARD-WRITE-FLOOR', [A + 'app/api/stewards/route.ts'], 'Verified in source: the steward routes expose only the directory read (a member-safe projection, the full audited rows for an officer) and no write is configured.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B68 added')

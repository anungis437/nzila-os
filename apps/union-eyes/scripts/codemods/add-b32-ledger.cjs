const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B32-F06-CONSENT-GATED-RECORDING-AND-VERIFIED-TELEMETRY-SCOPE'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B32 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f10-financial-shape.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F06: a precise position or interview text is recorded or sent onward only after the consent and configuration checks, and a telemetry read stays in the caller\'s organization',
  evidenceCommit: null,
  items: [
    item('DEF-0B8-JUR-GEOFENCE-GET-STORES-MEMBER-COORDINATES-WITHOUT-A-CONSENT-CHECK', [A + 'services/geofence-privacy-service.ts', A + 'app/api/location/geofence/route.ts', A + 'services/__tests__/geofence-privacy-service.test.ts', CONTRACT],
      'A geofence entry still answers inside or outside for the point the caller supplies, but a geofence_events row is stored only when the member holds a valid opt-in (the strike permission for a strike fence) and tracking is enabled; the response states whether anything was recorded. Existing test adapted: the opted-in case now queues the consent and configuration reads; three new tests cover no consent, tracking disabled and a missing strike permission.',
      { status: 'PARTIAL', remaining: 'The insert still uses the shared database handle without a transaction or an audit record, and the entry check runs from a GET.' }),
    item('DEF-0B7-EXC-PUBLISH-SENDS-EVERY-INTERVIEW-TO-AI-WITHOUT-CONSENT-GATE-OR-AUDIT', [A + 'app/api/exit-interviews/[id]/publish/route.ts', A + 'app/api/__tests__/exit-interviews-publish.route.test.ts'],
      'The publication decision gates expertise extraction by the interview\'s level and consent, the AI call is bracketed by requested, completed and failed audit records, and the result update is limited to the published row (existing implementation and tests).'),
    item('DEF-0B7-COGA-DERIVED-AGGREGATES-IGNORE-INTERVIEW-SENSITIVITY', [A + 'app/api/exit-interviews/expertise-map/route.ts', A + 'app/api/exit-interviews/governance-timeline/route.ts', A + 'app/api/__tests__/interview-derived-analytics.pglite.test.ts'],
      'The expertise map, topic graph, propagation map and timeline aggregate only published, consented interviews of the organization at the levels the caller may read, proven against a real SQL engine (existing implementation and tests).'),
    item('DEF-0B7-EXC-CONSENT-WITHDRAWAL-AND-RECLASSIFICATION-WITHDRAW-NOTHING-DERIVED', [A + 'app/api/exit-interviews/[id]/governance/route.ts', A + 'app/api/__tests__/exit-interviews-read-gates.pglite.test.ts'],
      'Reads of the interview and of its knowledge-base copy apply the interview\'s current consent and sensitivity, so a withdrawal or reclassification takes effect on the next read (existing read-gate tests).',
      { status: 'PARTIAL', remaining: 'The knowledge-base row, its content and its embedding are not erased or deactivated when consent is withdrawn; they are only filtered at read time.' }),
    item('DEF-0B10-OPL-12', [A + 'app/api/platform/metrics/mrr/route.ts', A + 'app/api/platform/metrics/churn/route.ts', A + 'app/api/platform/metrics/unit-economics/route.ts', A + 'app/api/__tests__/platform-financial-metrics-unavailable.route.test.ts'],
      'The three platform financial metrics answer 501 with a NOT_IMPLEMENTED capability state and no figures (existing implementation and test).'),
    item('DEF-0B10-PIL-USAGE-TELEMETRY-ROUTES-READ-ANY-ORGANIZATION-NAMED-IN-THE-QUERY', [A + 'lib/pilot/telemetry-scope.ts', A + 'lib/pilot/__tests__/telemetry-scope.test.ts', A + 'app/api/pilot/champions/route.ts', A + 'app/api/pilot/friction/route.ts', A + 'app/api/pilot/metrics/route.ts', A + 'app/api/pilot/readiness/route.ts'],
      'A pilot telemetry read uses the caller\'s authenticated organization; a request naming another organization is refused 403 identically whether or not it exists. The resolver had no test; it now has one, and each route is pinned to use it.',
      { status: 'PARTIAL', remaining: 'The telemetry services still run raw SQL over pilot_events through the shared database handle, filtered by the organization id only, and return per-user identifiers.' }),
    item('DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE-TO-EVERY-ACTIVE-ACCOUNT', [A + 'app/api/social-media/posts/route.ts', CONTRACT],
      'Publishing now needs the officer floor instead of the steward floor; the publish is already rate limited and bracketed by intent and outcome audit records.',
      { status: 'PARTIAL', remaining: 'There is still no draft, review or approval state, no content classification check, and the caller cannot choose which connected account of a platform receives the post.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B32 added')

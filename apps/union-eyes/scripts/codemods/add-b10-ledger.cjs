// Appends batch B10 to the elimination ledger (idempotent).
const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B10-F02-ML-AND-COGNITION-HONESTY'
if (ledger.batches.some((b) => b.id === ID)) {
  console.log('B10 already present')
  process.exit(0)
}
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
const bridge = [A + 'lib/organizational-operating-intelligence/kernel-bridge.ts', A + 'scripts/codemods/f02-dynamics-engines-501.cjs']
const ml = [A + 'scripts/codemods/f02-domain-facades-501.cjs', A + 'lib/api/__tests__/roster-facades.contract.test.ts']

ledger.batches.push({
  id: ID,
  family: 'F02: model and cognition output must come from the organization\'s records or be refused (501 / 400 / 502), never a constant or a reassuring default',
  evidenceCommit: null,
  items: [
    item('DEF-0B7-COGA-CROSS-DOMAIN-CORRELATIONS-ARE-FIXED-LITERALS', [A + 'lib/organizational-operating-intelligence/__tests__/constant-engines-not-implemented.test.ts'],
      'The correlation engine already refuses with NOT_IMPLEMENTED for every organization; the source change was upstream\'s and is covered by an existing test.'),
    item('DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS', bridge,
      'The systems-dynamics, governance-coherence, operational-coordination, operating-rhythm, multi-domain and operational-trust engines embedded fixed frequencies, response times, integration scores and narrative claims (for example "Consistent governance behavior") and presented them as measurements. They now fail with 501 through the same refusal as the correlation engine.',
      { status: 'PARTIAL', remaining: 'The response-elasticity and governance-momentum engines remain: they derive scores from counts of cognition-memory entries with arbitrary scaling. They hold no fixed claim, but the scaling is not a validated measure.' }),
    item('DEF-0B7-COGA-ENVELOPE-CONFIDENCE-IS-A-CONSTANT-AND-EXPLAINABILITY-IS-EMPTY', bridge,
      'The default confidence of 60 is gone: an engine states a confidence only when it supplies one (otherwise 0), and the two remaining engines state evidence volume (cognition-memory entries analysed, capped at 100).',
      { status: 'PARTIAL', remaining: 'The explainability envelope\'s evidence and reasoning lists are still not populated by these engines.' }),
    item('DEF-0B7-EXC-SIMULATION-UNMATCHED-NODES-RETURN-REASSURING-RESULT-AND-ROLES-ARE-IGNORED',
      [A + 'lib/knowledge-transfer/simulation/continuity-simulator.ts', A + 'lib/knowledge-transfer/simulation/__tests__/continuity-simulator.test.ts'],
      'A scenario that matches no node or role is refused with 400 instead of a canned low-severity result (impact 20, probability 85). Affected roles now select the nodes associated with them. The test that asserted the canned minimal result was replaced by tests for the refusal and for role selection.'),
    item('DEF-0B7-EXC-SCENARIOS-ALWAYS-RETURN-THE-CANNED-MINIMAL-SIMULATION',
      [A + 'lib/knowledge-transfer/simulation/continuity-simulator.ts', A + 'lib/knowledge-transfer/simulation/__tests__/continuity-simulator.test.ts'],
      'The preset scenarios name roles and no nodes, so every one of them reached the canned minimal result. Roles are now honoured, and a preset that matches nothing in the organization is refused rather than modelled.'),
    item('DEF-0B7-EXC-SUMMARIZE-STORES-UNVALIDATED-OR-PLACEHOLDER-OUTPUT-AS-GENERATED',
      [A + 'lib/knowledge-transfer/summaries/knowledge-summarizer.ts', A + 'lib/knowledge-transfer/summaries/__tests__/knowledge-summarizer.test.ts'],
      'Model output is validated (non-empty summary, at most five handoff points); anything else is a 502 and nothing is stored. The former fallback text ("Manual review of source content is recommended") that was stored as a generated summary is gone, and its test was replaced.'),
    item('DEF-0B7-EXC-SUMMARIZE-SENDS-ANY-CONSENT-STATE-TO-MODEL-AS-INTERNAL',
      [A + 'lib/knowledge-transfer/summaries/knowledge-summarizer.ts', A + 'lib/knowledge-transfer/summaries/__tests__/knowledge-summarizer.test.ts'],
      'Nothing is sent to the provider unless the retiring employee consented (409 otherwise); interviews above the restricted level go as confidential rather than internal.'),
    item('DEF-0B7-COGA-CONTINUITY-RISK-SENDS-INTERVIEW-DATA-TO-MODEL-UNGUARDED', [A + 'lib/knowledge-transfer/continuity-risk/risk-detector.ts', A + 'app/api/__tests__/interview-derived-analytics.pglite.test.ts'],
      'The detector already reads only interviews selected by derivedAnalyticsCondition (published, consented, open levels), proved against real SQL by an existing test; that change was upstream\'s.'),
    item('DEF-0B9-ML-CHURN-SCORES-COME-FROM-A-RANDOMLY-INITIALISED-NETWORK', [A + 'app/api/ml/predictions/churn-risk/route.ts', A + 'app/api/__tests__/ml-churn-risk.route.test.ts'],
      'The churn route scored members with a randomly initialised network pre-trained on generated examples and stored the score. GET and POST now answer 501 behind the officer floor. The extensive route test, which exercised that scoring with mocks, was replaced by a test of the 501 and of the absence of the generated-example model.'),
    item('DEF-0B9-ML-PREDICTION-ROUTES-ARE-ONE-GENERIC-ROW-LIST-UNDER-SIX-MODEL-NAMES', ml,
      'ml/monitoring/drift, monitoring/usage, predictions/claim-outcome, predictions/timeline, predictions/workload-forecast and ml/recommendations were the generic factory over ml_predictions under six model names; all answer 501 and ml_predictions has no generic binding (its governance entry was removed). The monitoring alerts route (GET queried columns and a table that no schema defines and stated a fixed PSI 0.28 drift alert; POST wrote to a table no migration creates) also answers 501; its three POST tests were replaced by one assertion of the 501.'),
    item('DEF-0B9-ML-OPERATIONAL-METRICS-ARE-PROXIES-NAMED-AS-REQUEST-AND-ERROR-RATES', [A + 'app/api/metrics/operational/route.ts', A + 'app/api/__tests__/metrics-operational.route.test.ts'],
      'The route already reports error_rate as null and no longer names a claim count as a request count; the source change was upstream\'s and is covered by an existing test.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B10 added')

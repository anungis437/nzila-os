const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B47-F12-COGNITION-RESULTS-STATE-WHAT-THEY-REST-ON'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/knowledge-transfer/__tests__/b47-honest-analytics.test.ts'
  const KT = A + 'lib/knowledge-transfer/'
  ledger.batches.push({
    id,
    family: 'F12: cognition and knowledge-transfer results do not present absence, defaults or literals as measurement',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B7-COGA-ROADMAP-DOCUMENTATION-STRATEGY-PRECEDENCE-BUG',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [KT + 'resilience-strategies/strategy-modeler.ts', test],
        explanation: 'The documentation strategy is selected when the documentation score is low (under 65) or unmeasured (missing or not finite), and not for any high score. The expression that parsed as score ?? (0 < 65) is gone. Source-contract test added.',
      },
      {
        prefix: 'DEF-0B7-COGB-ROADMAP-DOCUMENTATION-RULE-PRECEDENCE-AND-CONST',
        status: 'PARTIAL',
        files: [KT + 'resilience-strategies/strategy-modeler.ts', test],
        explanation: 'The precedence defect in the documentation rule is corrected (same fix as the companion defect).',
        remaining: 'The projected resilience, governance and dependency gains of each strategy are still literal numbers from a per-strategy table.',
      },
      {
        prefix: 'DEF-0B7-COGB-PERSONALITY-LABEL-ASSIGNED-FROM-ABSENCE-OF-DATA',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [KT + 'maturity-personalities/personality-profiler.ts', KT + 'maturity-personalities/personality-models.ts', KT + 'maturity-personalities/__tests__/personality-profiler.test.ts', test],
        explanation: 'With fewer than two entries and sessions the profiler now returns a new insufficient_data type with no characteristics and an identity statement that says so, instead of Resilience-Fragile. The existing no-history test pinned the old label and was changed to assert the new behaviour (disclosed).',
      },
      {
        prefix: 'DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED',
        status: 'PARTIAL',
        files: [KT + 'governance/interview-read-limit.ts', KT + 'topic-graph/topic-graph-builder.ts', KT + 'propagation/dependency-propagator.ts', KT + 'resilience-index/resilience-calculator.ts', KT + 'succession/succession-analyzer.ts', KT + 'continuity-risk/risk-detector.ts', KT + 'simulation/continuity-simulator.ts', test],
        explanation: 'Every derived analysis that read all published exit interviews now reads at most 500, newest as the database returns them, through one shared constant, so the work and the model prompt no longer grow without bound. Six test mocks gained a limit step on the query chain (disclosed; behaviour unchanged).',
        remaining: 'The 500 are not ordered by recency, and the topic graph still builds a pair edge for every two tags of each interview.',
      },
      {
        prefix: 'DEF-0B7-COGB-NARRATIVES-CITE-ZERO-EVIDENCE-AS-DERIVED-FROM-E',
        status: 'PARTIAL',
        files: [A + 'lib/organizational-narratives/index.ts', test],
        explanation: 'A narrative whose envelope carries no evidence now says that no institutional evidence is attached and that the result is guidance, not a finding, instead of "Derived from 0 institutional evidence items".',
        remaining: 'The headline is still the first sentence of fixed interpretation guidance and the engines still emit no evidence, reasoning or implications.',
      },
      {
        prefix: 'DEF-0B7-COGA-EMPTY-ORGANIZATION-RESILIENCE-IS-NAN',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [KT + 'resilience-index/resilience-calculator.ts', KT + 'resilience-index/__tests__/resilience-calculator.test.ts'],
        explanation: 'Existing implementation, verified: the resilience index refuses an organization with no dependency data with a conflict instead of computing NaN scores, so no strong status or brief is derived from it; an existing test covers both the empty and the interviews-without-nodes cases.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B47 added')

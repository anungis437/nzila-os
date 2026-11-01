const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B46-F12-ICRA-CONSENT-AND-REQUIRED-COVERAGE'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/icra/__tests__/b46-consent.test.ts'
  ledger.batches.push({
    id,
    family: 'F12: an ICRA assessment exists only with server-stamped consent and is scored only from the required answers',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B8-ICRA-ONE-SHOT-SUBMIT-STORES-CLIENT-SUPPLIED-CONSENT',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/icra/consent.ts', A + 'app/api/icra/submit/route.ts', A + 'app/api/__tests__/icra-submit.route.test.ts', test],
        explanation: 'The one-shot submit builds the stored consent on the server from the three acknowledgements (time and doctrine version stamped here; client time, version and extra keys dropped), accepts only the en-CA and fr-CA locales, reads the body as text under a 64 KB cap (413 beyond), and refuses organization-context keys that are not short lower-case identifiers or exceed 40. Unit and source-contract tests added; existing route tests still pass.',
      },
      {
        prefix: 'DEF-0B8-ICRA-STEPWISE-FLOW-NEVER-REQUIRES-CONSENT',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/icra/consent.ts', A + 'app/api/icra/start/route.ts', A + 'app/api/icra/[assessmentId]/answer/route.ts', A + 'app/api/icra/[assessmentId]/submit/route.ts', A + 'app/api/__tests__/icra-start.route.test.ts', A + 'app/api/__tests__/icra-assessmentId-answer.route.test.ts', A + 'app/api/__tests__/icra-assessmentId-submit.route.test.ts', test],
        explanation: 'The stepwise flow requires all three acknowledgements to start (400 otherwise, consent stamped by the server), the answer route refuses to store anything for an assessment with no recorded consent (409), and so does the stepwise submit. No application caller of these routes existed. Existing tests were adapted: assessment fixtures now carry a recorded consent, the start 500 test sends consent, and the submit tests mock the coverage helper (disclosed); new tests cover the refusals.',
      },
      {
        prefix: 'DEF-0B8-ICRA-STEPWISE-SUBMIT-SCORES-ANY-NON-EMPTY-ANSWER-SET',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/icra/stepwise-coverage.ts', A + 'app/api/icra/[assessmentId]/submit/route.ts', A + 'app/api/__tests__/icra-assessmentId-submit.route.test.ts', test],
        explanation: 'The stepwise submit scores nothing unless every question the routing engine requires for an unclassified organization has an answer (400 with the missing count otherwise), using the same routed-submission validator as the live flow. Proven against the real question bank: one answer is refused, a full set is accepted.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B46 added')

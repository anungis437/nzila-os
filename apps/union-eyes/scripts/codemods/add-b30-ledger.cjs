const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B30-F09-F10-LIMITS-REPLAY-REMITTANCE-AND-CANCEL-CONTRACT'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B30 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const CONTRACT = A + 'lib/api/__tests__/f10-financial-shape.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F09/F10: a financial write is rate limited and repeatable without piling up records, an endpoint validates the request it actually performs, and an exported package states only what the data supports',
  evidenceCommit: null,
  items: [
    item('DEF-0B5-COMMS-TEMPLATE-DUPLICATE-IS-GENERIC-CRUD', [A + 'app/api/communications/templates/[id]/duplicate/route.ts', A + 'scripts/codemods/f02-domain-facades-501.cjs', A + 'lib/api/__tests__/roster-facades.contract.test.ts'],
      'The duplicate path was the generic CRUD item over message templates (its DELETE removed the template and nothing was duplicated); it answers 501 and the roster-facade ratchet pins it.'),
    item('DEF-0B10-PEN-PENSION-ROUTES-APPLY-NO-RATE-LIMIT', [A + 'app/api/pension/plans/route.ts', A + 'app/api/pension/members/route.ts', A + 'app/api/pension/plans/[id]/route.ts', A + 'app/api/__tests__/pension-plan-terminate.route.test.ts', CONTRACT],
      'Every pension write (create plan, enrol member, update plan, terminate plan) carries the financial-write rate limit; the contract test checks each write configuration.'),
    item('DEF-0B11-PRP-REDEMPTIONS-POST-IS-NAMED-FOR-INITIATION', [A + 'app/api/rewards/redemptions/route.ts', A + 'app/api/__tests__/social-posts-and-redemptions-audit.route.test.ts', CONTRACT],
      'The cancel path now validates a cancellation (redemption id and a bounded reason, strict) and uses that validated id; an initiation body is rejected with 400 instead of being parsed and discarded, and the reason is stored with the cancellation. Test updated: the previous cancel test posted an initiation body and a query id, which is the defect.'),
    item('DEF-0B6-EMP-REPLAY-NOT-IDEMPOTENT-GATES-APPROVAL', [A + 'app/api/employer-execution/replay/[runId]/route.ts', A + 'app/api/__tests__/employer-replay-run-id.route.test.ts', A + 'scripts/codemods/f09-replay-idempotent.cjs'],
      'A replay identical in run, mode, rule version, engine version and result is answered with the replay already made, adding no replay row, artifacts, evidence link, compliance event or audit duplicate; a different requested mode is a new replay. Tests added for both.',
      { status: 'PARTIAL', remaining: 'A genuinely different replay still opens an error-severity event that must be acknowledged before approval; whether a replay should gate approval is a payroll-governance decision, and replays are still allowed at any run status.' }),
    item('DEF-0B6-EMP-REPLAY-MODE-MISRECORDED', [A + 'app/api/employer-execution/replay/[runId]/route.ts', A + 'app/api/__tests__/employer-replay-run-id.route.test.ts'],
      'The requested mode and replay rule version are stored with the diff, so an engine-change replay can be told from a faithful re-run.',
      { status: 'PARTIAL', remaining: 'The mode enum column still holds only exact and simulated; adding new_engine needs a PostgreSQL enum migration that has not been run on a native database.' }),
    item('DEF-0B6-EMP-REMITTANCE-PACKAGE-SHAPE', [A + 'lib/employer-execution/csv-cell.ts', A + 'lib/employer-execution/__tests__/csv-cell.test.ts', A + 'app/api/employer-execution/remittance-runs/route.ts', CONTRACT],
      'The uploaded external employee id is neutralised against a leading formula character and quoted in the remittance CSV, and each remittance group reports the number of members who contribute to it rather than the payroll item count.',
      { status: 'PARTIAL', remaining: 'The per-group member count is pinned by source only; no behavioural test drives the remittance route with a zero-amount group.' }),
    item('DEF-0B3-BILLING-VALIDATE-LOG-ONLY-MISLABELLED', [A + 'app/api/billing/validate/route.ts', A + 'app/api/__tests__/billing-validate.route.test.ts'],
      'Validation failures are classified as validation (not unauthorized access), every evaluated result has a tenant-bound atomic audit receipt, and the route fails closed with 503 when the audit cannot commit (existing implementation, existing tests).'),
    item('DEF-0B3-EXTERNAL-INVOICES-WRITE-ADVERTISED', [A + 'app/api/billing/invoices/route.ts', CONTRACT],
      'The invoice create path answers 501 stating that invoices are ingested from the provider; the contract test pins that it never inserts.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B30 added')

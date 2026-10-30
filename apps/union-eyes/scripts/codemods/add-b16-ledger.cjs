const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B16-F09-F10-DUES-RECONCILIATION-ICRA'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B16 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F09/F10: payment initiation is idempotent, exports are formula-safe, and routes named for an intake or feed that does not exist answer 501',
  evidenceCommit: null,
  items: [
    item('DEF-0B11-PRP-DUES-PAY-POST-CREATES-A-NEW-FULL-BALANCE-PAYMENT', [A + 'lib/dues/dues-payment-service.ts', A + 'lib/dues/__tests__/dues-initiation-single-open.pglite.test.ts', A + 'app/api/dues/create-payment-intent/route.ts'],
      'Initiation is server-owned (no client amount, organization or member) and returns the same open payment for a repeated or concurrent call, cancelling and reopening only when the balance changed; upstream\'s change, covered by an existing real-SQL test.'),
    item('DEF-0B11-PRP-DUES-BALANCE-TAKES-THE-ORGANIZATION-FROM-THE-CLIENT', [A + 'app/api/dues/balance/route.ts', A + 'app/api/__tests__/dues-balance.route.test.ts'],
      'The balance reads the authenticated member and organization from the session only and never fabricates a balance when there is no ledger activity; upstream\'s change, covered by an existing test.'),
    item('DEF-0B11-PRP-DUES-BALANCE-CREDIT-STATUS-IS-UNREACHABLE', [A + 'app/api/dues/balance/route.ts', A + 'app/api/__tests__/dues-balance.route.test.ts'],
      'A credit balance is reported when posted payments exceed posted charges; upstream\'s change, covered by an existing test.'),
    item('DEF-0B11-PRP-REWARDS-EXPORT-CSV-DOES-NOT-NEUTRALISE-SPREADSHEET-FORMULAS', [A + 'app/api/rewards/export/route.ts', A + 'app/api/__tests__/rewards-export.route.test.ts'],
      'The export neutralises formula cells, is bounded, role-checked and audited in the reading transaction; upstream\'s change, covered by an existing test.'),
    item('DEF-0B11-PRP-RECONCILIATION-BANK-AND-UPLOAD-PATHS-ARE-NAMED-FOR-BANK-FEEDS', [A + 'scripts/codemods/f02-domain-facades-501.cjs', A + 'app/api/__tests__/reconciliation-upload.route.test.ts', A + 'lib/api/__tests__/roster-facades.contract.test.ts'],
      'reconciliation/bank and reconciliation/upload listed runs and exceptions under names promising a bank feed and a file intake; both answer 501 behind the officer floor. The upload route test, which asserted the exception list, was replaced by an assertion of the 501.'),
    item('DEF-0B8-ICRA-CHECKOUT-REDIRECT-DEFAULTS-TO-LOCALHOST-AND-PRICE-MAY-DIFFER-FROM-DISPLAYED', [A + 'app/api/icra/checkout/route.ts', A + 'app/api/__tests__/icra-checkout.route.test.ts'],
      'In production a missing NEXT_PUBLIC_APP_URL is a 503 with no Stripe session instead of a redirect to localhost.',
      { status: 'PARTIAL', remaining: 'The charged amount comes from a Stripe price id or a built-in default and is not compared with the price the page displays.' }),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B16 added')

const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B120-F06-SCANNER-CALL-AWARE',
  family: 'F06 closeout: the route scan names a route two-phase only for what it invokes',
  test: A + 'lib/__tests__/route-scan-classification.test.ts',
  previousEvidence: { 'B119-F06-FINAL-SAFETY-HARDENING': '86aa8adb2' },
  items: [
    {
      prefix: 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME',
      status: 'PARTIAL',
      files: [
        A + 'scripts/lib/call-reach.ts',
        A + 'scripts/lib/route-coverage-scan.ts',
        A + 'lib/__tests__/intent-outcome-routes-reviewed.test.ts',
        'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json',
      ],
      explanation: 'The route scan labelled a route two-phase (INTENT_OUTCOME) when any module it could reach contained a performAuditedOperation call, so a route that only creates a chat session was labelled like one that calls an AI provider. The scan is now syntax-aware: each named scope (function, const initializer, class method or property) of the reachable modules is recorded with the names it calls, a scope that calls the operation directly is marked, a scope that calls a marked scope is marked, and a route is two-phase only if it mentions the name of a marked scope (or calls the operation itself). Matching is by name so a shared common name can only widen the result, and a call that sits outside any named scope falls back to the old file-level answer rather than being guessed. Comments are no longer read as calls. The corrected manifest labels five routes ATOMIC_SERVICE that were two-phase only through an unrelated function of an imported module: chatbot sessions, copilot session outcome, integration configure, integration activate (the four the review named) and the PayPal payment webhook (a fifth, found by the same scan: it applies the payment and its audit row in one transaction through handlePaymentSuccess and handlePaymentFailure, and never invokes the Stripe checkout that is two-phase in the same service). The 31 routes that stay two-phase are pinned in the reviewed-routes ratchet with a reason each, the five are pinned as ATOMIC_SERVICE with source proof that their effect is one transaction with its audit row, and the scan is proven on a synthetic tree (atomic and two-phase scopes in one module, a helper, class methods, a handed-on reference, a module-level call, an unused import, a comment). The classification scan only ever narrowed: no route became newly two-phase, and no other route changed. The frozen finding was not altered.',
      remaining: 'Billing-cycle generation is finance-frozen and was not changed. Operations whose effect is outside our database remain durable two-phase records by nature (31 routes: job queue, e-mail, blob storage, AI and payment providers, Redis, bulk ingest with partial progress, in-process PKI). The PKI sign, verify and cancel operations act on an in-process store, which is a separate capability defect. The bootstrap-v2 source plan (docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json) carries stale source commitments for the pilot overview, database optimize, commercial-transition, report execution, contracts and workbook memory-holder routes; it can only be regenerated with the Python wheelhouse (UE_V2_WHEELHOUSE) and was deliberately not regenerated with an unqualified toolchain, so regenerating and admitting it is a qualification dependency.',
    },
  ],
})

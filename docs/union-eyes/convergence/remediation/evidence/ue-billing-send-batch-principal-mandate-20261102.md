# UE billing batch — principal financial authority and truthful invoice generation

Date: 2026-11-02. Scope: DEF-0B3-BILLING-SEND-BATCH-CROSS-TENANT-MUTATION (supplementary evidence only). Branch: `agents/ue-cursor-final-closure`.

## Source-level correction

`apps/union-eyes/app/api/billing/send-batch/route.ts` no longer relies on a role title and a subscription entitlement as authorization to issue invoices. It requires an authenticated user and organization, and calls `requireLiveFinancialMandate` for `finance:execute` with `requiresLedger: true` inside a tenant-bound `withRLSContext` transaction **before any billing record is read**. Billing-period and active-subscription reads use that tenant transaction with explicit organization predicates. Closed or foreign billing periods, foreign subscription rows and ambiguous multiple active subscriptions are refused before invoice generation. The route accepts only the billing-period GUID, and only one subscription can produce one invoice. The invoice service's atomic invoice/line/ledger/audit transaction remains responsible for the mutation; service failure propagates rather than being counted as success.

## Regression tests authored

`apps/union-eyes/app/api/__tests__/billing-send-batch.route.test.ts` covers valid single-subscription issuance, authenticated context, missing mandate before any read, foreign billing period, closed period, cross-tenant subscription result, multiple active subscriptions, truly empty subscription set, invoice/audit failure and route-level auth/entitlement configuration. Tests use mocked transactions and do not constitute native or browser proof.

## Qualification and residual risk

Source changes and test authorship are **not** evidence that all 777 defects or this defect are independently CLOSED. The invoice service still performs some global-handle preflight reads outside the route's tenant transaction and the read-to-write window is not atomic. Exactly-once invoice issuance under concurrent requests is not established by this change; existing pre-insert duplicate checks are insufficient without a database uniqueness/locking proof. Multiple active subscriptions are intentionally refused until a governed, multi-subscription billing model exists. Exact-HEAD Vitest/contract, native PostgreSQL 15/16 with runtime role/RLS, HTTP/browser/staging, audit rollback, concurrency and mandate revocation tests remain necessary. No financial mandates are issued by this patch. Gate 0C.4 institutional authority, owner-persona ratification and independent reviewer acceptance remain outstanding. No CLOSED or release-GO credit is claimed.

Frozen Gate 0 classification and the 150-item release-debt index must not be modified.

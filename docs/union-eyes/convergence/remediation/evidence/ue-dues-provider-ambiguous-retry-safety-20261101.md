# UE member-dues payment: ambiguous provider intent and balance-drift safety

- Defect lineage: `DEF-0B11-PRP-DUES-PAY-POST-CREATES-A-NEW-FULL-BALANCE-PAYMENT-AND-INTENT-ON-EVERY-CALL-AND-SETTLEMENT-DOES-NOT-RECHECK-THE-BALANCE` (one of the frozen 777 Gate 0 defects; 150-item priority index).
- Prior branch HEAD: `bfd69e2f4d00caa66a9f315d2eae409f9771e48f`.
- Source commits: `78a7b3c18afa710ebb8be79f958f8238e6e03187`, `03f4aab0087bdde566410cccd989e1366dc4d6f6`.
- Regression commits: `b3711d6afa006e6a2dd550ea6b26dacb300ef51a`, `a2a353811196742f5df31a3cb30d2455cd8227c8`, `d5186d768907a180b88b9c5701a8accbc8a4c149`.
- Status: SOURCE_CHANGED_TESTS_AUTHORED_NOT_INDEPENDENTLY_QUALIFIED. No new defect-completion or CLOSED credit.

## Root cause and permanent source correction

The earlier single-open-payment implementation cancelled an internal pending payment inside a database transaction before attempting to cancel its external Stripe intent. If the external cancellation failed, the original intent could remain chargeable while its internal payment was cancelled; a new full-balance intent could then be issued. The external cancellation error was swallowed. A timeout during intent creation was also treated as proof that no provider intent existed, cancelling the internal row even though Stripe might have created a chargeable intent.

The service now refuses to supersede any pending payment when the outstanding balance changes or when multiple pending payments exist. It does not cancel a chargeable provider intent on this path. A linked intent is retrieved and checked against its immutable internal payment id, organization, member, amount, currency and actionable status rather than re-created after the provider's idempotency retention may have expired. An unlinked pending payment reuses its original idempotency key only inside a conservative 12-hour retry window; older unconfirmed requests fail closed for reconciliation. Ambiguous provider failures preserve the internal pending reference. The link UPDATE now requires an unchanged pending row and returns proof of the update before recording link success. The HTTP route maps reconciliation refusal to 409 Conflict, not a false successful payment initiation.

## Regression tests authored

- `lib/dues/__tests__/dues-payment-service.test.ts`: provider retrieval/identity, changed balance, multiple pending rows, stale unlinked retry, safe same-key retry, ambiguous provider failure, and guarded link race.
- `lib/dues/__tests__/dues-initiation-single-open.pglite.test.ts`: real-SQL repeated initiation and provider retrieval, changed balance without cancellation, ambiguous provider failure with preserved pending row, stale unlinked retry and concurrent initiation.
- The existing native PostgreSQL tenant-isolation and settlement tests remain part of the full qualification programme; these new source changes are not independently native-qualified by authoring the tests.

## Outstanding acceptance obligations

Exact-HEAD unit/Vitest, complete contract and security regression, native PostgreSQL 15/16 with actual RLS and concurrent Stripe-webhook ordering, signed webhook over HTTP, browser/staging acceptance, provider cancellation/reconciliation operations, refunds and disputes, and independent release qualification remain outstanding until evidenced. The 12-hour retry limit is an engineering fail-closed policy, not an institutionally ratified settlement mandate. Existing historical NATIVE_VERIFIED evidence for the earlier implementation must not be mistaken for qualification of this changed source. Gate 0C.4 independent reviewer, owner-persona ratification and institutional authority decisions remain outstanding. No PR merge or production promotion is authorized.

## Native PG15/16 regression correction (follow-up)

At HEAD `7854cad7b3b383096f856eb735f2d55a67c9ff05`, both PostgreSQL 15 and 16 native workflows failed one of 459 tests: the existing ten-concurrent-initiation fixture lacked a provider `retrieve` implementation. The failure was `DuesInitiationError: The existing payment intent cannot be verified for reuse`; the other 457 native tests passed, with one skipped. This is an explicit fail-closed response, not evidence of successful provider reuse.

Commit `7e68b4a082bf258b2a49ddc4d82519ec63f3cbd9` updates the native test to use a shared, independent in-memory provider-intent store with both `create` and `retrieve`, preserving the actual PostgreSQL transaction and RLS execution. The fixture does not invent provider responses from database rows. A new native regression checks that balance drift refuses a second intent and leaves the original pending payment and provider reference unchanged. These tests require exact-new-HEAD PG15/16 execution; they are not credited as passed by their existence.

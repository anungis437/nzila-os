# Union Eyes Gate 0 — dues native ledger fixture and lifecycle ratchet correction

## Scope and authority
Source baseline: `2af5b4cbdbd6ca4c401cb3d7a1cc3a474e03994e` on `agents/ue-cursor-final-closure`.
This is engineering evidence, not independent acceptance, an institutional decision, or a defect closure. The frozen 777-defect register and release-debt index remain unchanged.

## Failure observed on the baseline
- Native PostgreSQL acceptance workflow `41372993965`: both PostgreSQL 15 and 16 failed one of 460 tests (458 passed, one skipped). In `tenant-isolation-remediation.postgres.test.ts`, the new dues-balance-drift regression attempted to insert a charge without the required `member_dues_ledger.balance_before` and `balance_after` fields; PostgreSQL rejected the fixture with a NOT NULL constraint violation. The safety behavior being asserted was therefore not reached.
- Full application regression workflow `41372994118`: one failing source-level ratchet in `s50-f06-a3-durable-operation-lifecycles.test.ts`. It expected the old `dues.payment_cancelled` and supersession path. That path was intentionally removed by the provider-ambiguity safety correction; cancelling the internal row before provider confirmation could orphan a chargeable external intent. Whole contract suite passed separately.

## Source corrections
1. The native dues-drift fixture now writes all required ledger accounting fields, with the additional charge moving the balance from 25 to 30, and an explicit description. No production constraint or financial control is weakened.
2. The durable-operation ratchet now requires the initiated and provider-linked audit events, explicit reconciliation refusal on balance drift and stale unlinked attempts, verified provider intent retrieval, guarded pending-row update, and atomic audit call. It expressly disallows the old cancellation and balance-supersession paths. It does not claim the provider was cancelled.
3. The native PostgreSQL drift scenario now independently counts simulated provider intents and records every cancellation attempt. It asserts that the balance-change refusal neither creates another provider intent nor attempts to cancel the original; the simulated provider state is separate from the database.

## Qualification boundaries
The changes repair test validity and strengthen the source ratchet; they do not independently qualify payment safety. Exact-new-HEAD whole Vitest/contract, native PG15/16, security, HTTP/browser and staging evidence must be inspected. Provider disputes, refunds, ambiguous-create reconciliation, exactly-once settlement and institutional mandates remain separately gated. No new defect receives IMPLEMENTED, CLOSED, native or E2E credit from this evidence alone. Independent reviewer, owner-persona and institutional authority ratifications remain outstanding.

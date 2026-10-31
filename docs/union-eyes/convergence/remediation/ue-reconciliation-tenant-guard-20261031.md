# Union Eyes Gate 0 — reconciliation tenant guard (2026-10-31)

Disposition: **SOURCE_PATCHED / QUALIFICATION_PENDING / NO_GO**.

Frozen defect: `DEF-0B11-PRP-RECONCILIATION-RUNS-ARE-NOT-REPEATABLE-AND-THE-BILLING-PERIOD-IS-NOT-BOUND-TO-THE-ORGANIZATION`. Its existing period lock, ownership predicate and duplicate-run refusal remain in place.

- `3f115f2bbc6f77743b1c4c87dc23d11b0851ef26`: `runReconciliation` refuses a missing, empty or whitespace organization before opening a transaction. The old optional-organization execution path could reconcile invoices, payments and fees from multiple organizations into one run.
- `f96b0e42e0f6a7d0accbefc0cc46f44dfc50006c`: regression tests cover all three unscoped cases and update the previously cross-organization empty-payment fixture to operate under an explicit organization.

These are committed source and test changes, **not proof of executable acceptance**. The defect remains PARTIAL until focused and full tests, native PostgreSQL 15/16/RLS, HTTP/browser, staging and independent governance acceptance are recorded against the exact SHA. No frozen classification, CLOSED state, human ratification or production authorization was changed.

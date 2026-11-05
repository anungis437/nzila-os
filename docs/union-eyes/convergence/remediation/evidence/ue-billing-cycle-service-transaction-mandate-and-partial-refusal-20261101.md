# Union Eyes — billing-cycle transaction mandate and partial-charge refusal (2026-11-01)

## Scope and provenance

Branch: `agents/ue-cursor-final-closure`. This is **additive engineering evidence**, not a frozen Gate 0 qualification change, independent reviewer decision or defect closure. Primary traceability: `DEF-0B1-BILLING-TARGET-ORG-UNBOUND` and the billing-cycle member/financial journeys; cross-cutting financial atomicity and honest-success requirements remain under review. The original 777-defect register and 150-item release-debt index are unchanged.

## Source-level correction

- `apps/union-eyes/lib/services/billing-cycle-service.ts` now calls `requireLiveFinancialMandate(tx, { organizationId, userId: executedBy, action: 'finance:execute', requiresLedger: true })` **inside the tenant transaction that reads members and inserts charges**. Direct service and scheduler callers cannot rely on the API's separate preflight or a platform role title as a substitute for a live ledger-wide mandate.
- A failed member result now throws inside the transaction for a real run, preventing a partial collection of dues charges from being returned as a successful billing cycle. PostgreSQL transaction rollback is expected from `withRLSContext` on a thrown error; native rollback has **not** been independently proven for this correction.
- Dry-run results preserve per-member diagnostic errors and set `success: false` when a calculation fails. Both `POST /api/admin/billing-cycles` in dry-run mode and `POST /api/admin/billing-cycles/preview` return HTTP 422 and `success: false` for an incomplete preview, rather than HTTP 200 with a fabricated successful result. Authorized complete previews retain the existing journey.

## Regression tests authored

- `apps/union-eyes/lib/__tests__/billing-cycle-transaction-safety.test.ts`: service-level mandate refusal before member reads, same transaction handle for the mandate, rejection from within the transaction after one successful and one failed member, and honest incomplete preview state.
- `apps/union-eyes/app/api/__tests__/admin-billing-cycles.route.test.ts`: partial dry-run returns HTTP 422 without the audit intent/charge path.
- `apps/union-eyes/app/api/__tests__/admin-billing-cycles-preview.route.test.ts`: incomplete preview returns HTTP 422 with explicit errors.

## Qualification boundaries / remaining risks

Source corrections and tests were committed; **no exact-HEAD executable result is claimed in this record**. Run focused tests, full Vitest/contract, native PostgreSQL 15/16 with real runtime roles and adversarial cross-tenant/rollback/mandate scenarios, HTTP/browser and staging. In particular, unit mocks do not prove native transaction rollback.

The separate `performAuditedOperation` intent/outcome remains outside the billing service's transaction, and this work does **not** establish atomic billing audit, idempotent exactly-once cycle generation, provider reconciliation, deterministic per-member accounting, or institutional financial mandate issuance. These are release blockers requiring their own corrections and evidence. Existing scheduler invocations without a live mandate now fail closed, not silently execute financial writes.

**Credit:** zero new independently qualified or CLOSED defects. Independent reviewer, owner-persona ratification and institutional authority decisions remain outstanding under Gate 0C.4. Overall GO remains NO_GO.

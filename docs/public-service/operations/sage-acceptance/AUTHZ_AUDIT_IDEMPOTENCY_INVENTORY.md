# SAGE — Authorization / Auditability / Idempotency test inventory

Validated on branch work against `packages/sage-core` + `apps/platform-admin/lib/sage` (2026-09-23).

## Authorization / tenant isolation

| Area | Path | Notes |
| --- | --- | --- |
| Role/permission pure model | `packages/sage-core/src/access-model.test.ts` | membership ≠ permission; sensitive grants |
| Invariants | `packages/sage-core/src/invariants.test.ts` | platform admin no auto sensitive access |
| Service non-disclosure | `packages/sage-core/src/services.test.ts` | inaccessible evidence → NOT_FOUND; decision redaction |
| RLS live PG | `packages/sage-core/src/records-live-postgres.test.ts` | skipped unless live PG; tenant isolation |
| Governance authz migration | `packages/sage-core/src/migration-0035.test.ts` | SQL safety |
| **NEW** synthesis filter | `packages/sage-core/src/synthesis-context.test.ts` + `.fixture.test.ts` | DO_NOT_REGRESS |

**Gap:** deployed staging RLS for `sage_%` still blocked on B-005.

## Auditability

| Area | Path |
| --- | --- |
| Audit action contract | `packages/sage-core/src/audit-events.test.ts` |
| Outbox / delivery | `delivery-crash-recovery.test.ts`, delivery tests |
| Platform adapter | `apps/platform-admin/lib/sage/audit-adapter.ts` |

**Gap:** live audit sink / alert proof = G12 (B-001/B-002).

## Idempotency

| Area | Path |
| --- | --- |
| Platform-admin sage idempotency | `apps/platform-admin/lib/sage/__tests__/idempotency.test.ts` |
| Delivery / destruction keys | records + delivery service tests |

## Automated a11y

| Area | Path |
| --- | --- |
| axe-core operator components | `apps/platform-admin/lib/sage/__tests__/accessibility.test.tsx` (PASS this pass) |
| Manual G11 | `docs/public-service/operations/sage-acceptance/G11_MANUAL_A11Y_CHECKLIST.md` — **not** executed |

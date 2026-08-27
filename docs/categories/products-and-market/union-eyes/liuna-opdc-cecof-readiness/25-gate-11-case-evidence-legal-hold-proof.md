# 25 - Gate 11 Case Evidence Legal-Hold Proof

## Gate Decision

`LIUNA_GATE_11_CASE_EVIDENCE_LEGAL_HOLD = CLOSED_FOR_DESTRUCTIVE_DELETE`

Case evidence deletion now applies the same legal-hold and retention metadata semantics used by the document mutation guard before blob deletion or attachment metadata mutation.

## Implementation Boundary

The case evidence route now:

- selects case `metadata` with the case attachment record;
- evaluates case-level hold/retention metadata before deletion;
- evaluates attachment-level hold/retention metadata before deletion;
- blocks the operation before calling blob storage when either signal is active;
- blocks before writing the reduced attachment list or audit mutation.

## Validation

Source and test:

- `apps/union-eyes/app/api/cases/[caseId]/evidence/route.ts`
- `apps/union-eyes/app/api/__tests__/cases-evidence.route.test.ts`
- `apps/union-eyes/lib/services/document-retention-guard.ts`
- `apps/union-eyes/lib/services/document-retention-guard.test.ts`

Focused validation:

`pnpm --filter @nzila/union-eyes test -- app/api/__tests__/cases-evidence.route.test.ts lib/services/document-retention-guard.test.ts`

Result: PASS, 2 files / 11 tests.

## Claim Boundary

This gate supports a truthful claim that destructive case-evidence deletion is blocked when legal-hold or future-retention metadata is present on the case or attachment.

It does not prove complete matter-wide legal-hold orchestration across every related record type, external exports, provider artifacts, identity-provider sessions, or downstream storage lifecycle.

## Sensitive-Pilot Implication

The legal-hold surface is stronger than the recording baseline because protected case evidence can no longer be physically deleted through the case evidence route. Sensitive legal pilot readiness still requires an explicit matter-hold lifecycle and disposition operating model before claiming a complete legal-hold program.

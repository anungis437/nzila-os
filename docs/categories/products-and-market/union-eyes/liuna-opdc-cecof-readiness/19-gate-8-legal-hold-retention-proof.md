# 19 - Gate 8 Legal Hold And Retention Proof

## Gate Decision

`LIUNA_GATE_8_DOCUMENT_MUTATION_GUARD = PROVEN`

The document-level mutation guard now has LIUNA-relevant test coverage for both flat and nested hold/retention metadata:

- `legalHoldActive: true`;
- `legalHold.active: true`;
- `retentionUntil` in the future;
- nested `retention.until` in the future;
- expired retention allows mutation.

## Validation

Source and test:

- `apps/union-eyes/lib/services/document-retention-guard.ts`
- `apps/union-eyes/lib/services/document-retention-guard.test.ts`

Existing document route tests also prove mutation/delete surfaces call the retention guard before allowing protected document changes.

## Claim Boundary

This gate supports a truthful recording claim that Union Eyes can block document mutation when legal-hold or retention signals are active.

It does not prove a complete matter-wide legal-hold program across every related record type, external exports, notification queue, or downstream storage lifecycle.

## Remaining Sensitive-Pilot Gap

LIUNA-F05 moves from an unproven guard finding to a proven document-mutation guard with a broader matter-lifecycle limitation still open.

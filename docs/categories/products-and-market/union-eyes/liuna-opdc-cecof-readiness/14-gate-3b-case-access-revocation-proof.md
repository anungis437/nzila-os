# 14 - Gate 3B Case Access Revocation Proof

## Gate Status

`LIUNA_GATE_3B_CASE_ACCESS_REVOCATION = PARTIAL`

This gate proves the effective-access contract that underpins revocation, expiry, and successor review. It does not yet prove browser session invalidation, stale direct links, queued notifications, or cache invalidation after revocation.

## Proven Behavior

| Scenario | Result |
| --- | --- |
| Primary owner requests access | Full view, private-document, and owner-only powers are granted. |
| Non-owner has no active assignment | View, private-document, and owner-only powers are denied. |
| Successor reviewer has an active assignment | Case view and scoped draft/comment powers are allowed. |
| Successor reviewer is not primary owner | Owner-only close, reassignment, and sealed-evidence export powers are denied. |
| Assignment predicate | Source contract requires assignment status `active` and expiry in the future or null. |

## Validation

| Command | Result |
| --- | --- |
| `pnpm --filter @nzila/union-eyes test -- lib/services/case-access-service.test.ts app/api/__tests__/grievances-access.route.test.ts lib/services/document-governance-service.test.ts app/api/documents/[id]/download/route.test.ts app/api/__tests__/search-universal.route.test.ts` | PASS; 5 files / 17 tests |
| `pnpm --filter @nzila/union-eyes typecheck` | PASS |

## Claim Impact

Allowed after this gate:
- "Effective access depends on active, unexpired assignments."
- "A successor can be granted scoped case access without receiving owner-only powers."
- "A user without active assignment does not receive case visibility from the effective-access service."

Still prohibited:
- "Former-user offboarding is complete across sessions and direct links."
- "All cached or queued restricted-content actions are revoked."
- "Document links have been proven to fail after every revocation path."
- "This closes all restricted legal pilot requirements."

## Next Gate

`LIUNA_GATE_4_LEADERSHIP_TRANSITION_FIXTURE`

Required proof:
- planned and unplanned transition scenario;
- successor can see open work, deadlines, documents, decision history, and next actions;
- authorship is preserved;
- outgoing/former actor loses effective case powers after revocation or reassignment;
- direct document download remains denied after revoked/expired access.

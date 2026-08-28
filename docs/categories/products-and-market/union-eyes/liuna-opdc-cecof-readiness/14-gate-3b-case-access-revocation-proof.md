# 14 - Gate 3B Case Access Revocation Proof

## Gate Status

`LIUNA_GATE_3B_CASE_ACCESS_REVOCATION = CLOSED_FOR_APP_AUTH_BOUNDARY_WITH_NOTIFICATION_CONTAINMENT`

This gate proves the effective-access contract that underpins revocation, expiry, and successor review. Together with Gates 10A, 10B, and 10C it now also proves that queued notifications, stale local sessions, and steward-copilot pending actions do not survive revocation at the app-auth boundary. It still does not prove identity-provider token revocation latency, browser cache clearing, external email recall after provider handoff, already-issued SAS URLs, or non-copilot background jobs.

## Proven Behavior

| Scenario | Result |
| --- | --- |
| Primary owner requests access | Full view, private-document, and owner-only powers are granted. |
| Non-owner has no active assignment | View, private-document, and owner-only powers are denied. |
| Successor reviewer has an active assignment | Case view and scoped draft/comment powers are allowed. |
| Successor reviewer is not primary owner | Owner-only close, reassignment, and sealed-evidence export powers are denied. |
| Assignment predicate | Source contract requires assignment status `active` and expiry in the future or null. |
| Queued notification to a revoked/deleted member | Delivery-time guard fails delivery (Gate 10A). |
| Stale PG session or selected-organization cookie for revoked local membership | App auth path denies role and organization resolution (Gate 10B). |
| Steward-copilot pending action for a revoked user | Not delayed; synchronous, re-authorized on outcome update (Gate 10C). |

## Validation

| Command | Result |
| --- | --- |
| `pnpm --filter @nzila/union-eyes test -- lib/services/case-access-service.test.ts app/api/__tests__/grievances-access.route.test.ts lib/services/document-governance-service.test.ts app/api/documents/[id]/download/route.test.ts app/api/__tests__/search-universal.route.test.ts` | PASS; 5 files / 17 tests |
| `pnpm --filter @nzila/union-eyes typecheck` | PASS |

Cross-referenced closures (evidence in the linked gates):

- Gate 10A - queued-notification offboarding: `CLOSED` (see [22](./22-gate-10-notification-offboarding-proof.md)).
- Gate 10B - session / direct-link offboarding: `CLOSED_FOR_APP_AUTH_BOUNDARY` (see [23](./23-gate-10b-session-direct-link-offboarding-proof.md)).
- Gate 10C - pending AI action cancellation: `CLOSED_FOR_STEWARD_COPILOT` (see [24](./24-gate-10c-pending-ai-action-proof.md)).

## Claim Impact

Allowed after this gate:
- "Effective access depends on active, unexpired assignments."
- "A successor can be granted scoped case access without receiving owner-only powers."
- "A user without active assignment does not receive case visibility from the effective-access service."
- "Queued Union Eyes notifications carrying a member recipient id are not delivered to a former or inactive organization member." (via Gate 10A)
- "Revoked or deleted local memberships are not re-authorized by a stale app session or selected-organization cookie." (via Gate 10B)
- "Steward-copilot work is request-bound and human-reviewed rather than a delayed autonomous action for a revoked user." (via Gate 10C)

Still prohibited:
- "Identity-provider token revocation is instant."
- "Browser cache and locally-persisted state are cleared on revocation."
- "External email or SMS delivery is recalled after provider handoff."
- "Every already-issued SAS URL is invalidated at the moment of revocation."
- "Every Django/Celery or otherwise non-copilot background job is cancelled at revocation." (`LIUNA_BACKGROUND_JOB_AND_PROVIDER_ARTIFACT_CANCELLATION = OPEN_OPERATING_LIMITATION`)
- "This closes all restricted legal pilot requirements."

## Next Gate

`LIUNA_GATE_4_LEADERSHIP_TRANSITION_FIXTURE`

Required proof:
- planned and unplanned transition scenario;
- successor can see open work, deadlines, documents, decision history, and next actions;
- authorship is preserved;
- outgoing/former actor loses effective case powers after revocation or reassignment;
- direct document download remains denied after revoked/expired access.

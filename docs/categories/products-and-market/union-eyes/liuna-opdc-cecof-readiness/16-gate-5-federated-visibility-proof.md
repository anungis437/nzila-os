# 16 - Gate 5 Federated Visibility Proof

## Gate Status

`LIUNA_GATE_5_FEDERATED_VISIBILITY_MODEL = CLOSED_FOR_GOVERNANCE_MODEL`

This gate proves the federation sovereignty visibility model needed for an OPDC/CECOF/local conversation. It does not yet prove a complete production dashboard or aggregate-reporting UI workflow.

## Synthetic Model

| Synthetic Unit | Visibility Setting | Expected Result |
| --- | --- | --- |
| `liuna-local-900-synthetic` | `regional` | Local detail remains local; regional summary visibility is allowed. |
| OPDC/CECOF-style central reviewer | Requests `regional` | No audit visibility disagreement. |
| OPDC/CECOF-style central reviewer | Requests `national` or `federated` raw scope | Classified as audit visibility disagreement. |

## Proven Behavior

| Behavior | Result |
| --- | --- |
| Local raw detail remains available to the local unit. | `localDetailVisible = true` for the local policy. |
| OPDC-style regional summary can be configured. | `regionalSummaryVisible = true` when audit visibility is `regional`. |
| National/federated raw-detail expansion is not silent. | Conflict detector returns `audit-visibility-disagreement`. |
| Central steward-level access does not unlock privileged documents by itself. | Covered by Gate 3A document policy proof. |

## Validation

| Command | Result |
| --- | --- |
| `pnpm --filter @nzila/union-eyes test -- lib/federation-sovereignty/__tests__/autonomy.test.ts lib/federation-sovereignty/__tests__/conflicts.test.ts lib/services/document-governance-service.test.ts` | PASS; 3 files / 37 tests |
| `pnpm --filter @nzila/union-eyes typecheck` | PASS |

## Claim Impact

Allowed after this gate:
- "Union Eyes has a governance model for local detail and central summary visibility."
- "Central visibility can be configured without automatically exposing raw privileged local records."
- "Requests beyond configured visibility are classified as governance disagreements."

Still prohibited:
- "OPDC/CECOF dashboards are production-ready."
- "Central leadership can safely see all local records."
- "Every aggregate report has been proven not to leak raw details."
- "LIUNA federated deployment is ready."

## Next Gate

`LIUNA_GATE_6_BILINGUAL_MOBILE_RECORDING_READINESS`

Required proof:
- English/French LIUNA-safe vocabulary;
- mobile-sized recording script or screen checklist;
- no CUPE-specific terminology leakage in LIUNA recording artifacts;
- no claim of full bilingual production readiness without UI execution.

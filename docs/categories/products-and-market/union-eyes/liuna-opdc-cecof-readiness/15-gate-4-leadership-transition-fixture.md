# 15 - Gate 4 Leadership Transition Fixture

## Gate Status

`LIUNA_GATE_4_LEADERSHIP_TRANSITION_FIXTURE = CLOSED_FOR_RUNTIME_PROOF`

This gate proves a synthetic leadership-transition reading in the Union Eyes OCI runtime layer. It does not yet prove the full browser walkthrough, former-user session invalidation, or legal-matter pilot readiness.

## Fixture

Scope:
- `institution:liuna-opdc-cecof-synthetic`

Scenario:
- planned leadership transition;
- outgoing senior officer or counsel-equivalent role;
- authorized successor reviewer;
- governance memory reference for `GRV-ONT-2041`;
- continuity ledger event;
- onboarding survivability;
- stewardship transfer;
- successor stewardship reading;
- governance traceability;
- executive continuity narrative.

## Proven Behavior

| Behavior | Result |
| --- | --- |
| In-scope onboarding and transfer readings compose. | Successor readiness is readable and stabilizing/holding based on weakest evidence. |
| OPDC and local readings use different institution scopes. | Runtime refuses composition as `not_yet_readable`. |
| Governance memory is reviewer- and institution-scoped. | Narrative includes scoped memory and ledger evidence. |
| Continuity narrative is executive-readable. | Runtime reports `readableForExecutive = true`. |
| Tone remains controlled. | Existing tone discipline rejects forbidden marketing/autonomy wording. |

## Validation

| Command | Result |
| --- | --- |
| `pnpm --filter @nzila/union-eyes test -- lib/runtime/__tests__/ociRuntimeInfrastructure.test.ts` | PASS; 1 file / 47 tests |
| `pnpm --filter @nzila/union-eyes typecheck` | PASS |

## Claim Impact

Allowed after this gate:
- "Union Eyes has a deterministic runtime fixture for leadership transition continuity."
- "The runtime can compose successor-readable institutional context when readings are in the same institution scope."
- "The runtime refuses to compose OPDC/local readings when the institution scope differs."

Still prohibited:
- "The full LIUNA browser workflow is proven."
- "Former users are fully locked out across sessions and direct links."
- "All amendments, exceptions, and legal decision rationales are lifecycle-complete."
- "A sensitive legal pilot is ready."

## Next Gate

`LIUNA_GATE_5_FEDERATED_OPDC_CECOF_LOCAL_REPORTING`

Required proof:
- central oversight does not imply raw privileged record access;
- local autonomy remains protected;
- aggregate reporting can be shown without raw disclosure;
- LIUNA vocabulary/profile does not leak CUPE-specific assumptions into the recording.

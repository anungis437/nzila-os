# 12 - Gate 2 Continuity Authorization Proof

## Gate Status

`LIUNA_GATE_2A_CONTINUITY_INHERITANCE_AUTH = CLOSED`

This gate closes the narrow authorization defect identified as LIUNA-F01. It does not close the broader sensitive legal-matter, former-user revocation, central reporting, legal-hold lifecycle, or bilingual/mobile readiness gates.

## Source Change

`apps/union-eyes/app/api/continuity/inheritance/route.ts`

Before:
- Local `requireOrgAccess(_request)` returned `true`.
- GET and POST checked that placeholder before delegating to onboarding.

After:
- The route directly re-exports `GET`, `POST`, and `dynamic` from `../../onboarding/route`.
- The inherited route therefore uses the existing governed onboarding CRUD contract:
  - authenticated route handling;
  - organization scoping;
  - minimum member read role;
  - minimum steward write role.

## Regression Protection

`apps/union-eyes/app/api/__tests__/continuity-inheritance.route.test.ts`

The test proves:
- the facade delegates to the governed onboarding route;
- `dynamic` remains `force-dynamic`;
- the source no longer contains `function requireOrgAccess`;
- the source no longer contains the local `return true;` placeholder guard.

## Validation

| Command | Result |
| --- | --- |
| `pnpm --filter @nzila/union-eyes test -- app/api/__tests__/continuity-inheritance.route.test.ts app/api/__tests__/pilot-onboarding.route.test.ts` | PASS; 2 files / 6 tests |
| `pnpm --filter @nzila/union-eyes typecheck` | PASS |

## Claim Impact

Allowed after this gate:
- The recording may describe `/api/continuity/inheritance` as a governed onboarding-continuity facade.
- The recording may say the prior placeholder facade defect has been removed.

Still prohibited:
- claiming restricted legal handover is fully proven;
- claiming former-user revocation is complete;
- claiming cross-body OPDC/CECOF/local access is production-ready;
- claiming solicitor-client privilege, complete legal hold, or legal compliance certification.

## Next Gate

`LIUNA_GATE_3_CONFIDENTIAL_MATTER_AUTHORIZATION`

Required proof:
- OPDC/CECOF/local/central/admin/former/external actor matrix;
- restricted matter negative tests;
- document/search/export/AI boundary checks;
- grant/revoke audit events.

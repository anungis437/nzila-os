# 23 - Gate 10B Session And Direct-Link Offboarding Proof

## Gate Decision

`LIUNA_GATE_10B_SESSION_AND_DIRECT_LINK_OFFBOARDING = CLOSED_FOR_APP_AUTH_BOUNDARY`

The app authorization path now revalidates local organization membership as active and non-deleted when resolving users and organizations. This closes the app-level stale-session gap for revoked local memberships:

- PG-session role lookup requires active membership;
- selected-organization cookie fallback requires active membership;
- selected-organization slug fallback requires active membership;
- local legacy organization fallback requires active membership;
- direct organization-access checks require active membership;
- user-role lookup requires active membership;
- deleted membership rows are excluded from those paths.

Direct document download remains behind:

- organization auth;
- entitlement check;
- fresh minimum-role check;
- active explicit document grant checks;
- non-revoked and unexpired document grants;
- effective case access lookup;
- document-governance policy evaluation.

## Validation

Source and tests:

- `apps/union-eyes/lib/api-auth-guard.ts`
- `apps/union-eyes/lib/organization-utils.ts`
- `apps/union-eyes/app/api/documents/[id]/download/route.ts`
- `tooling/contract-tests/union-eyes-offboarding-auth-boundary.test.ts`
- existing document/search/case-access tests from Gates 3A and 3B.

## Claim Boundary

This gate supports a truthful sensitive-readiness claim that revoked or deleted local organization memberships do not remain authorized merely because a stale app session or selected-organization cookie still exists.

It does not prove identity-provider token revocation latency, browser cache clearing, external email recall, or downstream provider-side link invalidation after a SAS URL has already been issued.

## Remaining Sensitive-Pilot Gap

`LIUNA_GATE_10C_PENDING_AI_ACTION = OPEN`

The next offboarding proof must cover pending AI/copilot actions and any other queued background actions that can outlive membership revocation.

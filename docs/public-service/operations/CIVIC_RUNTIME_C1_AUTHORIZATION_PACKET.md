# CIVIC Runtime C1 Authorization Packet

**Artifact type:** Bounded synthetic-client authorization proposal; not an executable grant

**Prepared:** 2026-11-23

**Status:** `AWAITING_OWNER_GRANT`

**Proposed data boundary:** `SYNTHETIC_ONLY`

**Implementation authorization:** `NOT_AUTHORIZED`

**Activation disposition:** `CIVIC_C1_ACTIVATION_BLOCKED`

This packet records the fail-closed C1 capability descriptor accepted under the
2026-11-23 CIVIC/CLEAR/SAGE product ceiling. It does **not** authorize protected
CIVIC runtime execution, deployment, production use, real institutional data, or
reactivation of terminated Slice 0/1/2 grants.

General `runtimeAuthorization.authorized` remains `false`.
`CIVIC_PRODUCT_GO_LIVE` remains `NO_GO`.

## 1. Objective

Authorize, only after an exact owner decision below, a narrowly scoped synthetic
CIVIC client-facing application that:

- consumes typed SAGE contracts with fictional institutional fixtures;
- preserves OCI as the sole methodology authority and CLEAR as the evidence
  discipline overlay;
- remains bilingual and mobile-first for persona-aware institutional journeys;
- never invents institutional scores, person ranking, or AI decision-makers.

## 2. Hard exclusions

Until the maintainer decision section records `AUTHORIZE_WITH_CONDITIONS` with
exact SHA, branch/worktree, effective/expiry timestamps and writable paths:

- no protected CIVIC runtime execution;
- no deployment or production publish;
- no real institutional data;
- no runtime alias outside `apps/civic`;
- no modification of `apps/union-eyes/**` under this grant;
- no reuse of terminated Slice 0/1/2 execution windows.

## 3. Proposed writable surface (inactive until grant)

- `apps/civic/src/c1`
- `apps/civic/tests/c1`
- `apps/civic/c1.tsconfig.json`
- `apps/civic/c1.vitest.config.ts`
- this packet and a future `CIVIC_RUNTIME_C1_PROOF.md`
- doctrine contract / guard / integrity tests listed in `CIVIC_C1_PENDING`

## 4. Fail-closed verification required before any positive claim

Unauthorized current checkout, wrong branch, expired or revoked grant, real
data, unlisted path, fake provider, cross-app alias, accidental production
script, and modified archive must all fail closed. Positive admission tests are
permitted only against an exact bounded synthetic grant.

## MAINTAINER DECISION

**Decision:** `PENDING`

**Maintainer:** Aubert Nungisa

**Decision date:** _unrecorded_

**Conditions:** Owner must supply exact starting SHA, authorized
branch/worktree, effective/expiry window, and confirm synthetic-only /
non-production / non-deployment / no real institutional data. Historical Slice
0/1/2 grants remain terminated.

**Authorized starting SHA:** `PENDING`

**Authorized branch/worktree:** `PENDING` /
`PENDING`

**Effective:** `PENDING`

**Expires:** `PENDING`

**Data boundary:** `SYNTHETIC_ONLY`

**Production:** `NOT_AUTHORIZED`

**Deployment:** `NOT_AUTHORIZED`

**Real institutional data:** `NOT_AUTHORIZED`

**Status marker:** `AWAITING_OWNER_GRANT`

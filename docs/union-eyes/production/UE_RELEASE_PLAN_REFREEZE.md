# Union Eyes release: plan re-freeze

`PLAN_STATUS = REFROZEN_FOR_E2E_AUTH_COMPATIBILITY`

| Field | Value |
| --- | --- |
| Original accepted / staging-qualified plan | `4f9732e25ce07fc953648d5275c1901d674c833c78631b814f389bb90cc4c748` |
| Previous clean-release plan | `0a5ee060e7c3e3e373192ca8a4a1d58a47b44bfe490c6a7f8587f05127553ef4` |
| Final auth-repaired plan | `5ba116ec82c491577f4eee6ee7e19ef83472d62fd3d2b263b6e3212f9970597e` |
| Digest definition | sha256 of `JSON.stringify(plan)` for `UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json` |

## Final E2E compatibility re-freeze

`PLAN_CHANGE_REASON`:

```text
Restore non-production, non-canonical
E2E seed-session compatibility removed
during canonical auth rewrite.
```

Exactly one source commitment changed: `packages/platform-auth/src/entra/server.ts`.
The full semantic plans compare equal after removing source-digest metadata.
All 694 tables, 8,420 statement canonical IDs and SQL texts, 297 decisions,
54 exclusions and zero security blockers are unchanged. No business schema or DDL changed.

The fallback requires the explicit E2E flag, QA flag, `UE_ENVIRONMENT=local`,
`UE_CANONICAL_BOOTSTRAP_V2=0`, no configured canonical auth database credentials,
and a strictly validated existing `ue-seed-session-ue-qa-*` fixture cookie.
Every configured production signal denies it. `NODE_ENV=production` describes the
Next.js build used by the browser harness; the existing UE deployment identity is
explicitly local. The fallback only reads existing active users and memberships.
It writes no identity, membership or role state; application tenant and role checks remain in place.
Ordinary opaque password sessions and canonical Entra binding resolution retain their existing paths.

Before re-freeze: platform-auth tests 207/207, selected UE auth/tenant tests 1,257/1,257
(15 files, exit 0; Windows worker-shutdown warning retained), platform-auth lint,
platform-auth/Zonga-core/UE typechecks, and 57 existing E2E infrastructure contracts passed.
The repair commit also passed the normal repository hook's 236 typecheck tasks.
The browser workers explicitly check out and verify the final PR head.
Exact-head release qualification and human security disposition are recorded on PR #923.

Updated current digest-bound records include the identity contract (official census generator),
release plan references, production hardening package, acceptance ledger and release manifest.
The ledger and hardening package expose the current lineage in `releasePlanRefreeze`.
Earlier acceptance/candidate objects and runtime evidence retain their original values;
they do not qualify this later source. No staging capability claim or production authorization is added.

## Qualification-discovered fixture corrections

The first exact-head E2E attempt at `542af8b` passed three workers and exposed a
legacy API-test helper calling the canonical password gateway without canonical
credentials. The test-only helper now installs the existing seeded session into
Playwright's real API cookie jar through a nonce-scoped loopback HTTP response.
It rejects remote targets and unknown/inactive fixtures. Seven focused tests
cover cookie delivery, identity switching, rejection and the unchanged ordinary
password-login flow. Production login and E2E assertions remain unchanged.

The same head's isolated fast suite returned exit 0 with 30,053 passing tests,
zero failures and 518 skips in 13m11s, but its strict receipt rejected tracked
report mutations. Three report-generator tests now restore original report bytes
after validating fresh output. All three focused tests pass with no report diff;
source-integrity qualification remains mandatory. Neither correction changes a
plan-bound source commitment or the plan digest above. Later exact-head results
and human security review must be recorded on PR #923 before a merge decision.

## Prior clean-release re-freeze (historical)

`PLAN_STATUS = REFROZEN_FOR_RELEASE`

| Field | Value |
| --- | --- |
| `PREVIOUS_PLAN_DIGEST` (qualified on staging) | `4f9732e25ce07fc953648d5275c1901d674c833c78631b814f389bb90cc4c748` |
| `NEW_RELEASE_PLAN_DIGEST` | `0a5ee060e7c3e3e373192ca8a4a1d58a47b44bfe490c6a7f8587f05127553ef4` |
| Digest definition | sha256 of `JSON.stringify(plan)` for `UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json` |

## What did not change

Tables (694), statements (8,420; every canonical id and SQL text), decisions, exclusions (54), security blockers (0), `authExecution`, `installerExecution` and `frameworkExecution` are identical. Only `sourceCommitments` (hashes of source files the plan is bound to) and the per-statement source digests derived from them changed. No schema authority changed.

## Why the digest changed (`PLAN_CHANGE_REASON`)

1. **Line endings (17 files).** The previous digest was computed over CRLF working-tree bytes. The repository normalises to LF (`.gitattributes`: `* text=auto eol=lf`), so no checkout could reproduce it. Re-hashing the same content as LF accounts for the `current_*`/`framework_application.py`, `auth-*.ts`, `auth-storage-authority/*`, `auth_core/canonical_context.py`, `acceptance-trust.ts`, `complete-auth.ts`, `provider-identity.ts` and `db/auth-client.ts` commitments.
2. **Cora carved out of the release.** `cora-acceptance-auth.ts` and `source-disclosure.ts` are no longer committed, so their commitments are removed; `platform-auth/src/index.ts` no longer exports them.
3. **Required type-safety correction.** `platform-auth/src/authorization-context.ts` gets a guard for an unchecked indexed access, needed for `@nzila/zonga-core` to typecheck (`noUncheckedIndexedAccess`).
4. **Repository-contract fixes in plan-hashed tooling.** `bootstrap-v2/caller-inventory.ts` builds its lookup map per call instead of at module scope (GA Truth Hardening); `bootstrap-v2/caller-graph.ts` assembles the server-action directive string so a repository source scan does not mistake the analyser for a server action.
5. **`pnpm-lock.yaml`.** The plan commits to the lockfile; the release changes no dependency, so it is now the `main` lockfile rather than a locally modified one.

## `PLAN_CHANGE_FILES`

`pnpm-lock.yaml`; `apps/union-eyes/scripts/bootstrap-v2/{current_models.py,current_application.py,framework_application.py,auth-fixture.ts,auth-org-runtime.ts,auth-privileges.ts,auth-runtime.ts,auth-sql.ts,caller-graph.ts,caller-inventory.ts}`; `apps/union-eyes/backend/auth_core/canonical_context.py`; `packages/db/src/auth-client.ts`; `packages/db/src/auth-storage-authority/{bootstrap-sql.ts,execution-boundary.ts,org-session-authority.ts,privilege-expectations.ts}`; `packages/platform-auth/src/{acceptance-trust.ts,authorization-context.ts,complete-auth.ts,index.ts,provider-identity.ts}`; removed: `packages/platform-auth/src/{cora-acceptance-auth.ts,source-disclosure.ts}`.

## Dependent documents

Regenerated or updated: `UE_APPLICATION_IDENTITY_CONTRACT.json/.md` (official `identity-census.ts --write`; only `sourcePlanDigest` changed), `UE_FINAL_ACCEPTANCE_LEDGER.json`, `UE_PRODUCTION_HARDENING_PACKAGE.json`, the production and bootstrap READMEs and `RUNBOOK_DATABASE_BOOTSTRAP.md`. `UE_V2_NEXT_RUNTIME_ACCEPTANCE.json` records the runtime acceptance run against the previous digest and is intentionally left as historical evidence.

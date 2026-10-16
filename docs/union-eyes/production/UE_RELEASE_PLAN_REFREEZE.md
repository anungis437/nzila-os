# Union Eyes release: plan re-freeze

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

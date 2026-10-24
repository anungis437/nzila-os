# UE Final Convergence — Checkpoint 1 (UE-FINAL-CONVERGENCE-2026-10)

**Branch:** `agents/ue-final-convergence` (integration worktree `C:\APPS\nzila-os.worktrees\ue-final-convergence`)
**Base:** `e2103f297` (authority kernel Phase 1 source closure), plus the Clerk-removal branch merged at `24ca3f9b5`.
**Not pushed. No persona branch merged. No other agent's worktree touched.**

## Verdicts (four independent decisions)

| Verdict | State | Why |
|---|---|---|
| ENGINEERING_CONVERGENCE | **NOT ACHIEVED** | 15 register entries OPEN and 6 IN_PROGRESS; six persona branches not yet integrated against the kernel; durable counsel stores and finance sources not built |
| CREDENTIALED_END_TO_END_ACCEPTANCE | **NOT STARTED** | needs a credentialed staging clone and recorded sessions; none exist |
| INSTITUTIONAL_AUTHORIZATION | **NOT ADOPTED** | the default issuance rules and the document class policy remain provisional until the institution adopts them with real source instruments |
| PRODUCTION_RELEASE | **NO-GO** | `UE_SAAS_OPERATIONAL_READINESS` is `NO_GO — RUNTIME_PROOF_REQUIRED`; staging and production promotion are not authorized |

## What changed in this tranche

| Commit | Change |
|---|---|
| `24ca3f9b5` | Merged the Clerk-removal branch (only generated inventory outputs conflicted; regenerated) |
| `01b7a0ecb` | Replaced 13 generated fake-success routes (HTTP 200 `accepted`, empty list) with HTTP 501 through `ApiError.notImplemented`; added 6 `UE-ACTION-*` `NOT_IMPLEMENTED` capability entries; added anti-theatre rule R-9 with tests |
| `4cced851a` | Convergence register (`UE-CONV-*`), supersession registry, allowlist ratchets, checker and 12 unit tests; removed three stray scripts (two with hard-coded local credentials, one `drizzle-kit push` wrapper that bypassed the ledger) |
| `4d0a8e130` | `validate:ue-convergence`, wired into `validate:governance`; real retirement sha recorded |
| `8616110ed` | `read_internal` is no longer derived from the legacy `can_edit_case_notes` flag; it is an explicit kernel grant under the `case_assignment` rule |
| `16fa70761` | Counsel: separate-capacity, conflict and information-barrier model replaces the blanket union-member exclusion; `authenticateCounselAssertion` with signature and single-use nonce ports |
| `0848284ec` | Session bearer exposure review (source-level) and a no-new-consumer ratchet |
| (this commit) | Corrected a stale guard-test fixture and added this checkpoint |

## Evidence

| Check | Result |
|---|---|
| Authority and database suites (`lib/authority`, `db`, in-process PostgreSQL) | 1780 passed, 91 skipped, 0 failed |
| `tsc --noEmit` (`apps/union-eyes`) | exit 0 |
| ESLint on changed authority and test files | exit 0 |
| `node tooling/scripts/check-ue-convergence.mjs` | passed (register valid, 6 ratchets, migration lineage verified) |
| Checker unit tests | 12 passed |
| Anti-theatre scan | 0 errors, 1278 warnings |
| `tooling/reality` tests | 43 passed (5 stale-fixture failures in `demo-deployment-guard.test.ts` were present at `e2103f297` and are fixed here; the registry records that the `cupe4373` profile was removed deliberately) |
| Real-PostgreSQL 15/16 combined and native-identity suites | **NOT re-run in this tranche.** Last run at `e2103f297`: combined 10/10 on PG15 and PG16, native identity 9/9, storage and Django audit 15/15. Neither the counsel change nor the internal-scope change touches those suites' code paths, but that is an inference, not a result |
| `pnpm lint`, `pnpm test:fast`, `pnpm validate:docs`, `pnpm governance:audit` | **NOT run in this tranche** (pre-commit hooks ran gitleaks, brand leakage, inventory sync, lint-staged and a `@nzila/union-eyes` typecheck on each commit) |

## Closed in the register (6)

Kernel-owned provider resolver removal (`UE-CONV-A-002`), internal-file scope (`F-001`), stub elimination (`H-001`), stray scripts (`H-006`), migration lineage verification (`K-001`) and stub detection (`K-002`). `F-001` is closed for `read_internal` only: `write` still derives from the legacy flag until the assignment table is retired (`B-001`).

## Still open — honest list

- **Counsel durable stores (`G-001`) — closed on the union side** in the follow-up commit: engagement register and nonce store added to kernel migrations `0013`/`0020` (now 16 relations; hashes `7d5ea524…989d` and `aab16d12…8125`, still UNQUALIFIED and unapplied to any live database). Proven in-process, and on real PostgreSQL 15 and 16 (combined suite 10/10, storage and Django-audit 15/15 each). The counsel-side signature verifier and key custody remain an external gate (`G-003`).
- **Session bearer (`A-004`).** Reviewed, not remediated. The long-lived cookie is sent as a bind parameter on the `pg-session` path. Deployment log settings are unverified. Code change touches the unapplied `0041` and the registered `0017`.
- **Case ownership (`B-001`).** `union_rep_id` has no foreign key and 27 files read it; 15 files still use `isStewardPlus` or `case_read_any`. Both are ratcheted, not migrated.
- **Finance (`D-*`).** The deployed `payments` relation is a 4-column stub; the real approval tables exist only in the undeployed `services/financial-service`.
- **Legacy entrypoints (`H-003`, `H-005`).** `db:push` and `db:migrate:legacy` remain; `seed-master.sql` writes `clerk_organization_id`, which Django `auth_core.0003` renamed.
- **Persona integration.** Not started. Each persona is to be integrated against the kernel contract, not merged wholesale.
- **WorkAid candidate (`G-002`).** Unmerged; analysis only.

## External gates (named owner and missing proof in the register)

Webhook sender discovery and the deprecated alias; the Whop consumer of the legacy `clerkUserId` metadata key; test-credential rotation; staging clone qualification; institutional adoption of the issuance rules and document class policy. None can be satisfied from source.

## Resume point

1. `UE-CONV-A-004`: apply the deployment log controls and stop passing the long-lived cookie.
2. `UE-CONV-E-001` / `B-001`: migrate the 15 rank-derived files and the `union_rep_id` readers to kernel assignments, shrinking both allowlists.
3. Persona integration against the kernel, one persona at a time.
4. Re-run the full required validation set before any review request.

Phase 3B remains blocked while `UE_SAAS_OPERATIONAL_READINESS` reads `NO_GO`.

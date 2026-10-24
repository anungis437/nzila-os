# UE Final Convergence — Checkpoint 2 (UE-FINAL-CONVERGENCE-2026-10)

**Branch:** `agents/ue-final-convergence` (integration worktree `C:\APPS\nzila-os.worktrees\ue-final-convergence`)
**Supersedes:** [Checkpoint 1](./UE-FINAL-CONVERGENCE-CHECKPOINT-1.md) for the persona-integration and counsel-store status.
**Not pushed. No other agent's worktree touched.** The separate navigation worktree (`fix/ue-global-experience-convergence`) is not integrated.

## Verdicts (four independent decisions)

| Verdict | State | Why |
|---|---|---|
| ENGINEERING_CONVERGENCE | **NOT ACHIEVED** | All six persona branches are merged, but 13 register entries remain OPEN and 8 IN_PROGRESS. Role-level reads remain in the CUPE claims module and the member directory; finance has no mandate model; governance approvals are not on kernel approval requests |
| CREDENTIALED_END_TO_END_ACCEPTANCE | **NOT STARTED** | needs a credentialed staging clone and recorded sessions; none exist |
| INSTITUTIONAL_AUTHORIZATION | **NOT ADOPTED** | default issuance rules and the document class policy remain provisional until the institution adopts them |
| PRODUCTION_RELEASE | **NO-GO** | `UE_SAAS_OPERATIONAL_READINESS` is `NO_GO — RUNTIME_PROOF_REQUIRED` |

## What changed since Checkpoint 1

| Commit | Change |
|---|---|
| `0f9f6925d` | Durable counsel engagement register and nonce store in kernel migrations `0013`/`0020` (16 relations); proven on in-process PostgreSQL and real PostgreSQL 15 and 16 |
| `ac67711d0` | Removed the `db:push` script from Union Eyes (ratchet `SCHEMA-PUSH-SCRIPT`) |
| `4d1887b4e` | Bearer review addendum; candidate fix recorded, not applied |
| `78c93cf5c` | Removed seniority-derived case access (`isStewardPlus`) from documents, search, intelligence and grievance routes; collaborator grants are primary-owner-only |
| `4659bf8c1` | Platform roles are no longer promoted into case authority |
| `846225ef6` | Deleted Clerk-era provisioning scripts; `seed-master.sql` no longer writes Clerk identifiers |
| `9188458f9` | Merged Governance Officer 2.1; approvals audit in-transaction under the canonical chain |
| `dc115ce3a` | Merged Senior Representative 2.1 |
| `7362ad3f7` | Merged Officer / Executive 2.1 |
| `4d4f172c0` | Merged Financial Officer 2.1 |
| `91f13790c` | Merged Representative 2.2 after removing its role-derived supervisory case read and platform-admin directory elevation |
| `437e0e96c` | Merged Member 2.1 after closing its steward-wide document shortcut and tenant-wide message-thread read |

Each merge kept the relationship-scoped authority rule where a persona branch retained a role-derived read. No branch was selected for being more recent.

## Ratchets after the merges

`RANK-DERIVED-CASE-ACCESS` covers 4 files (down from 15), all in the CUPE claims role matrix (`UE-CONV-E-001`). `PLATFORM-ROLE-CASE-PROMOTION`, `SCHEMA-PUSH-SCRIPT` and `RETIRED-KERNEL-RESOLVERS` are at zero. `MUTABLE-REP-IDENTIFIER` (30 files) and `BEARER-SETTING-CONSUMERS` (12) are unchanged and not migrated.

## Evidence

| Check | Result |
|---|---|
| `tsc --noEmit` (`apps/union-eyes`) | exit 0 at the merged tree |
| Full Union Eyes suite (excluding `*.postgres.test.ts`), final run after the corrections | 19,382 passed, 3 failed (`rls-storage-reachability-audit`, `rls-verify-deadline-engine-policies.pglite`, `round37-social-media-accounts-boundary`); all three pass when run alone (44/44), so they are load-related timeouts, not regressions. An earlier run showed a different set of four load-related failures that also passed alone. The two real failures found on the way (stale Member 2.1 tests and one stale member-sidebar expectation) were corrected |
| `pnpm lint` | exit 0 (0 errors, 2,929 warnings in Union Eyes) |
| `pnpm validate:docs` | exit 0 (0 errors) |
| `pnpm governance:audit` | exit 0 |
| `node tooling/scripts/check-ue-convergence.mjs` | passed (register valid, ratchets matched, migration lineage verified) |
| Real PostgreSQL 15/16 suites | Run against the counsel-store change (combined 10/10, storage and Django audit 15/15 each). **Not re-run after the persona merges**; none of them touch the kernel migrations |
| `pnpm test:fast` | **Not run in this tranche** (pre-commit hooks ran gitleaks, brand leakage, link check, inventory sync, lint-staged and a typecheck on each commit) |

## Known authority gaps carried forward

- Secure-message threads: staff see only threads they own or are assigned to, and no assignment mechanism exists, so staff cannot see new member threads. This is an open workflow gap rather than a granted bypass (`UE-CONV-I-001`).
- The CUPE claims module and the member directory (chief steward and above) are still numeric role matrices.
- Governance approvals use legacy tables, have no recusal, and run under `withSystemContext`.
- Finance route gates are a numeric hierarchy plus an exact allow-list; neither models separate financial duties.
- The deployed `payments` relation is a 4-column stub.
- `seed-master.sql` cannot run on the canonical Django schema (`H-005`).
- The multi-database client removal is blocked by the bootstrap-v2 source plan (`H-004`).

## External gates

Webhook sender discovery, the Whop consumer of the legacy metadata key, test-credential rotation, staging clone qualification, institutional adoption of issuance rules and document class policy, and the counsel-side signature verifier and key custody (`G-003`). None can be satisfied from source.

## Resume point

1. Run `pnpm test:fast`.
2. Add a staff-thread assignment mechanism on kernel assignments (`I-001`).
3. `UE-CONV-E-001` / `B-001`: migrate the claims module and the `union_rep_id` readers onto kernel assignments once kernel storage is qualified.
4. `UE-CONV-A-004`: bearer fix together with its consumers.
5. WorkAid candidate (`G-002`) assessment.

Phase 3B remains blocked while `UE_SAAS_OPERATIONAL_READINESS` reads `NO_GO`.

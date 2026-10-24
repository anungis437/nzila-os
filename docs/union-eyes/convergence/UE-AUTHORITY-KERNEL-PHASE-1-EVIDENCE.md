# UE Authority Kernel — Phase 1 Completion Evidence

**Mission:** `UE-AUTHORITY-KERNEL-PHASE-1-COMPLETION` (items A–G)
**Kernel branch:** `agents/ue-authority-kernel` (base `0c994b968`)
**Supersedes:** the earlier Phase 1 evidence record (8 relations, uuid principals), which is obsolete.
**Superseded by:** [UE-AUTHORITY-KERNEL-PHASE-1-EXIT-EVIDENCE.md](./UE-AUTHORITY-KERNEL-PHASE-1-EXIT-EVIDENCE.md) for the Phase 1 exit verdict (FAIL), actor binding, classified access and combined-schema qualification.
**Staging / production:** NO-GO. **Phase 2 and the six-persona merge:** BLOCKED pending review of this package.

## 1. Verdict

**Phase 1 is NOT YET PASS. Phase 1 remains open.**

| Workstream | Status | Basis |
|---|---|---|
| A. Identity cleanup containment (Clerk branch) | PASS (local) | Org-binding fix, compat shims, credential removal, seed fix, 13 DB-free tests. Credential invalidation is external and not done. |
| B. Authoritative identity, membership, resource facts | PARTIAL | Loaders exist for case, document, financial, review and WorkAid. No authoritative source for case unit/territory, respondents, financial workflow actors, member financial records or a common review subject. `union_rep_id` has no verified principal mapping. |
| C. Mandate issuance lifecycle | PASS (local) | Rule-based, provenance-backed, DB-enforced. Nothing issues until an institution activates rules with real instruments. |
| D. Transactional audit | PASS (local) | Business and audit writes share one executor. A deferred trigger refuses COMMIT without a matching audit row. Django verifier accepts every bridge row. |
| E. Migration certification | PASS, additions UNQUALIFIED | Pinned approved lineage, registered additions, bootstrap replay on PG16. Grant activation did not run (Windows). No staging clone qualification. |
| F. Seed and auth containment | PARTIAL (external) | Seed repaired and verified on PG15/16. Credential rotation, webhook and Whop consumers unresolved. |
| G. Evidence package | This document | |

## 2. Repository inventory (nothing pushed, nothing merged)

| Branch | Head |
|---|---|
| `agents/ue-authority-kernel` | `461376df5` |
| `agents/ue-remove-clerk` | `f825b61fd` |
| `agents/frozen-governance-officer-21-architecture` | `4d86c3758` |
| member | `a8cb15f91` (one untracked `AGENTS.md`, pre-existing) |
| representative | `a0e7753fd` |
| senior representative | `94126e853` |
| executive | `638817da2` |
| financial | `7ba993a31` |
| workaid-prep | `541effda5` |

- No remote branches match; no pull requests.
- Local `main` is at `441556737`, an ancestor of the baseline. It was moved by someone else and was not touched.

Kernel commits since baseline: `0c9532269`, `3a999601b`, `bfaddfb2b`, `32f3409e2`, `dba0d5527`, `461376df5` (58 files, +9953/−17).

## 3. Migration manifest and reproducibility

- Approved lineage pinned in `tooling/scripts/lib/ue-approved-migration-lineage.json`: 20 scoped + 16 platform git-blob SHA-256s at `0c994b968aed0657cca5b702954ba87252408245`.
- Registered additions, both **UNQUALIFIED**:

| Migration | SHA-256 (prefix) |
|---|---|
| `db/migrations-platform/0013_authority_kernel_storage.sql` | `6cb84c16…0fa8` |
| `db/migrations-cache/0020_authority_kernel_rls_closure.sql` | `45873e54…5785` |

- `0013` was never deployed. It was rewritten in place (prior hash `cf53ce45…215a`) when internal user ids were found to be `varchar(255)`, not uuid. Editing either registered file requires deliberately updating the registry entry.
- Commands: `measure-ue-migration-lineage.mjs --verify [--ref|--worktree]`, `--emit-baseline`, `--emit-additions`.
- `ue-staging-clone-qualification.mjs` now derives counts and tags from the lineage record (`lineageProblem()`), replacing the hard-coded 20/16/36.
- Bootstrap replay: the repo's approved bootstrap (QA mode) on a fresh PG16 applied all migrations, including `0013` and `0020`. It failed only at runtime grant activation (storage-authority manifest export, a Windows `spawnSync('pnpm')` problem). The baseline worktree fails identically.
- Catalog check on the replayed DB: all 14 `ue_authority_*` tables have RLS enabled and forced, 5 policies each, owned by `postgres`.
- **Not run:** the full Django-migrated lineage plus authority install end to end. The QA bootstrap and the Django `core`-only replay were run separately.

## 4. Identity and principal-binding matrix

| Input | Resolution | Failure behaviour |
|---|---|---|
| Internal user id | `user_management.users.user_id` (text, 1–255 chars, trimmed, no control characters) | Malformed is refused |
| Provider subject (Entra `tid:oid`) | Exactly one verified, active, non-disabled binding to an active user | Zero or multiple bindings are refused |
| Membership | `user_management.organization_users` joined to `users`; `suspended` and `revoked` map from lifecycle state, unknown maps to `inactive` | Duplicate rows are returned so the kernel denies |
| Session org | Must equal the membership org | Mismatch is refused; no primary-org fallback |

Prerequisite NOT done: the runtime role needs a reviewed read path to the identity tables.

## 5. Mandate issuer and action matrix

- Default templates: issue, revoke, suspend (also governs resume) and `case_assignment`. There are no default `amend` rules, so amendment is denied until an institution adopts one.
- Rule activation requires a real source instrument (not `PENDING_INSTITUTIONAL_SOURCE`) and at least 2 distinct approvers who are not the drafter, acting as `executive`.
- DB guard: active matching rule; term, powers and acceptance forced from the rule; a satisfied approval bound to the exact instrument, usable once, with issuer and holder excluded; valid `supersedes_id`.
- TS `decideIssuance` adds issuer capacity or mandate, holder eligibility, SoD, reviewer independence, non-delegable actions, case-assignment conflicts and emergency limits.
- **NOT IMPLEMENTED:** privacy mandate kind and policy; counsel-side WorkAid interface (the union-side referral and counsel-acceptance recorder exist).

## 6. Resource-policy coverage

| Resource | Source | Status |
|---|---|---|
| Case | `grievances`: creator from `created_by`, collaborators from `grievance_case_access_assignments`, classification from `has_legal_implications` and `is_confidential` | Sourced. Unit/territory and respondents have no source. `union_rep_id` is unverified, so owner/assignee needs a Phase 2 backfill. |
| Document | Grievance-type `document_links` only | Sourced. A bare `case` link may mean the legacy `claims` model, so it is not trusted. |
| Financial | `payments` (exact decimal to minor units) plus the kernel-owned `ue_authority_financial_steps` ledger | Partial. No workflow actors exist; the registration snapshot denies if amount or currency later changes. `member_financial_record` has no principal-keyed source. |
| Review | Kernel register `ue_authority_reviews` | Kernel-owned, because no common governance-review subject exists. |
| WorkAid | Kernel register `ue_authority_workaid_matters` | Union side only. The counsel side is not present. |

## 7. Transactional audit proof

- Every writer calls `auditAuthorityMutation`, which appends to the canonical hash-chained `public.audit_logs` through the same executor (details carry `authorityEventIds`, `authorityTxid`, `policyVersion`).
- A DEFERRED constraint trigger on `ue_authority_events` refuses COMMIT unless an `authority.%` audit row names the event. Raw or admin writes without an audit row therefore fail at commit.
- Proven on real PostgreSQL: rollback in both directions, forged or foreign audit rows, idempotent replay, a backend killed mid-transaction and retried, an intact chain under concurrency, and Django's `verify_audit_chain` accepting every bridge row and detecting tampering.
- Caveat: the runtime role can still UPDATE/DELETE `audit_logs`. This is pre-existing and not weakened further. The QA-baseline `audit_logs` has 6 columns and lacks the hash chain, which comes from Django `core` migrations.

## 8. Test results (local only)

| Suite | Result |
|---|---|
| `lib/authority` + all `db` (default run) | 1705 passed, 72 skipped, 0 failed |
| `lib/authority` kernel + issuance | 208 |
| PGlite suites: identity / lifecycle / resources / storage / audit | 21 / 26 / 31 / 24 / 16 |
| Real PostgreSQL storage (11) + Django audit (4) | 15/15 on PG15 and on PG16 |
| Registry composition | 847 |
| Lineage certification / clone gate / deployment safety / delegated review | 9 / 43 / 24 / 266 |
| `tsc --noEmit` | clean |
| eslint on new code | 0 errors, 0 warnings |
| `pnpm validate:docs`, `pnpm governance:audit` | exit 0 (564 governance tests) |

Mutants killed: audit link disabled, approval check removed, acceptance holder check, identity lifecycle filter, idempotency hash, kernel acceptance, self-issuance, row lock, plus earlier SQL mutants.

## 9. Open blockers and decisions

External or not done:
1. Runtime read grants to the identity tables.
2. Grant activation not run (Windows `pnpm` spawn); the registry's DML privileges were only emulated.
3. Credential invalidation or rotation. The repo-known test password remains in frozen migration `0095` and git history, covering roughly 45 Entra staging accounts. Other fixtures (`tests/fixtures/test-users.ts`, `scripts/seed-zonga-auth-accounts.mjs`) are unchanged.
4. Unknown callers of the Django auth webhook and consumers of the Whop metadata.
5. Staging clone qualification of the two additions.
6. Full Django-lineage plus authority install run.
7. Institutional adoption of issuance rules with real instruments; until then the kernel issues nothing.
8. `union_rep_id` to principal mapping.
9. Source for case unit/territory and respondents; financial workflow actors; common review subject.
10. Decision: may a creator read their own privileged (legal-implications) case without an explicit privileged relationship? The kernel currently denies.
11. Phase 2 route migration. Not started.

## 10. Constraints honoured

No push, merge or rebase of any persona branch; no other worktree modified; no deployment; no PROVEN or operational claims.

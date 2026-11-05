# UE-INSTITUTIONAL-CONVERGENCE-2.1 — Phase 0 Register

Scope: repository authority, source preservation, collision and semantic-conflict register.
Method: read-only. `git merge-tree --write-tree` for pairwise conflicts (writes no working tree), `git grep` against each commit, `git worktree list`, `gh pr list`, `git ls-remote`.
Nothing was merged, cherry-picked, reset, rebased or pushed. No other worktree was modified.
Proof class for everything below: **SOURCE_INSPECTED**. No runtime, database or browser verification was performed.

Baseline: `0c994b968` (`main` and `origin/main` both equal it; all six candidates branch from it).

## 1. Verified candidate heads

| Persona | Claimed | Verified full SHA | Branch | Ahead of baseline | Files changed | Uncommitted |
|---|---|---|---|---|---|---|
| Member 2.1 | `a8cb15f91` | `a8cb15f91be3359c9f468edc3a83aaadccc35c04` | `agents/local-ue-navigation-validation` | 4 | 98 | 1 untracked: `apps/union-eyes/AGENTS.md` |
| Representative 2.2 | `a0e7753fd` | `a0e7753fdfc43f4fd3fcc7c39a69d6c68b845407` | `agents/pasted-text-processing-7ac45129` | 3 | 78 | none |
| Senior Representative 2.1 | `94126e853` | `94126e8537062ec43b4736397b073f656cc0e271` | `agents/frozen-senior-representative-architecture` | 3 | 46 | none |
| Officer / Executive 2.1 | `638817da` | `638817da223b2434b68f57334654f00c7b6ea28c` | `agents/union-eyes-officer-executive-2-1-freeze` | 1 | 51 | none |
| Financial Officer 2.1 | `7ba993a31` | `7ba993a318425c94820bc20ad07a6821302aca25` | `agents/union-eyes-financial-officer-freeze` | 2 | 68 | none |
| Governance Officer 2.1 | `4c0c95e5f` | `4c0c95e5f4b40b2c8c0a864d663cb5c28c7efebf` | `agents/frozen-governance-officer-21-architecture` | 2 (+ audit fix, see §6) | 39 | none at verification |
| Financial (earlier) | `ee9ecbb51` | `ee9ecbb5100497b2bbefa9e06b276d3c7d31ae80` | ancestor of the Financial branch | — | — | — |

All reported SHAs match actual heads. The Financial earlier commit is an ancestor of its final head, not a separate candidate.

### Other refs
- `agents/workaid-prep-20261023` (`541effda5`, worktree `pasted-text-processing`): **not one of the six**. Merge base `38a824918`, 4 commits, 184 files, including overlap with Member/Rep/Executive navigation files. Treat as a seventh candidate for the WorkAid phase; not reconciled here.
- `agents/pasted-text-processing` (`38a824918`): branch with no commits beyond its merge base.
- `origin/fix/ue-canonical-case-authorization-20261023` (`c74552366`): already an ancestor of the baseline (0 ahead, 14 behind). Not a pending candidate.
- Open PRs on `anungis437/nzila-os`: **none**.
- Detached worktrees (`~/.codex/worktrees/*`, `nzila-os.archive/...`): not candidates; left untouched.

### Preservation risk
**None of the six candidate branches exist on the remote.** All six are local branches in local worktrees only. They are preserved by their branch refs, but a lost disk loses them. Recommended (not performed, because it is an external action): push each to a `preserve/` ref or create a bundle. Needs owner approval.

## 2. Textual collision register (file-level)

Files changed by two or more candidates, excluding generated `tooling/repo-inventory/output/*` (changed by all six; regenerate, never hand-merge):

| File | Candidates |
|---|---|
| `app/api/documents/[id]/download/route.ts`, `documents/repository/route.ts`, `documents/repository/[id]/route.ts`, `search/universal/route.ts` | member, rep, senior |
| `app/api/grievances/route.ts`, `grievances/[id]/{route,access,documents,intelligence,related-documents}/route.ts` and 5 matching tests | rep, senior |
| `lib/dashboard/role-experience.ts`, `lib/dashboard/__tests__/{role-experience,dual-nav-honesty}.test.ts`, `e2e/helpers/role-fixtures.ts`, `components/__tests__/sidebar.test.tsx` | exec, member, rep (+ workaid) |
| `lib/dashboard/dual-nav-honesty.ts` | exec, member (+ workaid) |
| `app/api/finance/dashboard/route.ts`, `finance/exports/route.ts` | exec, fin |
| `lib/reality/capability-registry.ts` | fin, gov, rep |
| `messages/{en,fr}.json` | all six (+ workaid) |
| `messages/{en-CA,fr-CA}.json` | exec, fin, member, rep |
| `messages/{it,pt}.json` | exec, member, rep |

### Pairwise merge result (`git merge-tree`)

| Pair | Conflicted source files (excl. inventory) |
|---|---|
| rep × senior | **14** (all grievance/document/search routes and tests) |
| member × senior | **4** (documents download/repository, search) |
| member × rep | 1 (`dual-nav-honesty.test.ts`) |
| exec × member | 2 (`dual-nav-honesty.{ts,test.ts}`) |
| exec × rep | 1 (`dual-nav-honesty.test.ts`) |
| fin × gov, fin × rep, gov × rep | 1 each (`capability-registry.ts`; append-only, mechanical) |
| exec × fin, exec × gov, exec × senior, gov × senior, fin × senior, fin × member, gov × member | no source conflicts |

Inventory-output conflicts occur in every pair with any other candidate and are generated artifacts.

**A clean pairwise textual merge does not imply a safe merge.** See `exec × fin` below.

## 3. Semantic (authorization-policy) conflict register

Counts are files in `apps/union-eyes/app` + `lib` containing the token, at each head. Baseline in the last column.

| Token | member | rep | senior | exec | fin | gov | baseline |
|---|---|---|---|---|---|---|---|
| `case_read_any` | 6 | **15** | 3 | 3 | 3 | 3 | 3 |
| `isStewardPlus` | **17** | 16 | **7** | 15 | 15 | 15 | 15 |
| `.catch(() => undefined)` | 3 | 3 | 3 | 3 | 4 | 8 → 3 after fix | 3 |

| ID | Conflict | Evidence | Resolution owner |
|---|---|---|---|
| S1 | **Supervisory read model.** Rep adds `case_read_any` to 15 files; Senior removes seniority-based access (`isStewardPlus` 15→7). The same routes are conflicted textually (14 files) and the policies are opposed. | counts above; rep × senior conflict list | Integration: one mandate-aware case policy. `case_read_any` must not override recusal, privilege or case confidentiality. |
| S2 | **Member document helper may restore steward-wide access.** Member raises `isStewardPlus` use to 17 and conflicts with Senior in 4 document/search routes. | counts; member × senior | Integration: explicit case relationship wins. |
| S3 | **Finance gate, `exec` × `fin`.** Both edit `finance/dashboard` and `finance/exports` with **no textual conflict**. At baseline both are `withMinRole('officer')`. Executive raises the gate to `withMinRole('secretary_treasurer')` (and adds `secretary_treasurer` in 13 finance route files). Financial leaves the gate at `officer` and changes the handler. A blind merge silently combines both. | route heads at the three SHAs | Integration: replace role-minimum gates with separated financial visibility / initiation / approval / execution / oversight authority. |
| S3a | `withMinRole` is hierarchy-based, so `secretary_treasurer` (110) also admits `admin` (140), `president` (130), `vice_president` (120) and `national_officer` (150). This violates "no role title independently overrides resource-specific authority". | `ROLE_HIERARCHY` in `lib/api-auth-guard.ts` | Integration. |
| S4 | **Platform roles in the customer governance experience.** `compliance_manager` and `security_manager` are in `GOVERNANCE_ROLES` at **every** head, unchanged. | `role-experience.ts` lines 30-31 at all six heads | Executive/navigation owner. |
| S5 | **`GOVERNANCE_SYSTEM_ROLES`** (Class-B / reserved-matter allow-list) still contains customer-federation roles `clc_staff`, `clc_executive` at every head. | `lib/api-auth-guard.ts` | Platform authz owner decision. |
| S6 | **Durable audit.** Governance added 5 suppressed audit catches (8 vs 3). These defeated `auditLog`'s deliberate fail-closed behaviour in canonical mode. **Corrected in §6.** The remaining 3 baseline catches and Financial's 4th were not reviewed. | `lib/audit-logger.ts`; route sources | Integration (audit transactionality is still not proven; §6). |
| S7 | **Representative transition-reason disclosure** (reported, free-text reason visible in a member-visible event). | Not reproduced here: a grep for transition-reason tokens in `app/api/grievances` and `app/api/cases` found nothing at any head, so the exact location is unconfirmed. | Representative owner to give the file/line; treat as open. **NOT_PROVEN either way.** |
| S8 | **Privacy rights/incident engine** is absent: Member and Governance privacy workflows are 501 or incomplete. | Governance disposition §7 | Integration Phase 3. |
| S9 | **Secret-ballot and approval integrity gaps:** `isAnonymous=false` ballots persist the member id; no DB uniqueness for (chain, approver) or one chain per policy; no independent certification. | Governance disposition §8, §9 | Integration Phase 3, governed migration. |
| S10 | **Navigation vs authority.** `role-experience.ts` (exec/member/rep) controls landing and sidebar only; `canAccessDashboardPath` is presentational, and a stricter role check exists only for `/dashboard/audits`. Navigation convergence must not widen route access. | `role-experience.ts` | Navigation owner. |

## 4. What this register does not establish
- No candidate was built, type-checked or tested **as a merged tree**. Each branch's own checks are agent-reported and were not independently re-run here (the Governance branch's were run in this session).
- Pairwise conflict counts do not predict the result of a six-way merge.
- Semantic counts are token presence, not an authorization analysis. They show where to look, not that a path is exploitable.
- No RLS, PostgreSQL, concurrency, browser, EN/FR, mobile or WCAG evidence exists for any branch.

## 5. Proposed integration order (for Phase 1, not executed)
1. Land the authority kernel (role + mandate + resource relationship + recusal + expiry) as a new module with its own tests, **before** merging any route changes.
2. Merge **Senior** first as the strictest confidentiality baseline, then reconcile **Rep** onto it route-by-route (14 files), replacing `case_read_any` with kernel checks.
3. Reconcile **Member** document/search routes onto the same kernel (4 files).
4. Merge **Governance** and **Financial** (no source conflicts with the above; registry and messages are append-only) after replacing the finance role-minimum gates (S3/S3a).
5. Merge **Executive** navigation last, with `role-experience.ts` resolved once (S4) and `dual-nav-honesty` reconciled (3 candidates).
6. Regenerate `tooling/repo-inventory/output/*` once at the end; never hand-merge.
7. Treat `agents/workaid-prep-20261023` as a separate input to the WorkAid phase.

## 6. Governance branch update made during Phase 0

Audit finding S6 was in Governance's own code, so it was corrected rather than registered:
- Removed `.catch(() => undefined)` from every governance mutation and denial audit (approvals, policy lifecycle PATCH, class-B vote).
- Class-B vote audit now runs **inside** the system transaction, so an audit failure aborts the decision instead of leaving it unaudited.
- Replaced the non-UUID `'platform'` fallback audit scope (which would have failed canonical persistence and then been silently swallowed) with `resolveAuditOrganization`; a governance action with no audit scope is refused with 403.
- Tests added for audit-failure propagation and missing audit scope.

Still **NOT_PROVEN**: that the audit write and the business write are atomic. The audit uses a separate tenant-RLS connection and the mutation uses the system connection, so a crash between them can leave an audit row without the mutation (the safe direction) but there is no two-phase guarantee. The mock tests prove error propagation only. This needs the shared transactional audit design in Phase 1 and a real PostgreSQL test in Phase 5.

## 7. Verdicts

- Local integration baseline: **NO-GO** (no reconciled tree exists).
- Staging: **NO-GO**.
- Production: **NO-GO**.

# UE Authority Kernel — Phase 1 Exit Qualification

**Mission:** `UE-INSTITUTIONAL-AUTHORITY-PHASE-1-EXIT`
**Branch:** `agents/ue-authority-kernel` (base `0c994b968`). Supersedes the verdict in `UE-AUTHORITY-KERNEL-PHASE-1-EVIDENCE.md`.
**Staging / production:** NO-GO. **Six-persona merge:** not started.
**Superseded by:** [UE-AUTHORITY-SOURCE-CLOSURE-EVIDENCE.md](./UE-AUTHORITY-SOURCE-CLOSURE-EVIDENCE.md) (identity source, case/finance sources, revised classification, counsel boundary).

## 1. Verdict

**Phase 1 exit: FAIL.** The authority machinery is now locally and combined-schema qualified, but the exit rule is
"do not claim PASS while runtime authority, classified disclosure, migration replay, grants or institutional authorization
remain unproven". Four of those are now proven locally; the resource facts that most decisions rest on are still missing or
not in the approved lineage, so several decisions deny by design rather than allow on evidence.

| Exit gate | Status | Basis |
|---|---|---|
| Actor derivation / impersonation | PASS (local, PG15/16) | §3 |
| Identity and membership under the runtime role | PARTIAL | Cross-principal reads proven through the bounded `union_eyes_system` reader. Provider binding table is not in the approved lineage. |
| Mandate lifecycle | PASS (local, PG15/16) | Adoption ceremony and issuance, §5 |
| Classified case/document access | PASS (local, PG15/16) | §6 |
| Resource facts | FAIL (fail-closed) | §4 |
| Transactional audit | PASS (local, PG15/16, Django verifier) | unchanged, re-run |
| Migration and grants | PASS on a fresh Django-migrated + approved-bootstrap database, PG15 and PG16 | §7. Additions remain UNQUALIFIED on a staging clone. |
| Release qualification | NOT STARTED | external |

## 2. Heads and worktree status

| Branch | Head | Clean |
|---|---|---|
| `agents/ue-authority-kernel` | see `git log` (this document's commit is the last) | yes |
| `agents/ue-remove-clerk` | `f825b61fd` | yes |
| `agents/frozen-governance-officer-21-architecture` | `4d86c3758` | yes |
| member / representative / senior / executive / financial / WorkAid candidates | `a8cb15f91` / `a0e7753fd` / `94126e853` / `638817da2` / `7ba993a31` / `541effda5` | untouched (member has a pre-existing untracked `AGENTS.md`) |

Kernel changes since the previous checkpoint `1c7c2f6a9`: `49bb8b536` (code) plus this document. Nothing pushed or merged.

## 3. P0 defect disposition — actor impersonation

| Finding | Disposition |
|---|---|
| `recordCounselAcceptance` accepted a caller-supplied `actor` | **Fixed.** No actor parameter. The acceptor is the transaction's authenticated principal, must be vouched for by an injected counsel identity verifier, and cannot be the member or the union referrer. With no verifier configured it refuses (`COUNSEL_NOT_VERIFIABLE`). The counsel-side authenticator itself is **not built** (owner: WorkAid/counsel interface). |
| Counsel-issued disclosures could be authored by a union officer naming counsel | **Fixed**, same verifier and session binding; the database independently refuses a forged `issued_by`. |
| Other mutations took actors as parameters | **Fixed.** Every writer and the issuance evaluator bind the claimed actor to `app.current_user_id` (`bindSessionActor`); `enforceAuthority` denies unless the decided principal is the session principal (`PRINCIPAL_MISMATCH` / `PRINCIPAL_NOT_AUTHENTICATED`). |
| Database-level bypass | **Fixed.** Trigger `ue_authority_guard_actor` on all 13 actor-bearing tables refuses an actor column that is not the session principal, and refuses to run with no session, even for an administrator. Terminal columns (`revoked_by`, `lifted_by`, `counsel_accepted_by`) are bound on UPDATE. |
| Rule activation took a list of approver names from the activator | **Fixed.** Adoption is now a recorded ceremony: `requestRuleAdoption` pins the real instrument and opens a two-approver request with named adopters; the approvers vote in their own sessions; `activateIssuanceRule` derives `approved_by` from the recorded votes, and the database rejects any `approved_by` that is not exactly the recorded approvers (`RULE_ADOPTION_NOT_APPROVED`). One live adoption per rule (unique index). |

Tests: `authority-kernel-actor.pglite.test.ts` (22 tests: every writer, DB layer per table, no-session, terminal columns), counsel impersonation cases in the resources suite, adoption-forgery cases in the lifecycle suite.

## 4. Resource facts and coverage

Nothing below is invented or inferred from role titles. "Blocked" means the kernel denies.

| Resource / operation | Authoritative source | State |
|---|---|---|
| Case existence, creator, classification (`has_legal_implications`, `is_confidential`) | `public.grievances` | Sourced |
| Case collaborators and their rights | `grievance_case_access_assignments` (incl. `access_role`) | Sourced |
| Case unit / territory | none | **Blocked** — scoped supervisory mandates cannot match; resource-id scoped mandates can |
| Respondents / adverse parties on a case | none | **Blocked** — never inferred |
| Representative (`union_rep_id` uuid) → principal mapping | none verified | **Blocked** — owner/assignee needs an explicit backfill |
| Documents, labels, privilege, case link | `documents`, `document_links` (grievance links only) | Sourced |
| Payments amount / currency / payer | **deployed `payments` is a 4-column stub** (`id`, `created_at`, `updated_at`, `organization_id`); the kernel's source columns do not exist | **Blocked** — every `finance:*` decision denies in the combined-schema suite |
| Financial workflow actors | kernel-owned step ledger (needs the payment amount above to register) | Blocked behind the row above |
| Governance review subject | kernel-owned `ue_authority_reviews` (no common subject exists) | Kernel-owned |
| Provider identity → principal | `public.platform_identity_bindings` — **not created by the approved lineage** (defined only in an unapplied `packages/db` artifact) | **Blocked** — resolution refuses |
| Membership | `user_management.organization_users` + `users` | Sourced, but see §7 for the read path |
| Member financial record | none keyed to a principal | Not built |
| Privacy mandate kind and policy | none | Not built |
| WorkAid counsel side | not present | Not built |

Operation coverage by frozen persona is in the compatibility contract (`UE-AUTHORITY-KERNEL-PHASE-1-EVIDENCE.md` §persona mapping); the rows above are what changed.

## 5. Mandate issuance and approval proof

Default issuance templates are drafted INACTIVE. Activation requires a real instrument, a satisfied two-approver `rule_adoption` request, approvers who are adopters and not the drafter, and one live request per rule. Issuance then requires an active rule, the rule's ceilings, a satisfied approval bound to the exact instrument id (used once, issuer and holder excluded), and holder acceptance where the rule requires it. Proven on PGlite and, through the real ceremony, on the deployed schema as the runtime role (PG15 and PG16). **Institutions have not adopted any rule; the kernel issues nothing in a real tenant until they do.**

## 6. Classified information-access matrix

Creating a case no longer opens every document attached to it, and a privileged classification no longer erases a member's own submissions.

| Information class (from the document's own columns) | Required action | Creator / member | Co-handler (`secondary_lro`, `reviewer`) | Read-only collaborator | Supervisor / executive | Stranger / other tenant |
|---|---|---|---|---|---|---|
| Member's OWN non-privileged submission (uploader = principal = case creator/represented member) | `case:read_own_submission` | allow (even on a privileged case) | by case relationship | by case relationship | deny | deny |
| `public_internal` | `case:read` | allow | allow | allow | deny without a mandate | deny |
| `team_confidential`, `lro_confidential`, `case_restricted`, unknown or absent label | `case:read_internal` | **deny** | allow | deny | deny without a mandate | deny |
| Privileged (`contains_legal_privilege`, `privileged`, `highly_sensitive`) | `case:read_privileged` | deny (own upload flagged privileged included) | only with an explicit privileged-access grant | deny | deny | deny |
| Counsel-controlled (accepted WorkAid referral) | not reachable | deny | deny | deny | deny | deny |

Own-submission authority is verified by the loader from `documents.uploaded_by`, the single grievance link and the privilege flags; a caller-supplied `documentId` is only a request. Recusal, adverse-party, revocation, expiry, suspension and foreign tenant all remove it. Tests: 13 PGlite document cases, 5 pure-kernel cases, and a deployed-table case on PG15/16.

**Decisions taken here, for institutional confirmation:** `secondary_lro` and `reviewer` collaborators read the internal file (source: `access_role`); `public_internal` is treated as visible to anyone with live case access; third-party restricted information has no distinct source column today, so it falls under the internal class.

## 7. Database, RLS and grant qualification

Procedure (fresh disposable database each run, because authority records are append-only):

1. `python manage.py migrate` (full Django lineage) in `apps/union-eyes/backend`.
2. `DATABASE_URL=… QA_TEST_ENV=true node tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs` (approved bootstrap, including exact storage-authority grant activation).
3. `UE_AUTHORITY_COMBINED_URL=<admin url> npx vitest run db/__tests__/authority-kernel-combined.postgres.test.ts`.

Results, PostgreSQL 16.15 and 15.19: bootstrap completes (38 ledger rows, grants activated); combined suite 10/10 on each; storage and Django-audit suites 15/15 on each.

- **Grant activation defect repaired.** `loadAuthorityManifest` spawned `pnpm` without a shell, which fails on Windows. It now uses `pnpm.cmd` through a shell on `win32` (a Node deprecation warning about shell argument concatenation is emitted; the arguments are fixed, repository-owned paths). This is a tooling fix, not a bypass: the unchanged approved bootstrap now completes.
- **Live runtime privileges equal the registry exactly** for all 14 relations, never DELETE or TRUNCATE; the runtime role cannot disable triggers; FORCE RLS on all 14; runtime is not superuser and does not bypass RLS.
- **Finding, runtime identity reads.** In the deployed schema the runtime role sees only its own row of `user_management.users` / `organization_users` (self-select RLS), and the catalog remediation revokes runtime EXECUTE on SECURITY DEFINER helpers. So a decision about another principal (approver, holder, assignee) cannot be answered on the runtime connection. Resolution: `membershipSourceVia(reader)` reads through a pool-style executor connected as the bounded, SELECT-only `union_eyes_system` role. No migration or grant change. **Deployment must wire that executor.** Proven: runtime sees one row, system reader sees all three, the reader cannot write identity tables or read authority tables, and a foreign tenant stays empty.
- **Migration bytes changed before any deployment:** `0013` is now sha256 `f853a13f…6e50` (history: `cf53ce45…` → `6cb84c16…` → `f853a13f…`); `0020` unchanged `45873e54…5785`. Both remain registered **UNQUALIFIED**; the lineage verifier reports no violations and the approved 20/16 hashes are untouched. Staging clone qualification has not been run.
- Not re-run on the full persona branches: no persona branch contains these migrations.

## 8. Canonical audit integrity

Unchanged mechanism, re-run after the migration change: deferred commit trigger, rollback both directions, forged/foreign audit rows, backend-kill retry, chain under concurrency, Django `verify_audit_chain` accepting every bridge row and detecting tampering (PG15 and PG16). Known pre-existing weakness: the runtime role can UPDATE and DELETE `public.audit_logs`; not weakened further. Reconciliation on the deployed schema returns no gaps.

## 9. Test and static results (local)

| Check | Result |
|---|---|
| `lib/authority` + all `db` (default) | 1738 passed, 82 skipped (real-PG suites need env), 0 failed |
| Combined deployed-schema suite | 10/10 on PG16 and PG15 |
| Storage + Django-audit PG suites | 15/15 on PG16 and PG15 |
| `tsc --noEmit` / eslint on authority code and tests | clean |
| Node: lineage, clone-qualification, historical-lineage tests | 84 pass, 0 fail, 5 skipped |

## 10. Identity-containment dependencies (Clerk branch `f825b61fd`)

Webhook alias and Whop dual-metadata contracts remain as recorded in the cleanup branch's blockers document. **External consumers are unverifiable from this repository.** Seed: reproduced on PG15 and PG16 (idempotent). Credential rotation of the roughly 45 staging Entra accounts is **not done**; secret values are never printed.

## 11. External blockers and owners

| # | Blocker | Owner |
|---|---|---|
| 1 | Wire the `union_eyes_system` identity reader into the deployment's authority dependencies | Platform engineering |
| 2 | Provider binding table: apply the reviewed `platform_identity_bindings` migration (or document the substitute) through governed migration approval | Platform / identity |
| 3 | Payments source: deployed `payments` has no amount, currency or payer | Finance domain owner |
| 4 | Case unit/territory, respondents, `union_rep_id` → principal mapping | Grievance domain owner |
| 5 | Counsel-side identity verifier and acceptance flow | WorkAid / counsel interface |
| 6 | Staging clone qualification of `0013` and `0020` | Release engineering |
| 7 | Institutional adoption of issuance rules with real instruments; confirm the §6 decisions | Each institution's governance body |
| 8 | Rotate or disable the repo-known test password accounts; record evidence | Identity operations |
| 9 | Confirm webhook and Whop consumers | Integration owners |
| 10 | Privacy mandate kind and policy; member financial record source | Privacy / finance |
| 11 | Harden `public.audit_logs` runtime UPDATE/DELETE | Platform security |

## 12. Recommendation

Do **not** begin the full six-persona integration. It can begin in a limited form without exposing institutional or privileged information for routes whose facts are sourced and now proven: case read and document read (classified), mandate issuance and approval, delegation, recusal and case assignment, provided blocker 1 is wired first. Finance, provider-resolved sessions, unit/territory-scoped supervision, respondent-based conflicts and any WorkAid counsel path must stay blocked until blockers 2–5 close. Staging and production remain NO-GO.

# Phase 0B.1 — Closure Report

**Classification.** ⚠️ **AMBER — ARCHITECTURE DECISION REQUIRED.**  
**Sole approver of the outstanding decision.** Aubert.  
**Date.** 2026-07-23.  
**Historical branch (preserved).** `fix/union-eyes-reality-remediation`
@ `7a1c90ab3` on `origin`.  
**Clean branch (created, empty of Phase 0B commits).**
`fix/union-eyes-phase0b-clean` @ `4d6f63511` — worktree at
`../nzila-automation-phase0b-clean`.

---

## 1. Purpose

Phase 0B.1 executed a bounded scope-recovery and two-lineage decision
gate after the 5-commit Phase 0B push
(`4d6f63511..7a1c90ab3`, 5 commits, 373 files) was identified as carrying
governance defects that made GREEN closure impossible:

- a 255-file repo-wide test-infra sweep conflated with Phase 0B code;
- a resolver with no production call-sites;
- a KPI TypeScript schema change with no companion SQL migration;
- a validation summary that under-reported commit count and omitted
  disclosure that lefthook was bypassed on every Phase 0B commit;
- a 111-`public.*` table collision between the platform Drizzle lineage
  and the Union Eyes Django lineage that had never been catalogued.

Phase 0B.1 did not resolve those defects (which requires an architecture
decision reserved for Aubert). It **reconciled evidence with reality**
and packaged the material needed for Aubert to select an option and for a
future clean-branch reconstruction to execute the selection safely.

---

## 2. What Phase 0B.1 produced

| # | Deliverable | Path |
| --- | --- | --- |
| 1 | Per-commit disposition (MD + JSON) classifying each of the 5 pushed commits as Direct / Supporting / Unrelated per file, with clean-branch action | [phase-0b1/phase-0b-commit-disposition.md](phase-0b-commit-disposition.md) · [phase-0b1/phase-0b-commit-disposition.json](phase-0b-commit-disposition.json) |
| 2 | Per-commit file inventories | [phase-0b1/commit-1e5a6bd94-files.txt](commit-1e5a6bd94-files.txt) · [phase-0b1/commit-511c9c1cb-files.txt](commit-511c9c1cb-files.txt) · [phase-0b1/commit-c40a3e33a-files.txt](commit-c40a3e33a-files.txt) · [phase-0b1/commit-896a18e0c-files.txt](commit-896a18e0c-files.txt) · [phase-0b1/commit-7a1c90ab3-files.txt](commit-7a1c90ab3-files.txt) |
| 3 | Clean-branch provenance policy + extraction plan | [phase-0b1/phase-0b-clean-branch-provenance.md](phase-0b-clean-branch-provenance.md) |
| 4 | Test-infra separation policy for the clean branch | [phase-0b1/phase-0b-test-infra-separation.md](phase-0b-test-infra-separation.md) |
| 5 | 111-row two-lineage collision inventory (MD + JSON) | [phase-0b1/phase-0b-table-collision-inventory.md](phase-0b-table-collision-inventory.md) · [phase-0b1/phase-0b-table-collision-inventory.json](phase-0b-table-collision-inventory.json) |
| 6 | Collision inventory generator script | [scripts/audit/build-phase0b1-collision-inventory.py](../../../../scripts/audit/build-phase0b1-collision-inventory.py) |
| 7 | Two-lineage architecture options + recommendation-pending-approval | [phase-0b1/phase-0b-lineage-architecture-decision.md](phase-0b-lineage-architecture-decision.md) |
| 8 | Conditional two-lineage migration plan (per option) | [phase-0b1/phase-0b-lineage-migration-plan.md](phase-0b-lineage-migration-plan.md) |
| 9 | Organization resolver integration proof (gap analysis) | [phase-0b1/organization-resolver-integration-proof.md](organization-resolver-integration-proof.md) |
| 10 | KPI DB migration proof (gap analysis) | [phase-0b1/kpi-database-migration-proof.md](kpi-database-migration-proof.md) |
| 11 | Corrected Phase 0B validation summary (amendment header, original preserved as historical) | [cupe-national-phase-0/phase-0b-validation-summary.md](../phase-0b-validation-summary.md) |
| 12 | Phase ledger amendment | [cupe-national-phase-ledger.md](../../cupe-national-phase-ledger.md) |
| 13 | This closure report | [phase-0b1/phase-0b1-closure.md](phase-0b1-closure.md) |

---

## 3. The 25-item final report

1. **Phase 0B is NOT closed GREEN.** Closure was not attempted in Phase 0B.1.
2. **Phase 0B.1 is closed AMBER — ARCHITECTURE DECISION REQUIRED.**
3. **Sole approver of the outstanding decision is Aubert.**
4. **The 5 pushed Phase 0B commits are preserved intact on the historical branch.** No commit was rewritten, deleted, or force-pushed.
5. **A separate clean worktree was created** at `../nzila-automation-phase0b-clean` on `fix/union-eyes-phase0b-clean` @ `4d6f63511` for future reconstruction of a reviewable Phase 0B change set.
6. **Commit `1e5a6bd94` (255-file test-infra sweep) is classified `Drop` for the clean branch.** It belongs on a future `chore/test-infrastructure-stabilization` branch — out of scope for Phase 0B.1.
7. **Commit `511c9c1cb` (migration 0038 + org-model decision + dependency map) is classified `Retain All` for the clean branch,** with migration 0038 wording subject to review once the architecture option is selected.
8. **Commit `c40a3e33a` (resolver + resolver tests) is classified `Retain + require companion production-integration commit`** because no non-test caller of `getPlatformTenantId` exists in `apps/union-eyes/**/*.ts`.
9. **Commit `896a18e0c` (ue-cognition schema.ts uuid→text) is classified `Retain + require companion DB migration commit`** because no `packages/db/drizzle/*.sql` file creates any of the 6 tables.
10. **Commit `7a1c90ab3` (112-file evidence + docs sweep) is classified `Retain evidence subset only`** by explicit-path enumeration. The `docs/institutional-engineering`, `docs/nzila`, `docs/ops`, `reports/*.md` / `reports/*.json` governance outputs, and `ops/outputs` are explicitly excluded from the clean branch and will be regenerated on demand.
11. **Independent collision enumeration (111 `public.<name>` tables) confirms the two-lineage governance defect first surfaced during original Phase 0B execution.**
12. **The `SHARED_INTENT` cluster is exactly `organizations` + `orgs`.** Migration 0038's Outcome C contract (`organizations.platform_tenant_id = organizations.id = orgs.id`) correctly addresses this cluster.
13. **The `DJANGO_INTERNAL` cluster is 9 tables (`auth_*`, `django_*`).** These MUST remain Django-owned under any architecture option.
14. **The `REQUIRES_DECISION` cluster is 100 tables** whose ownership is not resolvable from source inspection alone. Aubert selects the option; the option determines per-table ownership.
15. **Four architecture options are presented** — A (single owner), B (dual schema), C (dual DB), D (governed hybrid). Option D is analytically recommended but no option is chosen in Phase 0B.1.
16. **A conditional migration plan is published** that branches on the selected option so execution can begin immediately after Aubert's decision.
17. **The platform-tenant resolver's integration gap is enumerated** — at least 31 Union Eyes API routes must be wired via `resolvePlatformTenantIdOrThrow(...)` before the resolver graduates from "inert scaffolding" to a Phase 0B production artifact.
18. **The KPI DB migration gap is enumerated** — the required migration's table×column matrix, indexing plan, and three-state idempotency validation are documented; the migration file itself is deferred until after the architecture decision.
19. **The Phase 0B validation summary is corrected via an amendment header** at the top of the file. The original 2026-04-25 "(final)" text is preserved verbatim below the header, labelled *historical, superseded*, per the "preserve superseded findings" mandate.
20. **The lefthook-bypass posture on the 5 pushed Phase 0B commits is disclosed** using the mandated wording: "Lefthook was bypassed for commit creation after long-running or stuck hook processes. Equivalent validation commands were executed separately and are individually recorded. This is not represented as a successful pre-commit-hook execution."
21. **Phase 0B.1's own commits on the historical branch run lefthook.** No `--no-verify`, no `$env:LEFTHOOK = "0"`.
22. **The phase ledger is amended** with a Phase 0B.1 entry recording the AMBER classification, the sole approver, the deliverables, and the non-actions.
23. **No environment was deployed** during Phase 0B.1 from either branch.
24. **No CUPE scenario was graduated** during Phase 0B.1.
25. **No downstream phase was started.** Phase 0C, Phase 0D, and Phase 1 remain unauthorized.

---

## 4. What is required to advance

Aubert must:

1. Read [phase-0b1/phase-0b-lineage-architecture-decision.md](phase-0b-lineage-architecture-decision.md).
2. Select Option A, B, C, or D.
3. Record the selection in the "Decision record" section of that document.
4. Authorize the follow-up work: migration authoring per
   [phase-0b1/phase-0b-lineage-migration-plan.md](phase-0b-lineage-migration-plan.md);
   resolver integration per
   [phase-0b1/organization-resolver-integration-proof.md](organization-resolver-integration-proof.md);
   KPI migration per
   [phase-0b1/kpi-database-migration-proof.md](kpi-database-migration-proof.md);
   test-infra sweep on its own branch per
   [phase-0b1/phase-0b-test-infra-separation.md](phase-0b-test-infra-separation.md).

None of the above is executed in Phase 0B.1.

---

## 5. Hard stop

Phase 0B.1 ends here. Do not begin Phase 0C, Phase 0D, or Phase 1. Do
not deploy either branch. Do not attempt to close Phase 0B GREEN from
inside Phase 0B.1's scope.

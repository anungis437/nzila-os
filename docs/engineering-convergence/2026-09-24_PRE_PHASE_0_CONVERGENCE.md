# NZILA Engineering Estate Convergence

**Status:** IN PROGRESS - inspection and classification
**Started:** 2026-09-24
**Authoritative starting baseline:** `origin/main` at
`cd94a9b58acc772ddaab3e894c70fe153e35e7e8`

This is the working Development Convergence Ledger for Pre-Phase 0. It is not a
SaaS-readiness declaration and it does not authorize production promotion.

## Current gate

```text
ENGINEERING_ESTATE_ACCOUNTED = IN_PROGRESS
UNACCOUNTED_DEVELOPMENT != 0
OPEN_PR_DISPOSITION = IN_PROGRESS
LOCAL_WORKTREE_DISPOSITION = IN_PROGRESS
MIGRATION_LINEAGE = RECONCILIATION_REQUIRED
AUTHORITY_CONVERGENCE = RECONCILIATION_REQUIRED
CIVIC_DOCTRINE_NON_REGRESSION = PASS_ON_STARTING_MAIN
MAIN_REQUIRED_CI = RUNNING
SAAS_ACTIVATION = PAUSED
```

The starting `main` check suite had 85 reported checks at inspection time:
77 successful, 4 skipped, 0 failed, and 4 still running. A terminal green
result must be recorded before this gate can close.

## Estate census

| Surface | Count | Notes |
| --- | ---: | --- |
| Local branches | 38 | Includes stale merged branches and local-only work |
| Remote refs after fetch | 33 | Every non-main ref maps to a PR or known retained branch |
| Worktrees | 26 | 10 dirty, 16 clean |
| Stashes | 27 | Preserved; oldest is 2026-02-22 |
| Open PRs | 22 | 5 human lanes and 17 Dependabot PRs |
| Open human PRs | 5 | #795, #796, #797, #799, #808 |

The shared source checkout at `C:/APPS/nzila-ue-authoritative-baseline` remains
untouched and dirty on `fix/ci-workbook-memory-holders-redteam-ops-snapshot`.
This ledger is maintained from an isolated worktree based on the exact starting
`origin/main` SHA.

## Canonical architecture decisions

### Schema ownership

The current repository doctrine is multi-lineage, not Django-only:

```text
CANONICAL RUNTIME SCHEMA
  = governed Django canonical/business lineage
  + governed platform SQL lineage
  + scoped authority/RLS lineage
```

Django remains the sole schema owner for Django-canonical entities. Drizzle is
a governed read projection for those entities, not a competing DDL authority.
Platform SQL may own tables that have no Django owner and are explicitly
classified as platform-owned.

This resolves the principal conflict between PRs #796 and #799:

- #796 is the canonical survivor for `organization_members`, `documents`, and
  `claims` ownership and Django migration changes.
- #799 platform migrations `0005_organization_members_deleted_at.sql` and
  `0006_documents_runtime_columns.sql` must not enter the converged lineage.
- #799 platform migrations `0001` through `0004` create 43 tables with no
  Django `db_table` overlap and remain candidates for the platform SQL lineage.
- #799 migration `0007_claim_updates_runtime_columns.sql` requires an explicit
  owner entry and revalidation. No Django `claim_updates` model was found.
- #799 runtime evidence remains SHA-bound historical evidence. It does not
  prove the current PR head or future converged head until regenerated.

### Platform-admin B-005

GitOps run `35952148762` deployed `e4602d3d02c650c19ae95299d9221e0b5caaada2`
and returned HTTP 200 for health, ready, and version probes. Its version-drift
step nevertheless reported:

```text
deployed=local
head=e4602d3d
drift score=0%
```

The workflow soft-failed that result. Therefore B-005 is not closed. The
two-file fix at `e9a87c48342c1655693ab68c5d9398974a507f84` remains a focused
rebase-and-complete lane. Platform-admin portfolio/readiness metadata must not
be reclassified until an exact-tip run proves version identity.

### CIVIC boundary

PR #810 is authoritative on the starting baseline. Untracked public CIVIC
routes under `apps/union-eyes/app/[locale]/civic/**` create a CIVIC product
surface outside the guarded `apps/civic` placeholder. They are not eligible for
integration while runtime authorization is false. They remain preserved as a
blocked lane pending explicit doctrine/product authorization or removal after
the convergence plan is approved.

## Development Convergence Ledger

### DEV-001 - Authoritative starting main

- Source: `origin/main`
- Head: `cd94a9b58acc772ddaab3e894c70fe153e35e7e8`
- Domains: PLATFORM, CI_GOVERNANCE, CIVIC_BOUNDARY
- Relationship: FOUNDATIONAL
- Disposition: `MERGE_CANDIDATE` as baseline only
- State: retained; no local `main` synchronization performed yet

### DEV-002 - B-005 platform-admin version truth

- Source: local `codex/b005-version-truth`
- Head: `e9a87c48342c1655693ab68c5d9398974a507f84`
- Files: root `Dockerfile` and one contract test
- Domains: PLATFORM, DEPLOYMENT, EVIDENCE
- Relationship: GATE_A_ENABLER
- Disposition: `REBASE_AND_COMPLETE`
- Required outcome: policy-compliant branch, exact-head CI, staging deploy,
  health/ready/version PASS, and version drift PASS

### DEV-003 - UE schema authority foundation

- Source: PR #796, `fix/ue-runtime-schema-authority-reconciliation`
- Head: `b30798326afbb1ad24b72b33b2be5f300bd6023c`
- Scope: 36 files, 9 commits
- Domains: UNION_EYES, DATA, AUTHORITY, RLS
- Relationship: GATE_A_BLOCKER
- Disposition: `REBASE_AND_COMPLETE`
- Rationale: establishes executable one-owner doctrine and Django migrations
  for Django-canonical entities; merges cleanly into starting main but requires
  exact-head validation

### DEV-004 - UE complete runtime-schema lineage

- Source: PR #799 plus superseded PR #797
- Heads: `3e9a0cf8431bf9c57333f48743f7cd0f851bd291` and
  `72c1125190b790a5b6f43def739f846cf1cdb726`
- Domains: UNION_EYES, DATA, RLS, DEPLOYMENT, EVIDENCE
- Relationship: GATE_A_BLOCKER
- Disposition: `REBASE_AND_COMPLETE`
- Canonical survivor: replacement of #799 built on DEV-003
- Preserve: platform SQL `0001-0004`, valid `0007` only after ownership
  adjudication, `0014` RLS closure after target validation, oracle, deterministic
  clean-room runner, snapshot lifecycle, unique runtime fixes, tests
- Remove: platform SQL `0005/0006`, fixes already present on main, stale generated
  reports, and any evidence claim not regenerated at the replacement head
- PR #797 final state: `CLOSED_SUPERSEDED` after replacement proof exists

### DEV-005 - Workbook/red-team CI precursor

- Source: PR #795 and shared checkout branch
- Head: `f75e0d6d0b9e1ea73b75632595e33c48197e343b`
- Domains: UNION_EYES, SECURITY, CI_GOVERNANCE
- Relationship: NON_BLOCKING after current-main equivalents
- Disposition: `SUPERSEDED_BY_MAIN` / `DUPLICATE`
- Proof still required: byte-level comparison for the two workbook test files
  that conflict with main before closure

### DEV-006 - Repository truth convergence

- Source: PR #808, `docs/truth-convergence`
- Head: `9b8aaa35602fcc94b4af92d94b3036a127ec0687`
- Domains: DOCUMENTATION, CI_GOVERNANCE, CIVIC_BOUNDARY
- Relationship: FOUNDATIONAL
- Disposition: `REBASE_AND_COMPLETE`
- Notes: clean synthetic merge into starting main; current failure is the
  owner-approved/approved-experiment label gate. Integrate after schema/code
  convergence, then regenerate truth surfaces and re-run #810 doctrine checks.

### DEV-007 - Local docs-convergence precursor

- Source: dirty `repository-convergence-task` worktree at `b78deef74`
- Domains: DOCUMENTATION
- Relationship: NON_BLOCKING
- Disposition: `DUPLICATE` of DEV-006, subject to final comparison of
  `PORTFOLIO_OVERVIEW.md`

### DEV-008 - Wave-1 staging fixture materializer

- Source: local `chore/ue-wave1-staging-fixtures`
- Head: `9549d6f7133bf3a011d697eda0494a86d9740065`
- Domains: UNION_EYES, DATA, EVIDENCE
- Relationship: GATE_A_ENABLER
- Disposition: `ABSORB_INTO_SAAS_PROGRAM`
- Constraint: synthetic acceptance fixtures only; hard-coded staging target must
  not be represented as real stakeholder onboarding

### DEV-009 - Unpublished Phase 0 commissioning bundle

- Source: dirty shared checkout
- Scope: snapshot publication/restore, schema oracle, Wave-1 probes, staging
  fixture tests, commissioning runbook, stakeholder packs, generated reports
- Domains: UNION_EYES, DATA, DEPLOYMENT, EVIDENCE, OPERATIONS
- Relationship: GATE_A_ENABLER
- Disposition: `CHERRY_PICK_COMPONENTS`
- Notes: local oracle differs from #799; workflow URL construction and evidence
  binding require reconciliation with DEV-004. Generated outputs are not source.

### DEV-010 - OCI methodology transparency surface

- Source: dirty shared checkout under the Union Eyes locale routes and ICRA UI
- Domains: UNION_EYES, DOCUMENTATION
- Relationship: NON_BLOCKING
- Disposition: `ABSORB_INTO_SAAS_PROGRAM`
- Notes: separate from the prohibited CIVIC route family; validate methodology
  copy against canonical OCI authority before integration

### DEV-011 - Unauthorized CIVIC public route surface

- Source: dirty shared checkout at `apps/union-eyes/app/[locale]/civic/**`
- Domains: CIVIC_BOUNDARY
- Relationship: GATE_A_BLOCKER for any attempted integration
- Disposition: `BLOCKED_DECISION`
- Reason: creates a public CIVIC product surface while #810 records runtime
  authorization as false; route location also exposes a guard coverage gap

### DEV-012 - ACR cleanup operator scripts

- Source: dirty shared checkout (`acr-*.ps1`, `acr-delete-list.txt`)
- Domains: OPERATIONS, DEPLOYMENT
- Relationship: OUT_OF_SCOPE
- Disposition: `EXPERIMENTAL_KEEP`
- Constraint: potentially destructive scripts; do not execute during
  convergence and do not commit generated deletion lists

### DEV-013 - RLS foundation residual worktree

- Source: dirty `fix/ue-runtime-rls-foundation` worktree
- Branch head: `4315b7bd7`; original PR #752 is merged
- Domains: UNION_EYES, AUTHORITY, RLS, SECURITY
- Relationship: GATE_A_BLOCKER until source comparison completes
- Disposition: `CHERRY_PICK_COMPONENTS`
- Known result: local migration `0006_protect_workbook_claim_credentials.sql`
  is superseded by main's stronger `0013_workbook_credential_payment_authority`.
  Remaining route/test edits require comparison with DEV-005 and main.

### DEV-014 - August UE authority-remediation stash

- Source: `stash@{3}` based on `72c0d134e`
- Scope: 972 paths, dominated by evidence; 64 source/doctrine paths absent from
  current main
- Domains: UNION_EYES, AUTHORITY, SECURITY, WORKERS, EVIDENCE
- Relationship: FOUNDATIONAL / GATE_A_ENABLER
- Disposition: `CHERRY_PICK_COMPONENTS`
- Unique work: assignment-continuity outbox, steward transition validation,
  mutation authority, workbook mutation authorization, ICRA leaf boundaries,
  migrations `0048/0049`, and adversarial tests
- Constraint: predates current RLS/auth architecture and cannot be applied as a
  single stash or trusted without fresh security review

### DEV-015 - Historical UE Phase 0B/0C and controlled-pilot branches

- Sources: `fix/union-eyes-phase0b-clean`,
  `fix/union-eyes-phase0c-e2e-stabilization`,
  `workstream/ue-controlled-pilot-foundation`,
  `workstream/ue-controlled-pilot-e2e`
- Domains: UNION_EYES, EVIDENCE, CI_GOVERNANCE
- Relationship: NON_BLOCKING historical programme inputs
- Disposition: `HISTORICAL_ONLY`, with source-component review still required
- Dirty state: Phase 0C is generated evidence/`next-env.d.ts`; controlled-pilot
  E2E contains source edits that must be compared before archival

### DEV-016 - CourtLens estate

- Sources: CourtLens Phase 0 branches/worktrees, Gap 3 proof worktrees, and
  stashes 5-6
- Domains: OTHER_PORTFOLIO, EVIDENCE
- Relationship: OUT_OF_SCOPE
- Disposition: `HISTORICAL_ONLY`
- Notes: merged PRs provide the canonical implementation; dirty Gap 3 outputs
  and two helper-script edits remain to be preserved or proven generated

### DEV-017 - Detached forensic worktrees

- Sources: PR673 forensics, PR752 round31, temporary Zonga worktree, and other
  detached clean worktrees
- Domains: EVIDENCE, OTHER_PORTFOLIO
- Relationship: OUT_OF_SCOPE
- Disposition: `HISTORICAL_ONLY` or `ABANDON_SAFE` after object reachability and
  dirty-output checks
- Known dirty item: `ops/outputs/dora-metrics.json` in PR673 forensics

### DEV-018 - Old cleanup/convergence stashes

- Sources: stashes 10, 11, 13, and 15
- Dates: 2026-05-06 through 2026-05-10
- Scope: 815-2,343 paths each, dominated by mass deletions from obsolete trees
- Domains: PLATFORM, DOCUMENTATION, OTHER_PORTFOLIO
- Relationship: OUT_OF_SCOPE
- Disposition: `HISTORICAL_ONLY`
- Security note: stash 13 includes untracked GTM PDFs and a demo-secret seeding
  helper; it must never be blindly applied or committed

### DEV-019 - Old feature stashes

- Sources: stash 22 (repository cleanup plus committees/correspondence), stash
  23 (CBA intelligence/security programme), stash 25 (dispatch/employer portal
  and tests), stash 26 (older cross-app fixes)
- Domains: UNION_EYES, SECURITY, OTHER_PORTFOLIO
- Relationship: NON_BLOCKING / OUT_OF_SCOPE
- Disposition: `EXPERIMENTAL_KEEP`
- Required outcome: retain explicit archival refs or extract still-valid
  requirements; do not merge stale migrations or full application snapshots

### DEV-020 - Small generated/local stashes

- Sources: stashes 0-2, 4-9, 12, 14, 17-21, and 24
- Domains: EVIDENCE, DOCUMENTATION, OPERATIONS
- Relationship: NON_BLOCKING
- Disposition: `HISTORICAL_ONLY` or `SUPERSEDED_BY_MAIN` after per-stash hash
  proof; all remain preserved meanwhile

### DEV-021 - Merged-branch residue

- Sources: local/remote branches whose PRs are merged, including #563, #654,
  #655, #701, #703-#708, #712, #714, #719, #751-#753, #802-#806, and #810
- Domains: mixed
- Relationship: NON_BLOCKING
- Disposition: `SUPERSEDED_BY_MAIN`
- Constraint: branch/worktree deletion is deferred until dirty state and unique
  commits are proven accounted for

### DEV-022 - Closed/unmerged PR lineage

- Reviewed: #699, #700, #702, #711, #718, #745, #749, #767, #798, #807,
  and #809
- Domains: mixed
- Relationship: NON_BLOCKING except retained requirements
- Disposition: mixed `SUPERSEDED_BY_MAIN`, `DUPLICATE`, and
  `ABSORB_INTO_SAAS_PROGRAM`
- Notable retained requirement: #711's GitOps observability parity. Its old
  financial-service and runbook versions must not merge; current main already
  has stronger runbooks. PR #718 was reproduced and merged as #719.

### DEV-023 - Dependabot queue

- Sources: PRs #778-#794
- Count: 17
- Domains: SECURITY, CI_GOVERNANCE
- Relationship: NON_BLOCKING batch, subject to security severity
- Disposition: `REBASE_AND_COMPLETE` as an isolated dependency programme
- Constraint: do not mix lockfile resolution with DEV-003/DEV-004 until their
  convergence branch has stable dependency state

### DEV-024 - Local branches without active PRs

- Sources include Windows lint, old CourtLens phases, old UE acceptance,
  LIUNA continuation, performance phases, stale local main, and pre-alignment
  checkpoints
- Domains: mixed
- Relationship: mostly NON_BLOCKING or OUT_OF_SCOPE
- Disposition: `SUPERSEDED_BY_MAIN`, `HISTORICAL_ONLY`, or `DUPLICATE` according
  to merged-PR mapping; Wave-1 fixtures and B-005 are separately tracked above

## Conflict map

| Lanes | Conflict | Resolution |
| --- | --- | --- |
| DEV-003 / DEV-004 | Competing DDL for Django-owned tables | DEV-003 owns Django entities; remove #799 `0005/0006` |
| DEV-004 / DEV-005 | CI, workbook tests, red-team and generated reports overlap | Keep current-main or rebuilt exact-head forms only |
| DEV-004 / DEV-009 | Two versions of schema oracle and snapshot workflow | Reconcile into one oracle and one publisher authority |
| DEV-006 / all code lanes | Documentation may describe pre-integration state | Integrate documentation after code/schema convergence |
| DEV-010 / DEV-011 | Methodology transparency bundled with CIVIC product routes | Split; validate OCI page independently, block CIVIC routes |
| DEV-013 / main | Duplicate migration number and weaker credential protection | Keep main `0013`; discard local `0006` after recording proof |
| DEV-014 / current auth/RLS | Old authority helpers use historical assumptions | Reconstruct selected requirements against current architecture |
| DEV-023 / code lanes | Shared lockfile | Run dependency batch separately |

## Intended integration order

1. Rebase and validate DEV-002; prove B-005 exact-tip staging identity.
2. Reclassify platform-admin only after B-005 proof, through authoritative
   catalog/registry/inventory generation.
3. Rebase DEV-003 and obtain exact-head schema-authority CI.
4. Build the DEV-004 replacement on DEV-003, regenerate clean-room/oracle/RLS
   evidence, and obtain exact-head CI.
5. Close #795/#797 as superseded only after replacement work is visible and
   verified; update or replace #799 without force-pushing protected history.
6. Rebase DEV-006 on the converged code baseline, regenerate truth surfaces,
   and validate CIVIC doctrine non-regression.
7. Reconcile DEV-008 through DEV-014 into accepted programme requirements or
   narrowly scoped PRs.
8. Preserve historical/experimental branches and stashes under explicit refs,
   then remove only those worktrees/stashes proven redundant and authorized
   by this ledger.
9. Process the Dependabot queue independently.
10. Synchronize local `main`, run the final accounting audit, and record the
    exact converged main SHA and terminal CI.

## Exit statement

The convergence exit gate is not yet met. In particular, B-005 version truth,
the #796/#799 migration lineage, the unique August authority stash, dirty local
worktrees, and all stash final dispositions remain open.

Do not state `UNACCOUNTED_DEVELOPMENT = 0` until those items have terminal,
evidence-backed outcomes.

# NZILA Engineering Estate Convergence

**Status:** IN PROGRESS - inspection and classification
**Started:** 2026-09-24
**Authoritative starting baseline:** `origin/main` at
`cd94a9b58acc772ddaab3e894c70fe153e35e7e8`

**Current authoritative baseline:** `origin/main` at
`abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`

The complete read-only P0.2 census at the current baseline is recorded in
`2026-09-25_P0_2_REPOSITORY_TOPOLOGY.md`. The original starting SHA remains in
this report as historical programme context. The one-disposition-per-lane
classification is recorded in `2026-09-25_P0_5_LANE_CLASSIFICATION.md`.
Its `LANE-*` identifiers are authoritative for integration planning; the
earlier `DEV-*` sections below remain investigation notes.

This is the working Development Convergence Ledger for Pre-Phase 0. It is not a
SaaS-readiness declaration and it does not authorize production promotion.

## Current gate

```text
ENGINEERING_ESTATE_ACCOUNTED = IN_PROGRESS
P0_2_REPOSITORY_TOPOLOGY = PASS
P0_3_DEVELOPMENT_LEDGER = PASS
P0_4_ORPHAN_DISCOVERY = PASS
P0_5_PRIMARY_CLASSIFICATION = PASS
P0_6_SAAS_DOMAIN_MAPPING = PASS
P0_7_CROSS_LANE_CONFLICT_ANALYSIS = PASS
UNACCOUNTED_DEVELOPMENT != 0
OPEN_PR_DISPOSITION = IN_PROGRESS
LOCAL_WORKTREE_DISPOSITION = IN_PROGRESS
MIGRATION_LINEAGE = RECONCILIATION_REQUIRED
AUTHORITY_CONVERGENCE = RECONCILIATION_REQUIRED
CIVIC_DOCTRINE_NON_REGRESSION = PASS_ON_CURRENT_MAIN
GITOPS_FAIL_CLOSED_CONTROL = PASS
PROTECTED_POST_DEPLOY_PROBES = PASS
RUNTIME_PROOF_CONTROL_DEFECT = CLOSED
MAIN_REQUIRED_CI = REVALIDATION_REQUIRED_AFTER_CONVERGENCE
SAAS_ACTIVATION = PAUSED
```

The starting `main` check suite had 85 reported checks at inspection time:
77 successful, 4 skipped, 0 failed, and 4 still running. A terminal green
result must be recorded before this gate can close.

## Estate census

| Surface | Count | Notes |
| --- | ---: | --- |
| Local branches | 42 | Includes stale merged branches and local-only work |
| Remote feature refs after fetch | 35 | Includes open PRs and merged branch residue |
| Worktrees | 29 | 13 dirty at capture time, including this ledger worktree |
| Stashes | 27 | Preserved; oldest is 2026-02-22 |
| Open PRs | 22 | 5 human lanes and 17 Dependabot PRs |
| Open human PRs | 5 | #795, #796, #797, #799, #808 |
| Commits off current main across recorded refs | 394 | Requires content-based P0.3 classification |
| Commits reachable only from local refs | 279 | Preserved; no deletion authorized |
| Commits reachable only from remote refs | 81 | Preserved; no deletion authorized |

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

### Platform-admin B-005 and GitOps proof control

PRs #811, #812, and #814 are integrated into current `main`. Targeted GitOps
run `36075904835` completed successfully at exact SHA
`abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`. Protected credentials, health,
smoke, version drift, and deployment evidence all passed under fail-closed
behavior.

Record this work as integrated foundational SaaS input:

```text
GITOPS_FAIL_CLOSED_CONTROL = PASS
PROTECTED_POST_DEPLOY_PROBES = PASS
HEALTH_PROOF = PASS
SMOKE_PROOF = PASS
VERSION_DRIFT_PROOF = PASS
DEPLOYMENT_EVIDENCE_CONTROL = PASS
RUNTIME_PROOF_CONTROL_DEFECT = CLOSED
PRODUCTION_PROMOTION = NOT PERFORMED
SAAS_READINESS_RECLASSIFICATION = NOT PERFORMED
```

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

### DEV-002 - B-005 platform-admin version truth and fail-closed GitOps

- Source: merged PRs #811, #812, and #814; residual local/remote branches
- Integrated head: `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`
- Domains: PLATFORM, DEPLOYMENT, EVIDENCE
- Relationship: GATE_A_ENABLER
- Disposition: `SUPERSEDED_BY_MAIN` for branch residue; implementation is
  foundational input to convergence
- Proof: GitOps run `36075904835` passed exact-tip health, smoke, version drift,
  and deployment evidence under fail-closed behavior

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
- Current-main delta: 36 files, 9 commits, 3 Django migrations, schema-owner
  registry/contracts, fresh-build guards, and RLS context corrections; 4 paths
  overlap DEV-004
- Current PR state: mergeable but stale/unstable against `abc7e07...`; 15
  historical check failures mean its old CI is not integration evidence

### DEV-004 - UE complete runtime-schema lineage

- Source: PR #799 plus superseded PR #797
- Heads: `3e9a0cf8431bf9c57333f48743f7cd0f851bd291` and
  `72c1125190b790a5b6f43def739f846cf1cdb726`
- Domains: UNION_EYES, DATA, RLS, DEPLOYMENT, EVIDENCE
- Relationship: GATE_A_BLOCKER
- Disposition: `REBASE_AND_COMPLETE`
- Canonical survivor: replacement of #799 built on DEV-003
- Current PR state: #799 has 125 files and 47 commits, with 80 successful and
  6 skipped checks at its exact head, but now conflicts with current `main`;
  #797 has 82 files and 23 commits and is the older lineage
- P0.3 ruling: #797 is `DUPLICATE` / `SUPERSEDED_BY_MAINLINE_LANE` once the
  replacement is visible; #799 remains the implementation source, not a
  directly mergeable final branch
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
- Disposition: `SUPERSEDED_BY_MAIN`
- Proof: workbook test behavior is present through #801, Ops evidence refresh
  through #805, and the org-scope red-team recognition through #806; all three
  are ancestors of current `main`
- Current PR state: conflicting, 10 failed historical checks; no unique
  implementation requirement remains in its six-file patch

### DEV-006 - Repository truth convergence

- Source: PR #808, `docs/truth-convergence`
- Head: `9b8aaa35602fcc94b4af92d94b3036a127ec0687`
- Domains: DOCUMENTATION, CI_GOVERNANCE, CIVIC_BOUNDARY
- Relationship: FOUNDATIONAL
- Disposition: `REBASE_AND_COMPLETE`
- Current scope: 234 files, 8 commits, primarily documentation/report
  convergence plus `claim-verification` validation-source changes
- Current PR state: mergeable with one Governance Gates failure, but based
  eight commits behind current `main`
- Notes: integrate after schema/code convergence, regenerate every derived
  truth surface, and re-run #810 doctrine checks. Do not carry its temporal
  readiness claims forward without regeneration.

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
- Disposition: mixed `HISTORICAL_ONLY` and `EXPERIMENTAL_KEEP`
- Notes: merged PRs provide the canonical Phase 0/1 implementation. The Gap 3
  proof branch still contains 77 paths absent from current `main`, primarily
  proof tooling/evidence plus a small ABR fixture surface; retain it explicitly
  outside the SaaS critical path until the CourtLens owner decides its fate.

### DEV-017 - Detached forensic worktrees

- Sources: PR673 forensics, PR752 round31, temporary Zonga worktree, and other
  detached clean worktrees
- Domains: EVIDENCE, OTHER_PORTFOLIO
- Relationship: OUT_OF_SCOPE
- Disposition: `SUPERSEDED_BY_MAIN` for PR673 heads, `HISTORICAL_ONLY` for
  clean base checkpoints
- Proof: detached heads `1160f9d82` and `edf78a1d1` are PR #673 commits merged
  on 2026-08-26; temporary Zonga head `e505b621e` is patch-equivalent to the
  PR #673 Zonga fix `cb9fd5820`
- Known dirty item: one generated `ops/outputs/dora-metrics.json` remains in
  PR673 forensics and is separately accounted as local output drift

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
- Clean current heads: #786, #787, #790, #791, #793, #794
- Unstable current heads: #778-#785, #788, #789, #792
- Major/high-blast-radius updates requiring dedicated validation: #778 Vitest,
  #780 Pylint, #781 filelock, #784 pytest, #788 Node types, #793 Changesets
- Each PR remains an individually accountable sub-lane; none is authorized for
  merge during the inspection freeze.

### DEV-024 - Local branches without active PRs

- Sources include Windows lint, old CourtLens phases, old UE acceptance,
  LIUNA continuation, performance phases, stale local main, and pre-alignment
  checkpoints
- Domains: mixed
- Relationship: mostly NON_BLOCKING or OUT_OF_SCOPE
- Disposition: `SUPERSEDED_BY_MAIN`, `HISTORICAL_ONLY`, or `DUPLICATE` according
  to merged-PR mapping; Wave-1 fixtures and B-005 are separately tracked above
- Complete branch identities, exact heads, upstreams, ahead/behind counts, and
  tip ancestry are recorded in the P0.2 topology snapshot.

## P0.3 inspection evidence

### Pull-request estate

| PR | Files | Current state | Recommended disposition |
| ---: | ---: | --- | --- |
| #795 | 6 | conflicting; content present through #801/#805/#806 | `SUPERSEDED_BY_MAIN` |
| #796 | 36 | mergeable, unstable, 15 historical failures | `REBASE_AND_COMPLETE` |
| #797 | 82 | conflicting older lineage | `DUPLICATE` after replacement |
| #799 | 125 | conflicting; exact old head had 80 pass/0 fail | `REBASE_AND_COMPLETE` via replacement |
| #808 | 234 | mergeable, one governance failure | `REBASE_AND_COMPLETE` last |

The 17 Dependabot PRs are retained as separate dependency sub-lanes under
DEV-023. Their shared lockfile overlap is an architectural ordering constraint,
not permission to batch-merge them.

### Dirty worktree estate

Twelve non-ledger worktrees remain dirty after the P0.2 commit. No staged files
were found. Their working files were compared directly with current `main`:

- RLS foundation: 16 files; 9 source/migration/test paths plus generated reports.
- Phase 0C: generated runtime/evidence outputs and one stray placeholder file.
- CourtLens Gap 3 final/proof: generated evidence plus two helper-script edits.
- Docs convergence precursor: 12 documentation moves/edits; duplicate of #808.
- PR673 forensic worktree: one generated DORA output.
- Shared UE checkout: 40 status entries spanning commissioning tools, schema
  oracle, snapshot publishing, Wave-1 probes, OCI/CIVIC routes, reports, and
  local ACR operator scripts.
- Runtime-lineage worktree: 49 untracked Phase H/pilot evidence and helper
  artifacts; none exists on current `main`.
- Controlled-pilot E2E: 23 entries, including 11 source/config/lockfile edits
  and generated evidence.
- B-005 and Orchestrator worktrees: generated documentation/report drift only;
  their committed implementations are integrated.
- Platform-admin version worktree: two untracked version-drift outputs; the
  exact-tip proof is integrated evidence.

### Stash estate

All 27 stashes remain preserved. Mechanical path/size inspection confirms:

- stashes 0-2 are small generated report/inventory/output drift;
- stash 3 is the material August authority lane: 972 files, including active
  Union Eyes source among a large evidence payload;
- stashes 4-9 and 12, 14, 17-21, 24 are bounded generated/local or narrow source
  snapshots requiring equivalence checks before disposal;
- stashes 10, 11, 13, and 15 are very large historical cleanup snapshots with
  mass deletions and must never be blindly applied;
- stashes 16, 22, 23, 25, and 26 contain potentially valuable source across
  auth, Union Eyes, platform, infrastructure, and tests and remain explicit
  component-review lanes.

No stash has been applied, dropped, rewritten, or converted into a commit.

### Orphan-discovery ruling

Remote branches without open PRs were reconciled to merged/closed lineage:

- `codex/gitops-proof-fail-closed` is closed PR #813, replaced by merged #814;
- `devin/1790252515-docs-truth-convergence` is closed #807, replaced by #808;
- CIVIC, SAGE, dependency-waiver, GitOps, Ops-evidence, platform-version,
  E2E-RLS, and export-scope refs map to merged PRs #802-#812/#814;
- `fix/ue-authoritative-release-baseline` and
  `hotfix/fr-cta-locale-redirect` point to a commit already in current `main`.

Local no-PR branches were also content-checked. The Windows lint fix is
byte-identical on current `main`; B-005 is superseded by #811; LIUNA's unique
documents and contract test are byte-identical on current `main`; historical
Phase 0B/0C and controlled-pilot lines remain explicit programme history.

Material orphaned value remains preserved in known lanes rather than hidden:

- stash 3: 159 tracked and 813 untracked paths, including 211 material
  source/doctrine paths after generated evidence is excluded;
- stash 16: 28 older TrustCore/platform-auth/contract paths;
- stash 22: 267 material historical platform/Union Eyes paths;
- stash 23: 89 material CBA/security paths;
- stash 25: 91 dispatch, employer-portal, partner, test, and tooling paths;
- stash 26: 42 older cross-app/auth/ML paths;
- shared checkout commissioning tools, runtime-lineage Phase H artifacts, and
  controlled-pilot E2E working files as listed above.

These are classified lanes requiring component review or explicit retention;
they are not permission to apply historical snapshots wholesale.

### Current-main check state

At `abc7e07...`, GitHub reports 91 check runs: 80 success, 4 skipped, 0
failures, 6 cancelled GitOps jobs, and 1 waiting production gate. The targeted
fail-closed staging run is PASS, but the combined commit state remains pending.
No production approval will be granted merely to turn that state green.

## Conflict map

| Lanes | Conflict | Resolution |
| --- | --- | --- |
| LANE-003 / LANE-004 | Four direct overlaps plus competing DDL for Django-owned tables | LANE-003 owns Django entities; remove #799 `0005/0006` |
| LANE-004 / LANE-008 | Five overlaps including two schema oracles and snapshot/E2E authority | Reconcile into one oracle and one publisher authority |
| LANE-004 / LANE-028 | Twenty Phase H evidence paths overlap | Treat untracked evidence as historical input; regenerate at final head |
| LANE-004 / LANE-027 | Root package and lockfile overlap | Port only validated E2E source after schema dependency state stabilizes |
| LANE-006 / code lanes | Documentation may describe pre-integration state | Integrate documentation after code/schema convergence |
| LANE-006 / LANE-008/011 | Generated truth and authority reports overlap | Regenerate once from the converged implementation |
| LANE-007 / LANE-003/004/008 | Package manifest and Wave-1 seed implementation overlap | Absorb fixtures after schema lineage is canonical |
| LANE-008 / LANE-009 | OCI methodology transparency is bundled with unauthorized CIVIC routes | Split; validate OCI page independently and block CIVIC routes |
| LANE-011 / main | Duplicate migration number and weaker credential protection | Keep main `0013`; exclude local `0006` after recording proof |
| LANE-012 / current auth/RLS | Old authority helpers use historical assumptions | Reconstruct selected requirements against current architecture |
| LANE-017 / LANE-004/027 | Lockfile/inventory and health/E2E behavior overlap | Preserve requirement; reassess after lineage/E2E convergence |
| LANE-020 / code lanes | Shared lockfile and broad dependency surfaces | Run dependency programme separately after code convergence |

## Intended integration order

1. Complete P0.2/P0.3 classification against `abc7e07...`; treat LANE-002 as
   integrated foundational work and do not rediscover or reimplement it.
2. Defer platform-admin portfolio/readiness reclassification until the
   convergence decision authorizes metadata work.
3. Rebase LANE-003 and obtain exact-head schema-authority CI.
4. Build the LANE-004 replacement on LANE-003, regenerate clean-room/oracle/RLS
   evidence, and obtain exact-head CI.
5. Close #795/#797 as superseded only after replacement work is visible and
   verified; update or replace #799 without force-pushing protected history.
6. Rebase LANE-006 on the converged code baseline, regenerate truth surfaces,
   and validate CIVIC doctrine non-regression.
7. Reconcile LANE-007 through LANE-029 into accepted programme requirements or
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

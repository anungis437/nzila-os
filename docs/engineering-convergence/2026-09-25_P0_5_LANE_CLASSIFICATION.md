# P0.5 Development Lane Classification

**Baseline:** `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`
**Status:** COMPLETE FOR PLANNING; no integration or deletion authorized by this file alone

This classification consumes the exact topology in
`2026-09-25_P0_2_REPOSITORY_TOPOLOGY.md` and the evidence in the working
convergence report. Every discovered surface maps to one primary lane and one
primary disposition. Related refs are grouped only when they carry the same
effective development lineage.

## Lane ledger

| ID | Development lane | Primary disposition | SaaS relationship | Evidence / required outcome |
| --- | --- | --- | --- | --- |
| LANE-001 | Current `origin/main` | `MERGE_CANDIDATE` | FOUNDATIONAL | Authoritative input baseline; not yet the converged exit SHA |
| LANE-002 | PRs #811/#812/#814 and B-005/GitOps branch residue | `SUPERSEDED_BY_MAIN` | FOUNDATIONAL | Integrated and exact-tip staging proof passed at `abc7e07...` |
| LANE-003 | PR #796 schema-authority foundation | `REBASE_AND_COMPLETE` | GATE_A_BLOCKER | Preserve one-owner doctrine, Django migrations, oracle contracts, and RLS-context fixes |
| LANE-004 | PR #799 plus older #797 runtime-schema lineage | `REBASE_AND_COMPLETE` | GATE_A_BLOCKER | Rebuild on LANE-003; #797 is the duplicate predecessor |
| LANE-005 | PR #795 workbook/red-team/Ops precursor | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | Effective changes entered through #801/#805/#806 |
| LANE-006 | PR #808 plus #807/docs precursor | `REBASE_AND_COMPLETE` | FOUNDATIONAL | Integrate after code/schema convergence and regenerate truth surfaces |
| LANE-007 | Wave-1 fixture branch | `ABSORB_INTO_SAAS_PROGRAM` | GATE_A_ENABLER | Preserve synthetic acceptance tooling; do not misstate it as stakeholder onboarding |
| LANE-008 | Shared-checkout commissioning/oracle/snapshot/probe work | `CHERRY_PICK_COMPONENTS` | GATE_A_ENABLER | Reconcile against LANE-003/004; generated outputs are not source authority |
| LANE-009 | Shared-checkout public CIVIC routes | `BLOCKED_DECISION` | GATE_A_BLOCKER | Runtime authorization remains false; no integration under current doctrine |
| LANE-010 | Local ACR cleanup/operator scripts | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | Retain locally; do not execute or commit generated deletion lists |
| LANE-011 | Dirty RLS-foundation residual worktree | `CHERRY_PICK_COMPONENTS` | GATE_A_BLOCKER | Review route/test changes; reject weaker duplicate credential migration |
| LANE-012 | Stash 3 August authority programme | `CHERRY_PICK_COMPONENTS` | GATE_A_ENABLER | Review 211 material paths against current auth/RLS architecture |
| LANE-013 | Phase 0B/0C and controlled-pilot committed history | `HISTORICAL_ONLY` | NON_BLOCKING | Preserve as programme history; current source must come from accepted components only |
| LANE-014 | CourtLens Phase 0/1 branches and old stashes | `HISTORICAL_ONLY` | OUT_OF_SCOPE | Merged Phase 0/1 is canonical |
| LANE-015 | Detached PR673/PR752/base checkpoints | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | PR673/PR752 content merged; clean base checkpoints carry no unique tip work |
| LANE-016 | Merged local/remote branch residue | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | Exact merged PR mapping recorded in P0.2/P0.4 |
| LANE-017 | Closed PR #699 health-safety API/client work | `ABSORB_INTO_SAAS_PROGRAM` | GATE_C | Most paths evolved on main, but training stats remains absent; retain requirement |
| LANE-018 | Closed PR #711 GitOps observability parity | `ABSORB_INTO_SAAS_PROGRAM` | OPERATIONS ENABLER | Re-evaluate against fail-closed GitOps before implementing any residual delta |
| LANE-019 | Superseded closed PRs #700/#702/#718/#745/#749/#767/#798/#807/#809/#813 | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | Replacements are #707/#708/#719/#808/#750/#768/#802/#808/#810/#814 as applicable |
| LANE-020 | Open Dependabot queue #778-#794 | `REBASE_AND_COMPLETE` | NON_BLOCKING | Process after schema convergence; each PR remains a separate sub-lane |
| LANE-021 | Stash 16 TrustCore/platform-auth/contracts | `CHERRY_PICK_COMPONENTS` | SECURITY | Security review against current authority model; never apply wholesale |
| LANE-022 | Stash 22 broad cleanup/committee/correspondence snapshot | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | Preserve; extract requirements only after current-main comparison |
| LANE-023 | Stash 23 CBA intelligence/security programme | `EXPERIMENTAL_KEEP` | GATE_C | Preserve as later product input; stale schema/workflows cannot merge directly |
| LANE-024 | Stash 25 dispatch/employer/partner programme | `ABSORB_INTO_SAAS_PROGRAM` | GATE_C | Preserve requirements and tests; redesign against current tenancy/schema authority |
| LANE-025 | Stash 26 older cross-app/auth/ML fixes | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | Preserve pending component-level equivalence review |
| LANE-026 | Stashes 0-2, 4-9, 12, 14, 17-21, 24 | `HISTORICAL_ONLY` | NON_BLOCKING | Small generated/local snapshots or bounded historical inputs; keep until final proof |
| LANE-027 | Dirty controlled-pilot E2E worktree | `CHERRY_PICK_COMPONENTS` | GATE_A_ENABLER | Review 11 source/config edits separately from generated run evidence |
| LANE-028 | Untracked Phase H/pilot evidence in lineage worktree | `EXPERIMENTAL_KEEP` | EVIDENCE | Retain as SHA-bound historical input; no readiness claim transfers to converged head |
| LANE-029 | CourtLens Gap 3 proof branch/worktrees | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | 77 paths absent from main; explicitly retained for CourtLens owner disposition |
| LANE-030 | Engineering-convergence ledger branch | `MERGE_CANDIDATE` | FOUNDATIONAL | Documentation-only control record; integrate after its inventory is refreshed |
| LANE-031 | Platform-admin lifecycle metadata reclassification | `ABSORB_INTO_SAAS_PROGRAM` | FOUNDATIONAL | Exact-tip proof exists, but metadata change waits for converged-baseline decision |

## SaaS domain map

| Lane | Domains |
| --- | --- |
| LANE-001 | PLATFORM, CI_GOVERNANCE |
| LANE-002 | PLATFORM, DEPLOYMENT, EVIDENCE |
| LANE-003 | UNION_EYES, DATA, AUTHORITY, RLS, SECURITY |
| LANE-004 | UNION_EYES, DATA, RLS, DEPLOYMENT, EVIDENCE |
| LANE-005 | UNION_EYES, SECURITY, CI_GOVERNANCE, EVIDENCE |
| LANE-006 | DOCUMENTATION, CI_GOVERNANCE, CIVIC_BOUNDARY |
| LANE-007 | UNION_EYES, DATA, EVIDENCE |
| LANE-008 | UNION_EYES, DATA, DEPLOYMENT, EVIDENCE, OPERATIONS |
| LANE-009 | CIVIC_BOUNDARY |
| LANE-010 | OPERATIONS, DEPLOYMENT |
| LANE-011 | UNION_EYES, AUTHORITY, RLS, SECURITY |
| LANE-012 | UNION_EYES, AUTHORITY, RLS, SECURITY, WORKERS, EVIDENCE |
| LANE-013 | UNION_EYES, EVIDENCE, CI_GOVERNANCE |
| LANE-014 | OTHER_PORTFOLIO, DOCUMENTATION, EVIDENCE |
| LANE-015 | EVIDENCE, OTHER_PORTFOLIO |
| LANE-016 | PLATFORM, CI_GOVERNANCE, DOCUMENTATION, OTHER_PORTFOLIO |
| LANE-017 | UNION_EYES, CORE_WORKFLOW, DATA |
| LANE-018 | DEPLOYMENT, OBSERVABILITY, OPERATIONS |
| LANE-019 | CI_GOVERNANCE, DOCUMENTATION, CIVIC_BOUNDARY |
| LANE-020 | SECURITY, CI_GOVERNANCE |
| LANE-021 | IDENTITY, AUTHORITY, SECURITY, OTHER_PORTFOLIO |
| LANE-022 | UNION_EYES, DOCUMENTATION, OTHER_PORTFOLIO |
| LANE-023 | UNION_EYES, DATA, CORE_WORKFLOW, SECURITY |
| LANE-024 | UNION_EYES, CORE_WORKFLOW, EXTERNAL_SPECIALIST, DATA |
| LANE-025 | IDENTITY, AUTHORITY, DATA, OTHER_PORTFOLIO |
| LANE-026 | EVIDENCE, DOCUMENTATION, OPERATIONS |
| LANE-027 | UNION_EYES, IDENTITY, AUTHORITY, EVIDENCE |
| LANE-028 | EVIDENCE, OPERATIONS, EXTERNAL_SPECIALIST |
| LANE-029 | OTHER_PORTFOLIO, EVIDENCE |
| LANE-030 | DOCUMENTATION, CI_GOVERNANCE |
| LANE-031 | PLATFORM, DEPLOYMENT, DOCUMENTATION |

## Open PR mapping

| PR | Lane | Primary disposition |
| ---: | --- | --- |
| #808 | LANE-006 | `REBASE_AND_COMPLETE` |
| #799 | LANE-004 | `REBASE_AND_COMPLETE` |
| #797 | LANE-004 | `DUPLICATE` within the lane |
| #796 | LANE-003 | `REBASE_AND_COMPLETE` |
| #795 | LANE-005 | `SUPERSEDED_BY_MAIN` |
| #778 | LANE-020.01 | `REBASE_AND_COMPLETE` |
| #779 | LANE-020.02 | `REBASE_AND_COMPLETE` |
| #780 | LANE-020.03 | `REBASE_AND_COMPLETE` |
| #781 | LANE-020.04 | `REBASE_AND_COMPLETE` |
| #782 | LANE-020.05 | `REBASE_AND_COMPLETE` |
| #783 | LANE-020.06 | `REBASE_AND_COMPLETE` |
| #784 | LANE-020.07 | `REBASE_AND_COMPLETE` |
| #785 | LANE-020.08 | `REBASE_AND_COMPLETE` |
| #786 | LANE-020.09 | `REBASE_AND_COMPLETE` |
| #787 | LANE-020.10 | `REBASE_AND_COMPLETE` |
| #788 | LANE-020.11 | `REBASE_AND_COMPLETE` |
| #789 | LANE-020.12 | `REBASE_AND_COMPLETE` |
| #790 | LANE-020.13 | `REBASE_AND_COMPLETE` |
| #791 | LANE-020.14 | `REBASE_AND_COMPLETE` |
| #792 | LANE-020.15 | `REBASE_AND_COMPLETE` |
| #793 | LANE-020.16 | `REBASE_AND_COMPLETE` |
| #794 | LANE-020.17 | `REBASE_AND_COMPLETE` |

## Local branch mapping

| Lane | Local branches |
| --- | --- |
| LANE-002 | `codex/b005-version-truth`, `fix/gitops-env-var-arguments`, `fix/gitops-proof-fail-closed`, `fix/platform-admin-version-truth` |
| LANE-003 | `fix/ue-runtime-schema-authority-reconciliation` |
| LANE-004 | `workstream/ue-runtime-schema-lineage-restoration` |
| LANE-005 | `fix/ci-workbook-memory-holders-redteam-ops-snapshot` |
| LANE-007 | `chore/ue-wave1-staging-fixtures` |
| LANE-011 | `fix/ue-runtime-rls-foundation`, `codex/pre-align-20260904-87a5e429` |
| LANE-013 | `fix/union-eyes-phase0b-clean`, `fix/union-eyes-phase0c-e2e-stabilization`, `workstream/ue-controlled-pilot-foundation`, `workstream/ue-controlled-pilot-e2e` |
| LANE-014 | `docs/cbc-ishmael-feedback-only-reviewer-packet`, `docs/courtlens-refactor-phase0`, `docs/courtlens-refactor-phase0-v2`, `docs/courtlens-refactor-phase0-v3`, `feat/courtlens-phase1`, `integration/courtlens-gap3-product-line` |
| LANE-016 | `chore/windows-lint-staged-fix`, `docs/phase2-regression-correction-713`, `docs/ue-runtime-acceptance`, `feat/civic-oci-doctrine-integrity`, `fix/browserslist-high-20260901`, `fix/main-lockfile-drift`, `fix/no-console-union-eyes-admin-users`, `fix/pnpm-lock-immutable-override`, `fix/ue-authoritative-release-baseline`, `fix/ue-health-safety-v2-paths` after LANE-017 requirement capture, `fix/union-eyes-continuity-inheritance-route-contract-guards`, `hotfix/fr-cta-locale-redirect`, `liuna/continuation-post-gate-13`, `perf/gha-phase-1-5-composite-adoption`, `perf/gha-phase-1-concurrency`, `perf/gha-phase-2-bulk-composite`, `perf/gha-phase-3-concurrency-guards`, `perf/gha-phase-4-critical-path-analysis`, `repository-convergence-task` |
| LANE-029 | `proof/courtlens-gap3-final` |
| LANE-030 | `docs/engineering-estate-convergence` |
| Baseline residue | stale local `main`; synchronize only after dirty-state-safe convergence |

## Worktree mapping

| Lane | Worktrees |
| --- | --- |
| LANE-002 | B-005, GitOps env-fix, GitOps proof, and platform-version Codex worktrees |
| LANE-003 | `nzila-ue-schema-reconcile` and both detached staging-reconstitution worktrees |
| LANE-004/LANE-028 | `nzila-ue-runtime-schema-lineage` |
| LANE-005/LANE-008/LANE-009/LANE-010 | shared `nzila-ue-authoritative-baseline` checkout, split by path ownership |
| LANE-006 | `nzila-os-origin-main` dirty docs precursor |
| LANE-011 | `nzila-automation` and PR752 detached checkpoint |
| LANE-013/LANE-027 | Phase 0B, Phase 0C, controlled-pilot foundation, and controlled-pilot E2E worktrees |
| LANE-014/LANE-029 | CourtLens Phase 0 and Gap 3 baseline/proof/final worktrees |
| LANE-015 | PR673 forensics/parent UI, clean historical checkpoints, Kilo checkpoints, and temporary Zonga worktree |
| LANE-030 | SaaS activation foundation / convergence ledger worktree |

## Stash mapping

| Stashes | Lane | Primary disposition |
| --- | --- | --- |
| 0-2 | LANE-026 | `HISTORICAL_ONLY` |
| 3 | LANE-012 | `CHERRY_PICK_COMPONENTS` |
| 4-9 | LANE-026 | `HISTORICAL_ONLY` |
| 10-11 | LANE-022 | `EXPERIMENTAL_KEEP` |
| 12 | LANE-026 | `HISTORICAL_ONLY` |
| 13 | LANE-022 | `EXPERIMENTAL_KEEP` |
| 14 | LANE-026 | `HISTORICAL_ONLY` |
| 15 | LANE-022 | `EXPERIMENTAL_KEEP` |
| 16 | LANE-021 | `CHERRY_PICK_COMPONENTS` |
| 17-21 | LANE-026 | `HISTORICAL_ONLY` |
| 22 | LANE-022 | `EXPERIMENTAL_KEEP` |
| 23 | LANE-023 | `EXPERIMENTAL_KEEP` |
| 24 | LANE-026 | `HISTORICAL_ONLY` |
| 25 | LANE-024 | `ABSORB_INTO_SAAS_PROGRAM` |
| 26 | LANE-025 | `EXPERIMENTAL_KEEP` |

## Classification gate

```text
P0_3_DEVELOPMENT_LEDGER = PASS
P0_4_ORPHAN_DISCOVERY = PASS
P0_5_PRIMARY_CLASSIFICATION = PASS

UNACCOUNTED_DEVELOPMENT != 0
```

The final invariant remains open because retained component-review lanes have
not yet been integrated, preserved under final references, or formally closed.

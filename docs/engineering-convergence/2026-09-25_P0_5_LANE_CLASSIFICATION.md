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
| DEV-001 | Current `origin/main` | `MERGE_CANDIDATE` | FOUNDATIONAL | Authoritative input baseline; not yet the converged exit SHA |
| DEV-002 | PRs #811/#812/#814 and B-005/GitOps branch residue | `SUPERSEDED_BY_MAIN` | FOUNDATIONAL | Integrated and exact-tip staging proof passed at `abc7e07...` |
| DEV-003 | PR #796 schema-authority foundation | `REBASE_AND_COMPLETE` | GATE_A_BLOCKER | Preserve one-owner doctrine, Django migrations, oracle contracts, and RLS-context fixes |
| DEV-004 | PR #799 plus older #797 runtime-schema lineage | `REBASE_AND_COMPLETE` | GATE_A_BLOCKER | Rebuild on DEV-003; #797 is the duplicate predecessor |
| DEV-005 | PR #795 workbook/red-team/Ops precursor | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | Effective changes entered through #801/#805/#806 |
| DEV-006 | PR #808 plus #807/docs precursor | `REBASE_AND_COMPLETE` | FOUNDATIONAL | Integrate after code/schema convergence and regenerate truth surfaces |
| DEV-007 | Wave-1 fixture branch | `ABSORB_INTO_SAAS_PROGRAM` | GATE_A_ENABLER | Preserve synthetic acceptance tooling; do not misstate it as stakeholder onboarding |
| DEV-008 | Shared-checkout commissioning/oracle/snapshot/probe work | `CHERRY_PICK_COMPONENTS` | GATE_A_ENABLER | Reconcile against DEV-003/004; generated outputs are not source authority |
| DEV-009 | Shared-checkout public CIVIC routes | `BLOCKED_DECISION` | GATE_A_BLOCKER | Runtime authorization remains false; no integration under current doctrine |
| DEV-010 | Local ACR cleanup/operator scripts | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | Retain locally; do not execute or commit generated deletion lists |
| DEV-011 | Dirty RLS-foundation residual worktree | `CHERRY_PICK_COMPONENTS` | GATE_A_BLOCKER | Review route/test changes; reject weaker duplicate credential migration |
| DEV-012 | Stash 3 August authority programme | `CHERRY_PICK_COMPONENTS` | GATE_A_ENABLER | Review 211 material paths against current auth/RLS architecture |
| DEV-013 | Phase 0B/0C and controlled-pilot committed history | `HISTORICAL_ONLY` | NON_BLOCKING | Preserve as programme history; current source must come from accepted components only |
| DEV-014 | CourtLens Phase 0/1 branches and old stashes | `HISTORICAL_ONLY` | OUT_OF_SCOPE | Merged Phase 0/1 is canonical |
| DEV-015 | Detached PR673/PR752/base checkpoints | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | PR673/PR752 content merged; clean base checkpoints carry no unique tip work |
| DEV-016 | Merged local/remote branch residue | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | Exact merged PR mapping recorded in P0.2/P0.4 |
| DEV-017 | Closed PR #699 health-safety API/client work | `ABSORB_INTO_SAAS_PROGRAM` | GATE_C | Most paths evolved on main, but training stats remains absent; retain requirement |
| DEV-018 | Closed PR #711 GitOps observability parity | `ABSORB_INTO_SAAS_PROGRAM` | OPERATIONS ENABLER | Re-evaluate against fail-closed GitOps before implementing any residual delta |
| DEV-019 | Superseded closed PRs #700/#702/#718/#745/#749/#767/#798/#807/#809/#813 | `SUPERSEDED_BY_MAIN` | NON_BLOCKING | Replacements are #707/#708/#719/#808/#750/#768/#802/#808/#810/#814 as applicable |
| DEV-020 | Open Dependabot queue #778-#794 | `REBASE_AND_COMPLETE` | NON_BLOCKING | Process after schema convergence; each PR remains a separate sub-lane |
| DEV-021 | Stash 16 TrustCore/platform-auth/contracts | `CHERRY_PICK_COMPONENTS` | SECURITY | Security review against current authority model; never apply wholesale |
| DEV-022 | Stash 22 broad cleanup/committee/correspondence snapshot | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | Preserve; extract requirements only after current-main comparison |
| DEV-023 | Stash 23 CBA intelligence/security programme | `EXPERIMENTAL_KEEP` | GATE_C | Preserve as later product input; stale schema/workflows cannot merge directly |
| DEV-024 | Stash 25 dispatch/employer/partner programme | `ABSORB_INTO_SAAS_PROGRAM` | GATE_C | Preserve requirements and tests; redesign against current tenancy/schema authority |
| DEV-025 | Stash 26 older cross-app/auth/ML fixes | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | Preserve pending component-level equivalence review |
| DEV-026 | Stashes 0-2, 4-9, 12, 14, 17-21, 24 | `HISTORICAL_ONLY` | NON_BLOCKING | Small generated/local snapshots or bounded historical inputs; keep until final proof |
| DEV-027 | Dirty controlled-pilot E2E worktree | `CHERRY_PICK_COMPONENTS` | GATE_A_ENABLER | Review 11 source/config edits separately from generated run evidence |
| DEV-028 | Untracked Phase H/pilot evidence in lineage worktree | `EXPERIMENTAL_KEEP` | EVIDENCE | Retain as SHA-bound historical input; no readiness claim transfers to converged head |
| DEV-029 | CourtLens Gap 3 proof branch/worktrees | `EXPERIMENTAL_KEEP` | OUT_OF_SCOPE | 77 paths absent from main; explicitly retained for CourtLens owner disposition |
| DEV-030 | Engineering-convergence ledger branch | `MERGE_CANDIDATE` | FOUNDATIONAL | Documentation-only control record; integrate after its inventory is refreshed |
| DEV-031 | Platform-admin lifecycle metadata reclassification | `ABSORB_INTO_SAAS_PROGRAM` | FOUNDATIONAL | Exact-tip proof exists, but metadata change waits for converged-baseline decision |

## Open PR mapping

| PR | Lane | Primary disposition |
| ---: | --- | --- |
| #808 | DEV-006 | `REBASE_AND_COMPLETE` |
| #799 | DEV-004 | `REBASE_AND_COMPLETE` |
| #797 | DEV-004 | `DUPLICATE` within the lane |
| #796 | DEV-003 | `REBASE_AND_COMPLETE` |
| #795 | DEV-005 | `SUPERSEDED_BY_MAIN` |
| #778 | DEV-020.01 | `REBASE_AND_COMPLETE` |
| #779 | DEV-020.02 | `REBASE_AND_COMPLETE` |
| #780 | DEV-020.03 | `REBASE_AND_COMPLETE` |
| #781 | DEV-020.04 | `REBASE_AND_COMPLETE` |
| #782 | DEV-020.05 | `REBASE_AND_COMPLETE` |
| #783 | DEV-020.06 | `REBASE_AND_COMPLETE` |
| #784 | DEV-020.07 | `REBASE_AND_COMPLETE` |
| #785 | DEV-020.08 | `REBASE_AND_COMPLETE` |
| #786 | DEV-020.09 | `REBASE_AND_COMPLETE` |
| #787 | DEV-020.10 | `REBASE_AND_COMPLETE` |
| #788 | DEV-020.11 | `REBASE_AND_COMPLETE` |
| #789 | DEV-020.12 | `REBASE_AND_COMPLETE` |
| #790 | DEV-020.13 | `REBASE_AND_COMPLETE` |
| #791 | DEV-020.14 | `REBASE_AND_COMPLETE` |
| #792 | DEV-020.15 | `REBASE_AND_COMPLETE` |
| #793 | DEV-020.16 | `REBASE_AND_COMPLETE` |
| #794 | DEV-020.17 | `REBASE_AND_COMPLETE` |

## Local branch mapping

| Lane | Local branches |
| --- | --- |
| DEV-002 | `codex/b005-version-truth`, `fix/gitops-env-var-arguments`, `fix/gitops-proof-fail-closed`, `fix/platform-admin-version-truth` |
| DEV-003 | `fix/ue-runtime-schema-authority-reconciliation` |
| DEV-004 | `workstream/ue-runtime-schema-lineage-restoration` |
| DEV-005 | `fix/ci-workbook-memory-holders-redteam-ops-snapshot` |
| DEV-007 | `chore/ue-wave1-staging-fixtures` |
| DEV-011 | `fix/ue-runtime-rls-foundation`, `codex/pre-align-20260904-87a5e429` |
| DEV-013 | `fix/union-eyes-phase0b-clean`, `fix/union-eyes-phase0c-e2e-stabilization`, `workstream/ue-controlled-pilot-foundation`, `workstream/ue-controlled-pilot-e2e` |
| DEV-014 | `docs/cbc-ishmael-feedback-only-reviewer-packet`, `docs/courtlens-refactor-phase0`, `docs/courtlens-refactor-phase0-v2`, `docs/courtlens-refactor-phase0-v3`, `feat/courtlens-phase1`, `integration/courtlens-gap3-product-line` |
| DEV-016 | `chore/windows-lint-staged-fix`, `docs/phase2-regression-correction-713`, `docs/ue-runtime-acceptance`, `feat/civic-oci-doctrine-integrity`, `fix/browserslist-high-20260901`, `fix/main-lockfile-drift`, `fix/no-console-union-eyes-admin-users`, `fix/pnpm-lock-immutable-override`, `fix/ue-authoritative-release-baseline`, `fix/ue-health-safety-v2-paths` after DEV-017 requirement capture, `fix/union-eyes-continuity-inheritance-route-contract-guards`, `hotfix/fr-cta-locale-redirect`, `liuna/continuation-post-gate-13`, `perf/gha-phase-1-5-composite-adoption`, `perf/gha-phase-1-concurrency`, `perf/gha-phase-2-bulk-composite`, `perf/gha-phase-3-concurrency-guards`, `perf/gha-phase-4-critical-path-analysis`, `repository-convergence-task` |
| DEV-029 | `proof/courtlens-gap3-final` |
| DEV-030 | `docs/engineering-estate-convergence` |
| Baseline residue | stale local `main`; synchronize only after dirty-state-safe convergence |

## Worktree mapping

| Lane | Worktrees |
| --- | --- |
| DEV-002 | B-005, GitOps env-fix, GitOps proof, and platform-version Codex worktrees |
| DEV-003 | `nzila-ue-schema-reconcile` and both detached staging-reconstitution worktrees |
| DEV-004/DEV-028 | `nzila-ue-runtime-schema-lineage` |
| DEV-005/DEV-008/DEV-009/DEV-010 | shared `nzila-ue-authoritative-baseline` checkout, split by path ownership |
| DEV-006 | `nzila-os-origin-main` dirty docs precursor |
| DEV-011 | `nzila-automation` and PR752 detached checkpoint |
| DEV-013/DEV-027 | Phase 0B, Phase 0C, controlled-pilot foundation, and controlled-pilot E2E worktrees |
| DEV-014/DEV-029 | CourtLens Phase 0 and Gap 3 baseline/proof/final worktrees |
| DEV-015 | PR673 forensics/parent UI, clean historical checkpoints, Kilo checkpoints, and temporary Zonga worktree |
| DEV-030 | SaaS activation foundation / convergence ledger worktree |

## Stash mapping

| Stashes | Lane | Primary disposition |
| --- | --- | --- |
| 0-2 | DEV-026 | `HISTORICAL_ONLY` |
| 3 | DEV-012 | `CHERRY_PICK_COMPONENTS` |
| 4-9 | DEV-026 | `HISTORICAL_ONLY` |
| 10-11 | DEV-022 | `EXPERIMENTAL_KEEP` |
| 12 | DEV-026 | `HISTORICAL_ONLY` |
| 13 | DEV-022 | `EXPERIMENTAL_KEEP` |
| 14 | DEV-026 | `HISTORICAL_ONLY` |
| 15 | DEV-022 | `EXPERIMENTAL_KEEP` |
| 16 | DEV-021 | `CHERRY_PICK_COMPONENTS` |
| 17-21 | DEV-026 | `HISTORICAL_ONLY` |
| 22 | DEV-022 | `EXPERIMENTAL_KEEP` |
| 23 | DEV-023 | `EXPERIMENTAL_KEEP` |
| 24 | DEV-026 | `HISTORICAL_ONLY` |
| 25 | DEV-024 | `ABSORB_INTO_SAAS_PROGRAM` |
| 26 | DEV-025 | `EXPERIMENTAL_KEEP` |

## Classification gate

```text
P0_3_DEVELOPMENT_LEDGER = PASS
P0_4_ORPHAN_DISCOVERY = PASS
P0_5_PRIMARY_CLASSIFICATION = PASS

UNACCOUNTED_DEVELOPMENT != 0
```

The final invariant remains open because retained component-review lanes have
not yet been integrated, preserved under final references, or formally closed.

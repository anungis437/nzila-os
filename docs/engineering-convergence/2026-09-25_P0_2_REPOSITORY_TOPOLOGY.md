# P0.2 Repository Topology Snapshot

**Captured:** 2026-09-25T01:09:37Z
**Authoritative baseline:** `origin/main` at `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`

This is a read-only engineering-estate census. It records Git topology and
working-copy state without assigning final value or deletion authority.

## Census

| Surface | Count |
| --- | ---: |
| Local branches | 42 |
| Remote feature refs | 35 |
| Worktrees | 29 |
| Dirty worktrees | 13 |
| Clean worktrees | 16 |
| Stashes | 27 |
| Open pull requests | 22 |
| Commits off `origin/main` across recorded refs | 394 |
| Commits reachable only from local refs | 279 |
| Commits reachable only from remote refs | 81 |

The commit-set counts are object-reachability measurements. Squash merges can
leave a feature tip outside `main` even when its effective change was merged;
P0.3 must inspect content before assigning a disposition.

## Local branches

| Branch | Head | Upstream | Track | Ahead | Behind | Tip ancestor of main |
| --- | --- | --- | --- | ---: | ---: | --- |
| chore/ue-wave1-staging-fixtures | `9549d6f7133bf3a011d697eda0494a86d9740065` |  |  | 1 | 17 | no |
| chore/windows-lint-staged-fix | `053ab0bce3f604970cd8a87cdeecf6606393b5d8` | origin/chore/windows-lint-staged-fix | [gone] | 1 | 178 | no |
| codex/b005-version-truth | `e9a87c48342c1655693ab68c5d9398974a507f84` |  |  | 1 | 8 | no |
| codex/pre-align-20260904-87a5e429 | `87a5e429965816c8a6eb619f87936df2bd8cecd8` |  |  | 11 | 108 | no |
| docs/cbc-ishmael-feedback-only-reviewer-packet | `89996e47506d1c83d26b5479e85c67cee8670392` | origin/docs/cbc-ishmael-feedback-only-reviewer-packet | [gone] | 0 | 176 | yes |
| docs/courtlens-refactor-phase0 | `70b327b8127ccd8859892befba5033999e9aec53` | origin/docs/courtlens-refactor-phase0 | [gone] | 3 | 178 | no |
| docs/courtlens-refactor-phase0-v2 | `c2cbf9eb341d41ae8bbe1ad4b2ab5d37cc65b8bb` | origin/docs/courtlens-refactor-phase0-v2 | [gone] | 7 | 178 | no |
| docs/courtlens-refactor-phase0-v3 | `432552fa990ac368d5783a92d0d16af197c5e8ea` |  |  | 7 | 177 | no |
| docs/engineering-estate-convergence | `bbc96b881f2ddede594c17571bd53ca1f893ecad` |  |  | 1 | 7 | no |
| docs/phase2-regression-correction-713 | `47ae2a003e26572a0979ac5e212f24f34244d7cf` | origin/docs/phase2-regression-correction-713 | [gone] | 0 | 126 | yes |
| docs/ue-runtime-acceptance | `5a054aec0478adb1974af520b67d0ae50ea4e3a7` | origin/docs/ue-runtime-acceptance | [gone] | 3 | 109 | no |
| feat/civic-oci-doctrine-integrity | `601398d34b8c58823bc43511d5c54f3b45fbccbb` | origin/feat/civic-oci-doctrine-integrity |  | 3 | 8 | no |
| feat/courtlens-phase1 | `da2cea6fe12d2610507167e2f5bf8f1831d7e8f2` | origin/feat/courtlens-phase1 | [gone] | 2 | 176 | no |
| fix/browserslist-high-20260901 | `02bdf38bc1443f1e21d09ce9f0b6ac51b37ec044` | origin/fix/browserslist-high-20260901 | [gone] | 1 | 109 | no |
| fix/ci-workbook-memory-holders-redteam-ops-snapshot | `f75e0d6d0b9e1ea73b75632595e33c48197e343b` | origin/fix/ci-workbook-memory-holders-redteam-ops-snapshot |  | 1 | 17 | no |
| fix/gitops-env-var-arguments | `8dfc71eaba84e6002b1f7f7258dca48158af64e1` | origin/fix/gitops-env-var-arguments |  | 0 | 3 | yes |
| fix/gitops-proof-fail-closed | `c2b7c138808679b31827b1ca548d02e61a803309` | origin/fix/gitops-proof-fail-closed |  | 0 | 1 | yes |
| fix/main-lockfile-drift | `9d207ed054bc10c907c16f8c87298fcb5e9ca550` | origin/fix/main-lockfile-drift | [gone] | 4 | 138 | no |
| fix/no-console-union-eyes-admin-users | `6c2c40620d00053f58d76e9eecbd4a7043cc2f00` | origin/fix/no-console-union-eyes-admin-users | [gone] | 0 | 128 | yes |
| fix/platform-admin-version-truth | `953862557cffda7f48b8ef925caaac63d6fdb7b3` | origin/fix/platform-admin-version-truth |  | 0 | 5 | yes |
| fix/pnpm-lock-immutable-override | `0d399b16e79b9747c1c3f0ac8a5b1ac2e3eb03a5` | origin/fix/pnpm-lock-immutable-override | [gone] | 1 | 138 | no |
| fix/ue-authoritative-release-baseline | `ff98963758de37255ae20cd13433c4c3b8a384b7` | origin/fix/ue-authoritative-release-baseline |  | 0 | 17 | yes |
| fix/ue-health-safety-v2-paths | `b71a31124069889c89bdd547b22b196e8dcb272d` | origin/fix/ue-health-safety-v2-paths | [gone] | 6 | 138 | no |
| fix/ue-runtime-rls-foundation | `4315b7bd7bc808bdd3765fe54cb9a576d5dfca8c` | origin/fix/ue-runtime-rls-foundation | [gone] | 73 | 108 | no |
| fix/ue-runtime-schema-authority-reconciliation | `b30798326afbb1ad24b72b33b2be5f300bd6023c` | origin/fix/ue-runtime-schema-authority-reconciliation |  | 9 | 17 | no |
| fix/union-eyes-continuity-inheritance-route-contract-guards | `439ca91c0008dfb314735d98bc71938830a62393` | origin/fix/union-eyes-continuity-inheritance-route-contract-guards | [gone] | 2 | 137 | no |
| fix/union-eyes-phase0b-clean | `11ac20821b4ce3bb050272704f09a1a7c226ca8f` | origin/fix/union-eyes-phase0b-clean | [gone] | 76 | 164 | no |
| fix/union-eyes-phase0c-e2e-stabilization | `58ee6f601833e929da5d046f362c6ea2df7efe4b` | origin/fix/union-eyes-phase0c-e2e-stabilization | [gone] | 127 | 164 | no |
| hotfix/fr-cta-locale-redirect | `df501cc11cfc72a39d33b5df32d44d3f3e7a18f5` |  |  | 0 | 18 | yes |
| integration/courtlens-gap3-product-line | `1d0388c25c5813476aaf07b87f2c2a5564a59cff` | origin/integration/courtlens-gap3-product-line | [gone] | 6 | 178 | no |
| liuna/continuation-post-gate-13 | `059ab8663cdf1e77990ff7585c79702ecb9d4c8a` | origin/liuna/continuation-post-gate-13 | [gone] | 13 | 138 | no |
| main | `09063f97258c576f55a61269ae2d6bf69d6da118` | origin/main | [behind 108] | 0 | 108 | yes |
| perf/gha-phase-1-5-composite-adoption | `a0b1c8eef9e234bd19642129c2eff5e39ed4ba3a` | origin/perf/gha-phase-1-5-composite-adoption | [gone] | 3 | 135 | no |
| perf/gha-phase-1-concurrency | `f43c47e0db7a164bb6e4fe96cef609caa2f078bf` | origin/perf/gha-phase-1-concurrency | [gone] | 4 | 136 | no |
| perf/gha-phase-2-bulk-composite | `51bb108dc08ed5eb3241fb1ae9f07e7cbc319250` | origin/perf/gha-phase-2-bulk-composite | [gone] | 1 | 134 | no |
| perf/gha-phase-3-concurrency-guards | `dae299038d21355abe524d69923518d5ecd6f8ff` | origin/perf/gha-phase-3-concurrency-guards | [gone] | 5 | 138 | no |
| perf/gha-phase-4-critical-path-analysis | `00eecd52230ff7feaa837b7d1f1b281996d8a0cf` | origin/perf/gha-phase-4-critical-path-analysis | [gone] | 12 | 138 | no |
| proof/courtlens-gap3-final | `f526f9c9bd1a17efabeae2a1417efc99938f376d` |  |  | 9 | 178 | no |
| repository-convergence-task | `b78deef74a69b2982aeff97054914a7249dfc2c6` |  |  | 0 | 9 | yes |
| workstream/ue-controlled-pilot-e2e | `85658c302ff9c4163e6ecf8c14fda361ab7945d4` |  |  | 135 | 162 | no |
| workstream/ue-controlled-pilot-foundation | `c95ccec793785b8f39bf5cadc36acc9b3d91f56a` | origin/main | [ahead 83, behind 162] | 83 | 162 | no |
| workstream/ue-runtime-schema-lineage-restoration | `72c1125190b790a5b6f43def739f846cf1cdb726` | origin/workstream/ue-runtime-schema-lineage-restoration |  | 23 | 17 | no |

## Remote feature refs

| Ref | Head | Ahead | Behind | Open PR |
| --- | --- | ---: | ---: | --- |
| origin/codex/gitops-proof-fail-closed | `c2b7c138808679b31827b1ca548d02e61a803309` | 0 | 1 | none |
| origin/dependabot/github_actions/trufflesecurity/trufflehog-3.97.5 | `77d738650c20bdd20ed06993a87e7ea28928fc20` | 1 | 30 | #785 |
| origin/dependabot/npm_and_yarn/apps/abr/npm_and_yarn-733802a986 | `1a22a5909f65f4b0b0fee2257980f3c34ad98362` | 1 | 32 | #779 |
| origin/dependabot/npm_and_yarn/axe-core-4.13.0 | `48b47e308a62dc0991effbab965b9111af996fc6` | 1 | 12 | #790 |
| origin/dependabot/npm_and_yarn/changesets/cli-3.0.3 | `58fcd96b4de68e318e5d4ac3e4de031e67c8bd79` | 1 | 12 | #793 |
| origin/dependabot/npm_and_yarn/dompurify-3.4.15 | `3ec748c954e6da944c07cfa2301adeea04f397e4` | 1 | 12 | #789 |
| origin/dependabot/npm_and_yarn/multi-6f3a9c90a1 | `0eb8113ea2c7d2f7dc71672066d2de7daa2296f4` | 1 | 12 | #792 |
| origin/dependabot/npm_and_yarn/opentelemetry/instrumentation-http-0.222.0 | `f5b3e6d13596ace928695128e6e25510b71c5a19` | 1 | 12 | #786 |
| origin/dependabot/npm_and_yarn/radix-ui/react-collapsible-1.1.20 | `edc0521c6fa65b17d8d9f9f2df713257b6ddb78f` | 1 | 12 | #787 |
| origin/dependabot/npm_and_yarn/tiptap/extension-image-3.31.3 | `bc6367f068f87376afdd843625068f285f5dbd4a` | 1 | 12 | #791 |
| origin/dependabot/npm_and_yarn/tiptap/extension-underline-3.31.3 | `5b03345eae228a1203817c69ec9310b3035e24a0` | 1 | 12 | #794 |
| origin/dependabot/npm_and_yarn/types/node-26.6.1 | `477156c16df37aeec2c130f4d048413a03d8c96a` | 1 | 12 | #788 |
| origin/dependabot/npm_and_yarn/vitest-5.0.1 | `6ca611d7c2be668c5d850182658bf8f8b9a3bd6c` | 1 | 12 | #778 |
| origin/dependabot/pip/packages/automation/filelock-gte-4.0.0 | `93910d6783426ddf45bfc4d0a18bd9e43ca687eb` | 1 | 30 | #781 |
| origin/dependabot/pip/packages/automation/pydantic-gte-2.13.5 | `5a28c79aa83f4d56a351ff360c73723e6796ab3e` | 1 | 30 | #783 |
| origin/dependabot/pip/packages/automation/pylint-gte-4.0.8 | `3c282fdb3cc0ddb704af7d1d1f18b5e164cebbd6` | 1 | 30 | #780 |
| origin/dependabot/pip/packages/automation/pytest-gte-9.1.1 | `aa95905440e9eae636aa11823d986af134575959` | 1 | 30 | #784 |
| origin/dependabot/pip/packages/automation/tqdm-gte-4.70.1 | `1d3bfe742bde2c0cd83240ea31ed4c801d933feb` | 1 | 30 | #782 |
| origin/devin/1790252515-docs-truth-convergence | `f4cd1690f00089070f91ee810343c343669475fc` | 5 | 8 | none |
| origin/docs/truth-convergence | `9b8aaa35602fcc94b4af92d94b3036a127ec0687` | 8 | 8 | #808 |
| origin/feat/civic-oci-doctrine-integrity | `601398d34b8c58823bc43511d5c54f3b45fbccbb` | 3 | 8 | none |
| origin/feat/civic-sage-omhra-pilot-readiness | `48b5b539f4e851b61e17a9c99b3de5ed5ddd90fa` | 4 | 9 | none |
| origin/fix/ci-workbook-memory-holders-redteam-ops-snapshot | `f75e0d6d0b9e1ea73b75632595e33c48197e343b` | 1 | 17 | #795 |
| origin/fix/dependency-audit-waiver-remediation | `29ac27e153c9e8922ea5fbcfdba0fa5772998c59` | 1 | 13 | none |
| origin/fix/gitops-env-var-arguments | `8dfc71eaba84e6002b1f7f7258dca48158af64e1` | 0 | 3 | none |
| origin/fix/gitops-proof-fail-closed | `c2b7c138808679b31827b1ca548d02e61a803309` | 0 | 1 | none |
| origin/fix/ops-documentation-pack-evidence-refresh | `f3d4109a95e88c1333c2835a163694855edb618e` | 1 | 13 | none |
| origin/fix/platform-admin-version-truth | `953862557cffda7f48b8ef925caaac63d6fdb7b3` | 0 | 5 | none |
| origin/fix/ue-authoritative-release-baseline | `ff98963758de37255ae20cd13433c4c3b8a384b7` | 0 | 17 | none |
| origin/fix/ue-runtime-schema-authority-reconciliation | `b30798326afbb1ad24b72b33b2be5f300bd6023c` | 9 | 17 | #796 |
| origin/fix/ue-runtime-schema-lineage-restoration | `3e9a0cf8431bf9c57333f48743f7cd0f851bd291` | 47 | 13 | #799 |
| origin/fix/union-eyes-e2e-rls-bootstrap-missing-tables | `421f1a365fef0842ed29c0b907187c874ece1cb8` | 1 | 13 | none |
| origin/fix/union-eyes-export-route-org-scope | `2efd82d1f53805a42c0cdf2ab4e61e117f94ac5d` | 1 | 13 | none |
| origin/hotfix/fr-cta-locale-redirect | `ff98963758de37255ae20cd13433c4c3b8a384b7` | 0 | 17 | none |
| origin/workstream/ue-runtime-schema-lineage-restoration | `72c1125190b790a5b6f43def739f846cf1cdb726` | 23 | 17 | #797 |

## Worktrees

| Path | Branch | Head | Staged | Modified | Untracked |
| --- | --- | --- | ---: | ---: | ---: |
| C:/APPS/nzila-automation | fix/ue-runtime-rls-foundation | `4315b7bd7bc808bdd3765fe54cb9a576d5dfca8c` | 0 | 13 | 3 |
| C:/APPS/nzila-automation/.kilo/worktrees/longing-dry | DETACHED | `67c2d557cfea18ac6cdf05b3e91fc97a37d0a35b` | 0 | 0 | 0 |
| C:/APPS/nzila-automation-phase0b-clean | fix/union-eyes-phase0b-clean | `11ac20821b4ce3bb050272704f09a1a7c226ca8f` | 0 | 0 | 0 |
| C:/APPS/nzila-automation-phase0c | fix/union-eyes-phase0c-e2e-stabilization | `58ee6f601833e929da5d046f362c6ea2df7efe4b` | 0 | 5 | 7 |
| C:/APPS/nzila-courtlens-phase0 | docs/courtlens-refactor-phase0-v3 | `432552fa990ac368d5783a92d0d16af197c5e8ea` | 0 | 0 | 0 |
| C:/APPS/nzila-gap3-baseline | DETACHED | `6b6d3736dd3692112690165823a0702e1b6deea9` | 0 | 0 | 0 |
| C:/APPS/nzila-gap3-final | proof/courtlens-gap3-final | `f526f9c9bd1a17efabeae2a1417efc99938f376d` | 0 | 18 | 0 |
| C:/APPS/nzila-gap3-proof | DETACHED | `d7adb10ff45f252d27c61f39e99c4ccfb809b04a` | 0 | 18 | 3 |
| C:/APPS/nzila-os-origin-main | repository-convergence-task | `b78deef74a69b2982aeff97054914a7249dfc2c6` | 0 | 8 | 4 |
| C:/APPS/nzila-pr673-az5-reconcile | DETACHED | `09063f97258c576f55a61269ae2d6bf69d6da118` | 0 | 0 | 0 |
| C:/APPS/nzila-pr673-forensics | DETACHED | `1160f9d828b705613e67dd3f5c152cbbe4f62bbc` | 0 | 1 | 0 |
| C:/APPS/nzila-pr673-parent-ui-forensics | DETACHED | `edf78a1d17b6ce4285d1c78d6a8e1f2e6371c120` | 0 | 0 | 0 |
| C:/APPS/nzila-pr752-round31 | DETACHED | `4e2a6fcb7af977a7db21aee5124bd2b246f4b45f` | 0 | 0 | 0 |
| C:/APPS/nzila-ue-authoritative-baseline | fix/ci-workbook-memory-holders-redteam-ops-snapshot | `f75e0d6d0b9e1ea73b75632595e33c48197e343b` | 0 | 12 | 28 |
| C:/APPS/nzila-ue-authoritative-baseline/.kilo/worktrees/coal-nickel | DETACHED | `ff98963758de37255ae20cd13433c4c3b8a384b7` | 0 | 0 | 0 |
| C:/APPS/nzila-ue-runtime-schema-lineage | workstream/ue-runtime-schema-lineage-restoration | `72c1125190b790a5b6f43def739f846cf1cdb726` | 0 | 0 | 49 |
| C:/APPS/nzila-ue-schema-reconcile | fix/ue-runtime-schema-authority-reconciliation | `b30798326afbb1ad24b72b33b2be5f300bd6023c` | 0 | 0 | 0 |
| C:/APPS/nzila-ue-staging-reconstitution | DETACHED | `b30798326afbb1ad24b72b33b2be5f300bd6023c` | 0 | 0 | 0 |
| C:/APPS/nzila-ue-wave1-fixtures | chore/ue-wave1-staging-fixtures | `9549d6f7133bf3a011d697eda0494a86d9740065` | 0 | 0 | 0 |
| C:/APPS/nzila-ws-ue-e2e | workstream/ue-controlled-pilot-e2e | `85658c302ff9c4163e6ecf8c14fda361ab7945d4` | 0 | 11 | 12 |
| C:/APPS/nzila-ws-ue-foundation | workstream/ue-controlled-pilot-foundation | `c95ccec793785b8f39bf5cadc36acc9b3d91f56a` | 0 | 0 | 0 |
| C:/Users/AubertNungisa/.codex/worktrees/b005-version-truth/nzila-ue-authoritative-baseline | codex/b005-version-truth | `e9a87c48342c1655693ab68c5d9398974a507f84` | 0 | 11 | 0 |
| C:/Users/AubertNungisa/.codex/worktrees/civic-oci-doctrine-integrity/nzila-ue-authoritative-baseline | feat/civic-oci-doctrine-integrity | `601398d34b8c58823bc43511d5c54f3b45fbccbb` | 0 | 0 | 0 |
| C:/Users/AubertNungisa/.codex/worktrees/gitops-proof-fail-closed/nzila-ue-authoritative-baseline | fix/gitops-proof-fail-closed | `c2b7c138808679b31827b1ca548d02e61a803309` | 0 | 0 | 0 |
| C:/Users/AubertNungisa/.codex/worktrees/orchestrator-env-deploy-fix/nzila-ue-authoritative-baseline | fix/gitops-env-var-arguments | `8dfc71eaba84e6002b1f7f7258dca48158af64e1` | 0 | 17 | 0 |
| C:/Users/AubertNungisa/.codex/worktrees/platform-admin-version-truth-convergence/nzila-ue-authoritative-baseline | fix/platform-admin-version-truth | `953862557cffda7f48b8ef925caaac63d6fdb7b3` | 0 | 0 | 2 |
| C:/Users/AubertNungisa/.codex/worktrees/saas-activation-foundation/nzila-ue-authoritative-baseline | docs/engineering-estate-convergence | `bbc96b881f2ddede594c17571bd53ca1f893ecad` | 0 | 1 | 2 |
| C:/Users/AubertNungisa/.codex/worktrees/ue-staging-reconstitution/nzila-ue-authoritative-baseline | DETACHED | `b30798326afbb1ad24b72b33b2be5f300bd6023c` | 0 | 0 | 0 |
| C:/Users/AubertNungisa/AppData/Local/Temp/nzila-zonga-e505b621 | DETACHED | `e505b621e5fc2e610fedf5644fa876a520a1e535` | 0 | 0 | 0 |

## Dirty worktree paths

### C:/APPS/nzila-automation

```text
 M apps/union-eyes/app/api/__tests__/payments-stripe-webhook.route.test.ts
 M apps/union-eyes/app/api/__tests__/workbook-id-claim.route.test.ts
 M apps/union-eyes/app/api/payments/webhooks/stripe/route.ts
 M apps/union-eyes/app/api/workbook/[id]/claim/route.ts
 M apps/union-eyes/app/api/workbook/[id]/memory-holders/[holderId]/route.ts
 M apps/union-eyes/app/api/workbook/[id]/memory-holders/route.ts
 M apps/union-eyes/db/migrations-cache/meta/_journal.json
 M reports/union-eyes-authority-convergence-report.json
 M reports/union-eyes-authority-convergence-report.md
 M reports/union-eyes-explicit-grant-dry-run.json
 M reports/union-eyes-explicit-grant-dry-run.md
 M reports/union-eyes-public-schema-grant-census.json
 M reports/union-eyes-public-schema-grant-census.md
?? apps/union-eyes/app/api/__tests__/workbook-memory-holders.route.test.ts
?? apps/union-eyes/db/__tests__/workbook-claim-credentials-migration-governance.test.ts
?? apps/union-eyes/db/migrations-cache/0006_protect_workbook_claim_credentials.sql
```

### C:/APPS/nzila-automation-phase0c

```text
 M apps/union-eyes/next-env.d.ts
 M ops/outputs/data-residency-runtime.json
 M ops/outputs/governance-runtime-budget.json
 M ops/outputs/onboarding-kpis.json
 M ops/outputs/strategic-resilience-report.json
?? apps/union-eyes/{}
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724044841_f2dc14/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724062400_98fd88/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724063108_97d868/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724064034_14e83f/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725001436_84ca63/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260725153606_a6491d/
```

### C:/APPS/nzila-gap3-final

```text
 M artifacts/courtlens-gap3-fixture/cleanup-report.json
 M docs/documentation-index.md
 M docs/ops/ownership-registry.md
 M docs/ops/release-governance/release-governance-audit.md
 M ops/outputs/data-residency-runtime.json
 M ops/outputs/governance-runtime-budget.json
 M ops/outputs/onboarding-kpis.json
 M ops/outputs/strategic-resilience-report.json
 M reports/doc-consistency.json
 M reports/doc-consistency.md
 M reports/documentation-index.json
 M reports/ownership-registry.json
 M reports/release-governance-audit.json
 M reports/release-secret-audit.json
 M reports/repo-excellence-audit.json
 M reports/repo-excellence-audit.md
 M scripts/gap3/generate-manifest.py
 M scripts/gap3/patch-ledger.py
```

### C:/APPS/nzila-gap3-proof

```text
 M apps/abr/next-env.d.ts
 M artifacts/courtlens-gap3-closure/final-closure-report.json
 M artifacts/courtlens-gap3-fixture/cleanup-report.json
 M docs/documentation-index.md
 M docs/ops/ownership-registry.md
 M docs/ops/release-governance/release-governance-audit.md
 M ops/outputs/data-residency-runtime.json
 M ops/outputs/governance-runtime-budget.json
 M ops/outputs/onboarding-kpis.json
 M ops/outputs/strategic-resilience-report.json
 M reports/doc-consistency.json
 M reports/doc-consistency.md
 M reports/documentation-index.json
 M reports/ownership-registry.json
 M reports/release-governance-audit.json
 M reports/release-secret-audit.json
 M reports/repo-excellence-audit.json
 M reports/repo-excellence-audit.md
?? artifacts/courtlens-gap3-browser/
?? artifacts/courtlens-gap3-closure/artifact-manifest.json
?? artifacts/courtlens-gap3-closure/final/
```

### C:/APPS/nzila-os-origin-main

```text
 M ARCHITECTURE.md
 D AWS_ZONGA_SETUP.md
 D PHASE_2_AUDIT_STRATEGY.md
 D PHASE_2_FINDINGS_LEDGER.md
 D README.business.md
 M README.md
 M docs/INDEX.md
 M docs/categories/stakeholders/buyers/PORTFOLIO_OVERVIEW.md
?? docs/categories/historical-archive/archive/AWS_ZONGA_SETUP.md
?? docs/categories/historical-archive/archive/README.business.md
?? docs/categories/historical-archive/archive/audit-reports/PHASE_2_AUDIT_STRATEGY.md
?? docs/categories/historical-archive/archive/audit-reports/PHASE_2_FINDINGS_LEDGER.md
```

### C:/APPS/nzila-pr673-forensics

```text
 M ops/outputs/dora-metrics.json
```

### C:/APPS/nzila-ue-authoritative-baseline

```text
 M .github/workflows/e2e.yml
 M apps/union-eyes/app/[locale]/continuity-assessment/results/[id]/page.tsx
 M apps/union-eyes/app/[locale]/organizational-continuity-risk/page.tsx
 M apps/union-eyes/components/icra/ConsentGate.tsx
 M docs/union-eyes/README.md
 M reports/doc-consistency.json
 M reports/doc-consistency.md
 M reports/union-eyes-capability-inventory.json
 M reports/union-eyes-capability-inventory.md
 M reports/union-eyes-public-schema-grant-census.json
 M reports/union-eyes-public-schema-grant-census.md
 M tooling/scripts/restore-union-eyes-snapshot.mjs
?? .github/workflows/publish-canonical-snapshot.yml
?? acr-counts.ps1
?? acr-delete-list.txt
?? acr-fullcleanup-dryrun.ps1
?? acr-fullcleanup-execute.ps1
?? acr-purge.ps1
?? acr-validate.ps1
?? apps/union-eyes/app/[locale]/civic/
?? apps/union-eyes/app/[locale]/methodology/
?? apps/union-eyes/scripts/__tests__/runtime-schema-authority-oracle.test.ts
?? apps/union-eyes/scripts/__tests__/seed-wave1-staging.test.ts
?? apps/union-eyes/scripts/generate-runtime-schema-authority-oracle.ts
?? apps/union-eyes/scripts/seed-wave1-staging.ts
?? apps/union-eyes/scripts/wave1-acceptance-probe.ts
?? apps/union-eyes/scripts/wave1-runtime-probe.ts
?? apps/union-eyes/scripts/wave1-schema-diff.ts
?? apps/union-eyes/scripts/wave1-schema-expectations.ts
?? docs/union-eyes/packs/
?? docs/union-eyes/reality-remediation/29_PHASE0_ENVIRONMENT_COMMISSIONING_RUNBOOK.md
?? ops/drift/version-drift-staging-1790279314609.json
?? ops/drift/version-drift-staging-latest.json
?? reports/union-eyes-runtime-schema-authority-oracle.json
?? reports/union-eyes-runtime-schema-authority-oracle.md
?? reports/union-eyes/
?? ue-census.ps1
?? ue-protected-digests.ps1
?? ue-verify-digests.ps1
?? web-cost-check.ps1
```

### C:/APPS/nzila-ue-runtime-schema-lineage

```text
?? `0`]
?? artifacts/ue-canonical-snapshots/
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_AUTH_PATH_CORRECTION.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_DISPOSITION.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_EVIDENCE.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_EVIDENCE.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_EXTERNAL_SPECIALIST_EXECUTOR_SUMMARY.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_EXTERNAL_SPECIALIST_MATRIX.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_EXTERNAL_SPECIALIST_MATRIX.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PARENT_SUMMARY.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_CLOSURE_COMPLETE.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_CLOSURE_PLAN.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_GOVERNANCE_PACKET.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_GOVERNANCE_PACKET.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_REDISPOSITION_APPLIED.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_REDISPOSITION_APPLIED.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_REDISPOSITION_DRAFT.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_REDISPOSITION_DRAFT.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_ROLLBACK_SUPPORT_SIGNOFF.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PILOT_ROLLBACK_SUPPORT_SIGNOFF.md
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PRIMARY_AUTH_EXECUTOR_SUMMARY.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PRIMARY_AUTH_PROOF.json
?? reports/union-eyes/runtime-schema-lineage/PHASE_H_PRIMARY_AUTH_PROOF.md
?? reports/union-eyes/runtime-schema-lineage/PILOT_EVIDENCE_REVIEW_TEMPLATE.md
?? reports/union-eyes/runtime-schema-lineage/PILOT_EXECUTION_DAY0.json
?? reports/union-eyes/runtime-schema-lineage/PILOT_EXECUTION_DAY0.md
?? reports/union-eyes/runtime-schema-lineage/PILOT_INCIDENT_LOG.json
?? reports/union-eyes/runtime-schema-lineage/PILOT_INCIDENT_LOG.md
?? reports/union-eyes/runtime-schema-lineage/PILOT_OPERATIONAL_STATE.json
?? reports/union-eyes/runtime-schema-lineage/PILOT_OPERATIONAL_STATE.md
?? reports/union-eyes/runtime-schema-lineage/PILOT_PREFLIGHT_DISPOSITION.md
?? reports/union-eyes/runtime-schema-lineage/PILOT_PREFLIGHT_EVIDENCE.json
?? reports/union-eyes/runtime-schema-lineage/PILOT_PREFLIGHT_EVIDENCE.md
?? reports/union-eyes/runtime-schema-lineage/PILOT_PREFLIGHT_WORKFLOW_RAW.json
?? reports/union-eyes/runtime-schema-lineage/_classify_checks.py
?? reports/union-eyes/runtime-schema-lineage/_parse_checks.py
?? reports/union-eyes/runtime-schema-lineage/_phase_h_check_classification.txt
?? reports/union-eyes/runtime-schema-lineage/_phase_h_check_runs.json
?? reports/union-eyes/runtime-schema-lineage/_phase_h_checks.json
?? reports/union-eyes/runtime-schema-lineage/_phase_h_checks_summary.txt
?? reports/union-eyes/runtime-schema-lineage/_phase_h_external_specialist_matrix.mjs
?? reports/union-eyes/runtime-schema-lineage/_phase_h_main_checks.json
?? reports/union-eyes/runtime-schema-lineage/_phase_h_raw_evidence.txt
?? reports/union-eyes/runtime-schema-lineage/_pilot_preflight_workflows.mjs
?? reports/union-eyes/runtime-schema-lineage/_transfer.b64
?? reports/union-eyes/runtime-schema-lineage/_write_phase_h.py
?? reports/union-eyes/runtime-schema-lineage/_write_phase_h_final.py
?? reports/union-eyes/runtime-schema-lineage/_xfer_parts/
?? scripts/_snap_parse_cleanroom.py
```

### C:/APPS/nzila-ws-ue-e2e

```text
 M apps/union-eyes/e2e/a11y/smoke.spec.ts
 M apps/union-eyes/e2e/helpers/auth.ts
 M apps/union-eyes/e2e/helpers/role-fixtures.ts
 M apps/union-eyes/e2e/permission-boundaries.spec.ts
 M apps/union-eyes/lib/dashboard/role-experience.ts
 M apps/union-eyes/lib/services/cache-service.ts
 M apps/union-eyes/next.config.ts
 M apps/union-eyes/scripts/lifecycle/run.ts
 M package.json
 M pnpm-lock.yaml
 M tooling/sql/union-eyes-qa-baseline.sql
?? apps/union-eyes/lib/dashboard/role-experience.test.ts
?? ops/ue-cognition/kpi-snapshots/kpi_msbkntcu_4a3636de90e7.json
?? ops/ue-cognition/kpi-snapshots/kpi_msbko5q4_686ccb4ba782.json
?? ops/ue-cognition/kpi-snapshots/kpi_msbnhg84_c1c085e7f13f.json
?? ops/ue-cognition/kpi-snapshots/kpi_msbnhsn4_f0de4c842f0e.json
?? ops/ue-cognition/kpi-snapshots/kpi_msbtdi8a_63624a3e7a0f.json
?? ops/ue-cognition/kpi-snapshots/kpi_msbtdvpj_706efcf3d1f6.json
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260802031429_479470/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260802050853_ccf5e5/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260802073507_78c4f3/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260802085513_687080/
?? reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260802101413_c12955/
```

### C:/Users/AubertNungisa/.codex/worktrees/b005-version-truth/nzila-ue-authoritative-baseline

```text
 M docs/documentation-index.md
 M docs/ops/ownership-registry.md
 M docs/ops/release-governance/release-governance-audit.md
 M reports/doc-consistency.json
 M reports/doc-consistency.md
 M reports/documentation-index.json
 M reports/ownership-registry.json
 M reports/release-governance-audit.json
 M reports/release-secret-audit.json
 M reports/repo-excellence-audit.json
 M reports/repo-excellence-audit.md
```

### C:/Users/AubertNungisa/.codex/worktrees/orchestrator-env-deploy-fix/nzila-ue-authoritative-baseline

```text
 M docs/documentation-index.md
 M docs/ops/ownership-registry.md
 M docs/ops/release-governance/release-governance-audit.md
 M reports/doc-consistency.json
 M reports/doc-consistency.md
 M reports/documentation-index.json
 M reports/ownership-registry.json
 M reports/release-governance-audit.json
 M reports/release-secret-audit.json
 M reports/repo-excellence-audit.json
 M reports/repo-excellence-audit.md
 M reports/union-eyes-authority-convergence-report.json
 M reports/union-eyes-authority-convergence-report.md
 M reports/union-eyes-explicit-grant-dry-run.json
 M reports/union-eyes-explicit-grant-dry-run.md
 M reports/union-eyes-public-schema-grant-census.json
 M reports/union-eyes-public-schema-grant-census.md
```

### C:/Users/AubertNungisa/.codex/worktrees/platform-admin-version-truth-convergence/nzila-ue-authoritative-baseline

```text
?? ops/drift/version-drift-staging-1790279335997.json
?? ops/drift/version-drift-staging-latest.json
```

### C:/Users/AubertNungisa/.codex/worktrees/saas-activation-foundation/nzila-ue-authoritative-baseline

```text
 M docs/engineering-convergence/2026-09-24_PRE_PHASE_0_CONVERGENCE.md
?? docs/engineering-convergence/2026-09-25_P0_2_REPOSITORY_TOPOLOGY.md
?? tooling/scripts/engineering-estate-topology.ps1
```

## Stashes

| Stash | Object | Timestamp | Description |
| --- | --- | --- | --- |
| stash@{0} | `640811d3316cfb5c7114cd73fc0fb555b0f4edb0` | 2026-09-04 17:08:30 -0400 | On fix/ue-runtime-rls-foundation: codex-pre-round40-report-drift-20260904 |
| stash@{1} | `c4cbd6413592b91e7832b9e45e90d8b9aa27a046` | 2026-09-04 16:07:36 -0400 | On fix/ue-runtime-rls-foundation: codex-pre-align-inventory-20260904 |
| stash@{2} | `00f19295698acadabb93cf67217dfbc723b5ee7a` | 2026-08-27 09:08:07 -0400 | On (no branch): preserve pre-existing ops output edits before syncing to main |
| stash@{3} | `e112d1f7cfa344946c7ff9f7cebb65ab2184c1dd` | 2026-08-25 18:09:37 -0400 | On fix/union-eyes-reality-remediation: pre-reconciliation snapshot 2026-08-25 HEAD=72c0d134e |
| stash@{4} | `646a115815ac9bb34da341e79ef3b8ad6c2ea96e` | 2026-08-03 20:51:44 -0400 | On fix/union-eyes-reality-remediation: gate-artifacts-pre-rebase-20260803-205142 |
| stash@{5} | `8c1670c50f55e216120cb03626b9724b88d6a079` | 2026-07-19 12:43:18 -0400 | On docs/courtlens-refactor-phase0-v3: phase0-worktree-pre-rebase-653 |
| stash@{6} | `291ff3000fb0355583c3f49da718adbf70153fdb` | 2026-07-18 23:51:42 -0400 | On docs/courtlens-refactor-phase0: phase0-v1-post-push-drift |
| stash@{7} | `5063c36b6e7bed4f215aa264d79e37b340c975cd` | 2026-05-18 17:04:22 -0400 | WIP on feat/waves-6-11-governance-trust-center: 2134e596a fix(e2e): replace isVisible() with toBeVisible() in cape-features spec |
| stash@{8} | `569cdf38954258107a40f8e131516802d491851a` | 2026-05-18 14:47:37 -0400 | WIP on main: a71d75435 fix(trust-center): correct evidence artifact paths, reach 100% coverage |
| stash@{9} | `9707b878e265fa1158e18bdfcf96479b1792fe53` | 2026-05-11 02:28:33 -0500 | On fix/ue-cape-features-lint-and-click: wip-bicep-zone-redundant |
| stash@{10} | `a16bbf315064d85ae33ec969303f736d308701f2` | 2026-05-10 20:21:15 -0500 | On feat/trustcore-trust-ops-v1: pre-main-cleanup-2026-05-10-pass2 |
| stash@{11} | `367d15a3fc5fc862394527c1e88b4b3c587eb213` | 2026-05-10 20:20:21 -0500 | On feat/trustcore-trust-ops-v1: pre-main-cleanup-2026-05-10 |
| stash@{12} | `85f555edc77e3685174aac6094bf94bb8780710e` | 2026-05-09 18:28:45 -0400 | On feat/ue-runtime-convergence: wip-pre-runtime-integrity |
| stash@{13} | `fef79938a65517b3ba58a963c844be79396ff59f` | 2026-05-09 15:38:04 -0400 | On feat/ue-runtime-convergence: in-progress-prior-session-deletions-and-edits |
| stash@{14} | `e66595e4d719dc8801420e5d184490c3287afa51` | 2026-05-07 10:27:16 -0400 | On fix/health-route-alignment-and-test-stability: wip: platform-admin entity-graph (carry across branches) |
| stash@{15} | `bb49762b1afdd847dde90505b7266db1d94378e7` | 2026-05-06 22:07:40 -0400 | WIP on fix/health-route-alignment-and-test-stability: 361639c0b fix: add @nzila/db to root deps and apply platform migration in CI |
| stash@{16} | `37186cfff355c4be081ba4646e950ce2a47493fc` | 2026-05-06 13:43:11 -0400 | On fix/health-route-alignment-and-test-stability: wip: trustcore and auth changes before lockfile hotfix |
| stash@{17} | `0a0684be54b51bad4c19e08b4f30bae2eb2c3f51` | 2026-04-30 19:27:53 -0400 | On main: wip: local ga report changes |
| stash@{18} | `7861f69eba8cf48b5b614db0d9c6414f9e566a12` | 2026-04-25 13:03:04 -0400 | On main: post-merge local next-env sync |
| stash@{19} | `5387ea1e8d962e9ac959b3b4265d05e8189522f1` | 2026-04-23 15:38:26 -0400 | On main: copilot-pre-sync-wip |
| stash@{20} | `664e1a7ae4ae787f17c23043ca5d7f6eac5a1bcd` | 2026-04-20 16:03:10 -0400 | WIP on feat/e2e-ci-workflow: fdb660cb fix: Make predictive DORA signal enforcement optional |
| stash@{21} | `453e749adc24bcc343bcabc3180432afe1e5b2fc` | 2026-04-17 10:44:17 -0400 | On main: chore-proxy-build-copy |
| stash@{22} | `91316f86bd025760222e5af9dc804408922f3893` | 2026-04-10 19:31:03 -0400 | On chore/repo-cleanup-hardening: pre-cleanup backup after merged PR 317 |
| stash@{23} | `b7f003efec8e907ed40add963c43ba76b3557d81` | 2026-04-01 16:24:27 -0400 | On main: all-pending-changes |
| stash@{24} | `c727a2bf9eb57d5c7ca2d3f35296e5e9cd6e778a` | 2026-02-28 10:28:36 -0500 | WIP on main: df1c2fb0 Merge pull request #103 from anungis437/feat/platform-dominance-train |
| stash@{25} | `762d1565bcfad18ba141332ecd9c042451c5d669` | 2026-02-22 22:01:47 -0500 | WIP on feat/ue-wire-pages-to-api: 1cf1ead feat(ue): replace mock data with real API calls across 15 dashboard pages |
| stash@{26} | `888dae2a4a4396282ae6b25bdf9a1be2eed48e53` | 2026-02-22 21:26:01 -0500 | WIP on fix/ue-v2-ts-nocheck-removal: abe1f37 fix(union-eyes): remove @ts-nocheck from 21 v2 routes, fix imports across 58 files |

## Open pull requests

| PR | Head | SHA | Draft | Mergeability | Merge state | Owner | Title |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| [#808](https://github.com/anungis437/nzila-os/pull/808) | docs/truth-convergence | `9b8aaa35602fcc94b4af92d94b3036a127ec0687` | False | MERGEABLE | UNSTABLE | app/devin-ai-integration | docs: repository truth and documentation convergence (replaces #807) |
| [#799](https://github.com/anungis437/nzila-os/pull/799) | fix/ue-runtime-schema-lineage-restoration | `3e9a0cf8431bf9c57333f48743f7cd0f851bd291` | False | CONFLICTING | DIRTY | anungis437 | fix(mainline): UE lineage restoration + green-gate remediations (supersedes #797) |
| [#797](https://github.com/anungis437/nzila-os/pull/797) | workstream/ue-runtime-schema-lineage-restoration | `72c1125190b790a5b6f43def739f846cf1cdb726` | False | CONFLICTING | DIRTY | anungis437 | ue: runtime schema lineage restoration — Phase G PASS + canonical snapshot |
| [#796](https://github.com/anungis437/nzila-os/pull/796) | fix/ue-runtime-schema-authority-reconciliation | `b30798326afbb1ad24b72b33b2be5f300bd6023c` | False | MERGEABLE | UNSTABLE | anungis437 | Union Eyes canonical runtime schema convergence (Phase D/E oracle + F convergence) |
| [#795](https://github.com/anungis437/nzila-os/pull/795) | fix/ci-workbook-memory-holders-redteam-ops-snapshot | `f75e0d6d0b9e1ea73b75632595e33c48197e343b` | False | CONFLICTING | DIRTY | anungis437 | fix(ci): align workbook memory-holder tests, red-team allowlist, ops snapshot |
| [#794](https://github.com/anungis437/nzila-os/pull/794) | dependabot/npm_and_yarn/tiptap/extension-underline-3.31.3 | `5b03345eae228a1203817c69ec9310b3035e24a0` | False | MERGEABLE | CLEAN | app/dependabot | chore(deps): bump @tiptap/extension-underline from 3.22.1 to 3.31.3 |
| [#793](https://github.com/anungis437/nzila-os/pull/793) | dependabot/npm_and_yarn/changesets/cli-3.0.3 | `58fcd96b4de68e318e5d4ac3e4de031e67c8bd79` | False | MERGEABLE | CLEAN | app/dependabot | chore(deps-dev): bump @changesets/cli from 2.30.0 to 3.0.3 |
| [#792](https://github.com/anungis437/nzila-os/pull/792) | dependabot/npm_and_yarn/multi-6f3a9c90a1 | `0eb8113ea2c7d2f7dc71672066d2de7daa2296f4` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): bump multer and @types/multer |
| [#791](https://github.com/anungis437/nzila-os/pull/791) | dependabot/npm_and_yarn/tiptap/extension-image-3.31.3 | `bc6367f068f87376afdd843625068f285f5dbd4a` | False | MERGEABLE | CLEAN | app/dependabot | chore(deps): bump @tiptap/extension-image from 3.22.1 to 3.31.3 |
| [#790](https://github.com/anungis437/nzila-os/pull/790) | dependabot/npm_and_yarn/axe-core-4.13.0 | `48b47e308a62dc0991effbab965b9111af996fc6` | False | MERGEABLE | CLEAN | app/dependabot | chore(deps-dev): bump axe-core from 4.11.2 to 4.13.0 |
| [#789](https://github.com/anungis437/nzila-os/pull/789) | dependabot/npm_and_yarn/dompurify-3.4.15 | `3ec748c954e6da944c07cfa2301adeea04f397e4` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): bump dompurify from 3.4.14 to 3.4.15 |
| [#788](https://github.com/anungis437/nzila-os/pull/788) | dependabot/npm_and_yarn/types/node-26.6.1 | `477156c16df37aeec2c130f4d048413a03d8c96a` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps-dev): bump @types/node from 20.19.40 to 26.6.2 |
| [#787](https://github.com/anungis437/nzila-os/pull/787) | dependabot/npm_and_yarn/radix-ui/react-collapsible-1.1.20 | `edc0521c6fa65b17d8d9f9f2df713257b6ddb78f` | False | MERGEABLE | CLEAN | app/dependabot | chore(deps): bump @radix-ui/react-collapsible from 1.1.12 to 1.1.20 |
| [#786](https://github.com/anungis437/nzila-os/pull/786) | dependabot/npm_and_yarn/opentelemetry/instrumentation-http-0.222.0 | `f5b3e6d13596ace928695128e6e25510b71c5a19` | False | MERGEABLE | CLEAN | app/dependabot | chore(deps): bump @opentelemetry/instrumentation-http from 0.217.0 to 0.222.0 |
| [#785](https://github.com/anungis437/nzila-os/pull/785) | dependabot/github_actions/trufflesecurity/trufflehog-3.97.5 | `77d738650c20bdd20ed06993a87e7ea28928fc20` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): bump trufflesecurity/trufflehog from 3.94.2 to 3.97.5 |
| [#784](https://github.com/anungis437/nzila-os/pull/784) | dependabot/pip/packages/automation/pytest-gte-9.1.1 | `aa95905440e9eae636aa11823d986af134575959` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): update pytest requirement from >=8.0.0 to >=9.1.1 in /packages/automation |
| [#783](https://github.com/anungis437/nzila-os/pull/783) | dependabot/pip/packages/automation/pydantic-gte-2.13.5 | `5a28c79aa83f4d56a351ff360c73723e6796ab3e` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): update pydantic requirement from >=2.13.3 to >=2.13.5 in /packages/automation |
| [#782](https://github.com/anungis437/nzila-os/pull/782) | dependabot/pip/packages/automation/tqdm-gte-4.70.1 | `1d3bfe742bde2c0cd83240ea31ed4c801d933feb` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): update tqdm requirement from >=4.67.3 to >=4.70.1 in /packages/automation |
| [#781](https://github.com/anungis437/nzila-os/pull/781) | dependabot/pip/packages/automation/filelock-gte-4.0.0 | `93910d6783426ddf45bfc4d0a18bd9e43ca687eb` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): update filelock requirement from >=3.20.3 to >=4.0.0 in /packages/automation |
| [#780](https://github.com/anungis437/nzila-os/pull/780) | dependabot/pip/packages/automation/pylint-gte-4.0.8 | `3c282fdb3cc0ddb704af7d1d1f18b5e164cebbd6` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): update pylint requirement from >=3.0.0 to >=4.0.8 in /packages/automation |
| [#779](https://github.com/anungis437/nzila-os/pull/779) | dependabot/npm_and_yarn/apps/abr/npm_and_yarn-733802a986 | `1a22a5909f65f4b0b0fee2257980f3c34ad98362` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps): bump the npm_and_yarn group across 29 directories with 2 updates |
| [#778](https://github.com/anungis437/nzila-os/pull/778) | dependabot/npm_and_yarn/vitest-5.0.1 | `6ca611d7c2be668c5d850182658bf8f8b9a3bd6c` | False | MERGEABLE | UNSTABLE | app/dependabot | chore(deps-dev): bump vitest from 3.2.7 to 4.1.11 |

## P0.2 disposition

```text
REPOSITORY_TOPOLOGY_CAPTURED = PASS
ESTATE_CLASSIFICATION = NOT YET COMPLETE
UNACCOUNTED_DEVELOPMENT != 0
SAAS_ACTIVATION = PAUSED
```

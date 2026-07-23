Supersedes #653 (auto-closed when its base branch `integration/courtlens-gap3-product-line-v2` was deleted by the squash-merge of #652).

Rebased onto `main` (@ 117442af8). Docs-only + tooling scope — implementation commits that overlapped with #652 were dropped during rebase; only the 5 Phase 0 planning/reporting commits remain.

## Contents (5 commits)

- `f68869b4f` docs(courtlens): Phase 0 v3 planning artifacts
- `5df0980fe` docs(courtlens): add Phase 0 v3 scope-report
- `7b1d10656` chore(courtlens,docs,gov): regenerate baselines from phase0-v3 HEAD
- `ee750a04e` chore(courtlens): three-way test:fast differential (main/int-v2/phase0-v3)
- `3e8b39c0c` chore(courtlens): reconcile scope-report vs PR #653 file list

## Scope

Docs, planning artifacts, reporting scripts, and reconciled inventory only. No product or contract-test changes. Pre-push contract-tests: **9435/9435 pass** (269s).

# Repo Excellence Audit

Generated: 2026-08-01T21:52:07.415Z

Overall score: 7.8 / 10

## Category Scores

| Category | Score |
| --- | ---: |
| runtime_proof | 8 |
| duplication | 8 |
| script_sprawl | 2.1 |
| hidden_fragility | 8 |
| docs_truth | 9 |
| naming_consistency | 10 |
| ci_efficiency | 9 |
| overengineering | 6.1 |
| dead_assets | 7.9 |
| ownership | 10 |

## Gate Blockers

- none

## Improvement Backlog

- [runtime_proof] Only 0 monthly evidence pack(s) exist, so real 30/60/90-day proof trends are not yet available.
- [duplication] Duplicate script bodies remain: contract-tests, contract:test
- [duplication] Duplicate script bodies remain: inventory:check, docs:sync
- [script_sprawl] Root script count is 299.
- [script_sprawl] Root command surface is still dense and benefits from continued pruning.
- [ci_efficiency] Emergency/manual app-specific deploy workflows still exist: deploy-union-eyes.yml
- [ci_efficiency] App-specific workflows are demoted to emergency/manual only: deploy-console.yml, deploy-partners.yml, deploy-web.yml
- [ci_efficiency] Effective active workflow count is 49 (total 52, emergency/manual 3).
- [overengineering] Effective workflow surface remains larger than ideal for a disciplined canonical release path.
- [dead_assets] Active app-specific deployment entry points remain and should be converged into the canonical release path.


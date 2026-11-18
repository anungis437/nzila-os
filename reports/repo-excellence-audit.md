# Repo Excellence Audit

Generated: 2026-11-18T00:05:32.619Z

Overall score: 7.2 / 10

## Category Scores

| Category | Score |
| --- | ---: |
| runtime_proof | 6 |
| duplication | 8 |
| script_sprawl | 1.8 |
| hidden_fragility | 6.4 |
| docs_truth | 9 |
| naming_consistency | 10 |
| ci_efficiency | 9 |
| overengineering | 4.1 |
| dead_assets | 7.9 |
| ownership | 10 |

## Gate Blockers

- none

## Improvement Backlog

- [runtime_proof] Deploy success rate is not yet backfilled from production telemetry.
- [runtime_proof] Only 0 monthly evidence pack(s) exist, so real 30/60/90-day proof trends are not yet available.
- [duplication] Duplicate script bodies remain: contract-tests, contract:test
- [duplication] Duplicate script bodies remain: inventory:check, docs:sync
- [script_sprawl] Root script count is 304.
- [script_sprawl] Root command surface is still dense and benefits from continued pruning.
- [hidden_fragility] Verify live synthetic probes; configured targets alone do not establish endpoint availability.
- [hidden_fragility] Verify live alert delivery; routing configuration alone does not establish delivery.
- [hidden_fragility] Backfill actual deployment outcomes and rollback events; CI workflow conclusions are not deployment or rollback receipts.
- [hidden_fragility] Integrate a current runtime incident feed; vulnerability remediation metrics do not establish incident MTTR or incident counts.
- [ci_efficiency] Emergency/manual app-specific deploy workflows still exist: deploy-union-eyes.yml
- [ci_efficiency] App-specific workflows are demoted to emergency/manual only: deploy-console.yml, deploy-partners.yml, deploy-web.yml
- [ci_efficiency] Effective active workflow count is 69 (total 72, emergency/manual 3).
- [overengineering] Effective workflow surface remains larger than ideal for a disciplined canonical release path.
- [dead_assets] Active app-specific deployment entry points remain and should be converged into the canonical release path.


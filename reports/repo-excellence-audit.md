# Repo Excellence Audit

Generated: 2026-05-21T16:09:55.053Z

Overall score: 7.2 / 10

## Category Scores

| Category | Score |
| --- | ---: |
| runtime_proof | 6 |
| duplication | 8 |
| script_sprawl | 2.6 |
| hidden_fragility | 5.8 |
| docs_truth | 9 |
| naming_consistency | 10 |
| ci_efficiency | 7.3 |
| overengineering | 6.2 |
| dead_assets | 6.8 |
| ownership | 10 |

## Gate Blockers

- none

## Improvement Backlog

- [runtime_proof] MTTR is still missing live incident feed integration.
- [runtime_proof] Deploy success rate is not yet backfilled from production telemetry.
- [runtime_proof] Only 1 monthly evidence pack(s) exist, so real 30/60/90-day proof trends are not yet available.
- [duplication] Duplicate script bodies remain: contract-tests, contract:test
- [duplication] Duplicate script bodies remain: inventory:check, docs:sync
- [script_sprawl] Root script count is 288.
- [script_sprawl] Root command surface is still dense and benefits from continued pruning.
- [hidden_fragility] Complete live synthetic probe rollout for all Tier 1 endpoints.
- [hidden_fragility] Integrate incident tracker feed for MTTR and monthly incident count.
- [hidden_fragility] Backfill per-app uptime and deployment success from production telemetry.
- [hidden_fragility] 17 apps still have unresolved live cost attribution.
- [ci_efficiency] Emergency/manual app-specific deploy workflows still exist: deploy-console.yml, deploy-partners.yml, deploy-union-eyes.yml, deploy-web.yml
- [ci_efficiency] Workflow count remains 48.
- [overengineering] Workflow surface remains larger than ideal for a disciplined canonical release path.
- [dead_assets] Legacy app-specific deployment entry points remain present and should stay demoted to emergency/manual use only.


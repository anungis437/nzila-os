# World-Class Portfolio SRE and Reliability System

## Scope

Nzila OS shared reliability layer for:

- uptime
- monitoring
- alerting
- incident response
- capacity
- rollback confidence
- SLO/SLAs
- cost efficiency
- synthetic checks
- on-call readiness
- postmortems
- executive dashboards

## Portfolio Tiers

- Tier 1: Union Eyes, FairCase, Flow, Web, Partners, CFO
- Tier 2: Zonga, Agrimo, Cora, Trade, Mobility
- Internal: Console, Control Plane, Orchestrator API

## Policy Sources

- Service tiers: governance/sre/service-tiers.json
- Synthetic probes: governance/sre/synthetic-checks.json
- Alert policy: governance/sre/alert-policy.json
- On-call ownership: governance/sre/oncall-ownership-matrix.json
- Error budgets: governance/sre/error-budget-policy.json
- FinOps: governance/sre/cost-governance.json
- DB reliability: governance/sre/database-reliability.json
- Queue reliability: governance/sre/queue-reliability.json
- Release linkage: governance/sre/release-reliability-linkage.json
- Security overlap: governance/sre/security-reliability-overlap.json
- Zonga special rules: governance/sre/zonga-special-rules.json

## Enforcement Commands

- pnpm sre:health:contract
- pnpm sre:synthetic:dry-run
- pnpm sre:alerts:dry-run
- pnpm sre:audit
- pnpm sre:dashboard
- pnpm sre:validate

## Reliability Workflow Gate

CI workflow: .github/workflows/reliability-guard.yml

## Incident System

Templates under docs/ops/incidents:

- sev1-runbook.md
- sev2-runbook.md
- communication-template.md
- customer-status-template.md
- postmortem-template.md

## Game Day

Quarterly scenarios and measures are defined in governance/sre/gameday-program.json and docs/ops/gameday-chaos-readiness.md.

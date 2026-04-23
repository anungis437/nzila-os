# Reliability Summary

## SRE Practices

- **Health contracts**: Every app exposes standardized health endpoints, validated by `pnpm sre:health:contract` and documented in `docs/ops/HEALTH_CHECK_STANDARD.md`
- **SLO policy**: Defined in `ops/slo-policy.yml`, enforced by contract tests
- **Alert routing**: Dry-run validated via `pnpm sre:alerts:dry-run`
- **Synthetic monitoring**: Dry-run validated via `pnpm sre:synthetic:dry-run`
- **Executive dashboard**: Generated via `pnpm sre:dashboard`

## Deployment Safety

- **Staging → Production promotion**: Governed release gates at every step
- **Rollback**: One-command production rollback (`pnpm release:rollback`)
- **Hotfix SLA**: Tracked and enforced (`pnpm release:hotfix:sla`)
- **Migration safety**: Pre-deploy validation (`pnpm release:migration:safety`)
- **Smoke tests**: Automated post-deploy validation
- **Canary deployments**: Progressive rollout with auto-rollback (`canary-deploy.yml`)

## Disaster Recovery

- **DR playbooks**: `docs/ops/disaster-recovery.md`, `docs/platform/DISASTER_RECOVERY_PLAYBOOK_*.md`
- **Business continuity**: `ops/business-continuity/`
- **Staging recovery**: Dashboard and runbook available
- **Database backups**: Verified via `pnpm verify:backup`

## Observability

- **Structured logging**: Request correlation across all services
- **OpenTelemetry**: Metrics and distributed tracing via `@nzila/platform-observability`
- **RUM**: Real User Monitoring via `@nzila/platform-rum`
- **Performance budgets**: Defined in `ops/perf-budgets.yml`
- **Lighthouse CI**: Automated on every PR for web apps

## Chaos Engineering

- **Weekly game days**: Automated chaos experiments (`game-day.yml`)
- **Runbooks**: Documented recovery procedures for known failure modes
- **Incident response**: `docs/ops/incident-response.md`
- **On-call playbook**: `docs/ops/on-call.md`

## Current SRE Artifacts

- `reports/sre-executive-dashboard.json`
- `reports/sre-reliability-audit.json`
- `reports/sre-alert-routing-dry-run.json`
- `reports/sre-synthetic-dry-run.json`

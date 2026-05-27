# Reliability Summary

## SRE Practices

- **Health contracts**: Every app exposes standardized health endpoints, validated by `pnpm exec tsx scripts/sre/validate-health-contract.ts` and documented in `docs/ops/HEALTH_CHECK_STANDARD.md`
- **SLO policy**: Defined in `ops/slo-policy.yml`, enforced by contract tests
- **Alert routing**: Dry-run validated via `pnpm exec tsx scripts/sre/alert-routing-dry-run.ts`
- **Synthetic monitoring**: Dry-run validated via `pnpm exec tsx scripts/sre/synthetic-dry-run.ts`
- **Executive dashboard**: Generated via `pnpm exec tsx scripts/sre/generate-executive-dashboard.ts`

## Deployment Safety

- **Staging → Production promotion**: Governed release gates at every step
- **Rollback**: One-command production rollback (`pnpm exec tsx scripts/release/rollback-prod.ts`)
- **Hotfix SLA**: Tracked and enforced (`pnpm exec tsx scripts/release/hotfix-sla.ts`)
- **Migration safety**: Pre-deploy validation (`pnpm exec tsx scripts/release/validate-migration-safety.ts`)
- **Smoke tests**: Automated post-deploy validation
- **Canary deployments**: Progressive rollout with auto-rollback (`canary-deploy.yml`)

## Disaster Recovery

- **DR playbooks**: `docs/ops/disaster-recovery.md`, `docs/platform/DISASTER_RECOVERY_PLAYBOOK_*.md`
- **Business continuity**: `ops/business-continuity/`
- **Staging recovery**: Dashboard and runbook available
- **Database backups**: Verified via `pnpm exec tsx scripts/backup-verify.ts`

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

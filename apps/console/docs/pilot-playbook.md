# Console — Pilot Playbook

## Purpose
This playbook validates the internal operations console for governance, assurance, and operational visibility.

## Prerequisites
- [ ] Console running locally or in staging
- [ ] Auth configured for admin users
- [ ] Demo data seeded

## Setup
1. Seed demo data

```bash
pnpm --filter @nzila/console demo:seed
```

2. Verify health endpoint

```bash
curl http://localhost:3001/api/health
```

3. Verify metrics endpoint

```bash
curl http://localhost:3001/api/metrics
```

## Pilot Workflows
1. Open App Launcher and verify cross-app links are available.
2. Validate governance surfaces in audit and assurance routes.
3. Export evidence packs and verify successful generation.

## Success Criteria
- [ ] Dashboard loads consistently for admin users
- [ ] Health and metrics endpoints are available
- [ ] Evidence generation completes without runtime errors
- [ ] Key app-launcher links open expected targets

## Rollback
1. Stop demo workloads
2. Remove demo seed entities
3. Revert environment overrides used for pilot

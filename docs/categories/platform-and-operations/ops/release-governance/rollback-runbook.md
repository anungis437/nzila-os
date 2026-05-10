# Production Rollback — Runbook

> Restore production to a known-good state in under 10 minutes.

## Quick Reference

```bash
# List available rollback targets
pnpm release:rollback --list

# Dry-run (see what would happen)
pnpm release:rollback --tag v1.1.0

# Execute rollback (all prod apps)
pnpm release:rollback --tag v1.1.0 --execute

# Rollback specific apps only
pnpm release:rollback --tag v1.1.0 --apps web,console --execute
```

## Decision Tree

```
Incident detected
  │
  ├─ Is the issue in application code?
  │    YES → Rollback container image
  │
  ├─ Is the issue in a DB migration?
  │    YES → Check rollback scripts first
  │         └─ Apply DB rollback, THEN image rollback
  │
  └─ Is the issue in infrastructure?
       YES → Use Terraform/Bicep rollback (out of scope)
```

## What the Script Does

1. **Validates** target tag exists in git
2. **Loads** release manifest from `ops/releases/`
3. **Resolves** prod-approved apps from `governance/release/deployment-inventory.json`
4. **DB safety check** — scans migrations between current and target for destructive ops
5. **Plans** `az containerapp update` commands for each app
6. **Executes** (with `--execute` flag) or prints dry-run
7. **Smoke tests** production after rollback
8. **Records** evidence in `ops/rollbacks/`

## DB Awareness

The rollback script automatically detects if migrations were applied between the current version and the target:

- If destructive migrations exist (DROP TABLE, TRUNCATE, etc.), it warns that rollback is **IRREVERSIBLE** at the DB level
- If rollback scripts exist in `apps/union-eyes/db/migrations/rollback/`, it references them
- The operator must manually apply DB rollback SQL if needed

### Manual DB Rollback

```bash
# Connect to staging DB
$env:PGPASSWORD = "..."; psql -U nzila -d nzila_automation -h <host> -p 5432

# Apply rollback script
\i apps/union-eyes/db/migrations/rollback/0022_undo_change.sql
```

## Evidence Record

Every rollback (including dry-runs) writes to `ops/rollbacks/`:

```json
{
  "rollbackId": "rollback-1711378200000",
  "executedAt": "2026-03-25T14:30:00Z",
  "targetTag": "v1.1.0",
  "targetSha": "abc1234...",
  "previousTag": "v1.2.0",
  "apps": [...],
  "executionMode": "execute",
  "smokeResult": "pass",
  "initiatedBy": "aubert",
  "resourceGroup": "nzila-canada-staging-rg"
}
```

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `AZURE_RESOURCE_GROUP` | For --execute | `nzila-canada-staging-rg` |
| `ACR_NAME` | For --execute | `nzilacanadaacr` |
| `GITHUB_ACTOR` | No | `local` |

## Post-Rollback Checklist

- [ ] Verify all apps healthy: `pnpm release:staging:truth --live`
- [ ] Check evidence written: `ls ops/rollbacks/`
- [ ] Update release ledger: `pnpm release:evidence --tag <previous> --smoke pass`
- [ ] Create incident record in `ops/incidents/`
- [ ] Notify stakeholders
- [ ] Root cause analysis within 24h

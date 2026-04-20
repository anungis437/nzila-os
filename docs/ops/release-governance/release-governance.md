# Release Governance — Definitive Guide

> Nzila OS institutional-grade release management.

## Overview

Every production release follows a deterministic, auditable pipeline:

```
tag → build → stage → validate → approve → promote → evidence → ledger
```

## Release Types

| Type | SLA | Approval | DB Gate | Evidence |
|------|-----|----------|---------|----------|
| Standard | Scheduled | Required | Required | Full |
| Hotfix | Immediate | Post-hoc (48h) | Required | Full + normalization |

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm release:tag` | Create signed semantic version tag + manifest |
| `pnpm release:staging:truth` | Validate staging is promotable |
| `pnpm release:staging:truth --live` | + hit live staging endpoints |
| `pnpm release:rollback --list` | List rollback candidates |
| `pnpm release:rollback --tag vX.Y.Z` | Dry-run rollback plan |
| `pnpm release:rollback --tag vX.Y.Z --execute` | Execute production rollback |
| `pnpm release:hotfix` | Initiate governed hotfix |
| `pnpm release:hotfix:sla` | Check hotfix normalization SLA |
| `pnpm release:evidence --tag vX.Y.Z` | Record release evidence |
| `pnpm release:evidence --list` | View evidence ledger |
| `pnpm release:dashboard` | Portfolio version dashboard |

## Signed Tags

All production tags MUST be signed (GPG or SSH). `tag-release.ts` detects signing configuration automatically:

```bash
# Configure GPG
git config --global user.signingkey <YOUR_KEY_ID>
git config --global commit.gpgsign true

# Or SSH signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

If no signing key is configured, the tag is created unsigned with a warning. CI enforces signed tags for production promotion.

## Evidence Ledger

Every production deploy appends to `reports/releases/release-ledger.jsonl`:

```json
{
  "timestamp": "2026-03-25T14:30:00Z",
  "tag": "v1.2.0",
  "sha": "abc1234def",
  "deployer": "ci-bot",
  "approver": "aubert",
  "environment": "production",
  "dbGateResult": "pass",
  "smokeResult": "pass",
  "rollbackCandidate": true,
  "hotfix": false,
  "changelogHash": "a1b2c3d4e5f6",
  "artifactId": "sha256:...",
  "schemaVersion": 1
}
```

## Workflow

### Standard Release

1. `pnpm release:tag` — creates tag + manifest in `ops/releases/`
2. CI triggers `deploy-production.yml` → builds, stages, tests
3. `pnpm release:staging:truth --live` — validates staging
4. Human approval gate
5. Production promotion (exact same artifact SHA)
6. Post-deploy smoke
7. `pnpm release:evidence` — appends to ledger

### Hotfix

1. `pnpm release:hotfix` — creates hotfix branch + tracking record
2. Minimal-diff fix on branch
3. `pnpm release:tag` — creates hotfix tag
4. Expedited deploy (same pipeline, skips canary)
5. 48h normalization deadline starts
6. `pnpm release:hotfix:sla` — CI checks for overdue normalizations

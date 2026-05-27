# Hotfix Governance — Runbook

> Emergency releases with mandatory 48-hour normalization.

## Philosophy

Hotfixes are a **controlled exception** to the standard release process. They exist because production incidents can't wait for full governance. But every shortcut must be repaid within 48 hours.

## Lifecycle

```
Incident → Hotfix branch → Minimal fix → Expedited deploy → 48h normalization
```

| Phase | Action | SLA |
|-------|--------|-----|
| Initiate | `pnpm exec tsx scripts/release/hotfix-initiate.ts` | Immediate |
| Fix | Minimal-diff change on hotfix branch | < 2h |
| Deploy | Same pipeline, skip canary | < 30 min |
| Normalize | Full PR, tests, review, merge to main | 48h |
| Close | Update hotfix record, merge normalization PR | 48h |

## Commands

```bash
# Start a hotfix
pnpm exec tsx scripts/release/hotfix-initiate.ts
# → Creates branch hotfix/<tag>-<timestamp>
# → Creates tracking record in ops/hotfixes/
# → Sets 48h normalization deadline

# Check SLA compliance
pnpm exec tsx scripts/release/hotfix-sla.ts
# → Scans all hotfix records
# → Reports overdue normalizations

# Strict mode (CI — fails build if overdue)
pnpm exec tsx scripts/release/hotfix-sla.ts --strict
```

## Hotfix Record Format

Stored in `ops/hotfixes/<id>.json`:

```json
{
  "id": "hotfix-1711378200000",
  "tag": "v1.2.1",
  "description": "Fix payment webhook timeout",
  "createdAt": "2026-03-25T14:30:00Z",
  "status": "open",
  "normalizationDeadline": "2026-03-27T14:30:00Z",
  "owner": "aubert",
  "normalizedAt": null,
  "normalizedPR": null
}
```

## Normalization Process

1. Create a proper PR from the hotfix branch to main
2. Full test suite must pass
3. Code review required (minimum 1 approval)
4. PR description must reference the hotfix record
5. After merge, update the hotfix record:

```json
{
  "status": "normalized",
  "normalizedAt": "2026-03-26T10:00:00Z",
  "normalizedPR": "https://github.com/anungis437/nzila-os/pull/XXX"
}
```

## SLA Enforcement

The `scripts/release/hotfix-sla.ts` script runs in CI (scheduled daily + pre-deploy):

- **Warning (exit 2)**: Hotfix overdue but deployment allowed
- **Strict failure (exit 1)**: Used in `--strict` mode, blocks further releases until normalized

### CI Integration

```yaml
# In deploy-production.yml pre-deploy gates:
- name: Hotfix SLA Check
  run: pnpm exec tsx scripts/release/hotfix-sla.ts --strict
```

## Escalation

| Hours Overdue | Action |
|---------------|--------|
| 0-24h | Warning in CI logs |
| 24-48h | Alert owner + engineering lead |
| 48h+ | Block all non-hotfix deploys until resolved |
| 72h+ | Escalate to CTO |

## Anti-Patterns

- **Chaining hotfixes**: If a hotfix needs a hotfix, the original fix was wrong. Revert + proper fix instead.
- **Scope creep**: Hotfix must be minimal. "While we're at it" changes belong in a standard release.
- **Skipping normalization**: The 48h SLA exists because un-normalized hotfixes accumulate tech debt and bypass quality gates.

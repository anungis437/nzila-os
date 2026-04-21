# Workflow Consolidation Plan (Phase 2)

> **Status:** PLAN — execute in a follow-up PR after team review.
> 43 workflows currently in `.github/workflows/`.
> Target: ~12 workflows organized into 5 functional buckets + per-app deploys.
>
> No deletions in this PR. This document is the contract for the next PR.

## Why not auto-delete now?
Each workflow declares its own triggers, secrets, permissions, and matrix.
Blindly merging them risks dropping a protection. The plan below assigns
each existing workflow to a target group; merging happens in a single
follow-up PR where every removed file is replaced by an equivalent
`jobs:` block in the consolidated workflow.

---

## Target structure

```
.github/workflows/
├── ci-blocking.yml          # PR-blocking: typecheck, lint, unit, build, web-i18n
├── governance.yml           # PR-non-blocking aggregator: portfolio + capital + control-tests + repo-inventory + doc-hygiene
├── security.yml             # secret-scan + sbom + trivy + dependency-audit + dast + security-design-review
├── nightly-audit.yml        # contract-tests + reliability-guard + compliance + ai-governance + lighthouse
├── weekly-maintenance.yml   # console-weekly-digest + game-day + capital-discipline (weekly view) + portfolio-governance (weekly)
├── deploy-staging.yml       # KEEP
├── deploy-production.yml    # KEEP
├── deploy-web.yml           # KEEP
├── deploy-console.yml       # KEEP
├── deploy-partners.yml      # KEEP
├── deploy-union-eyes.yml    # KEEP
├── canary-deploy.yml        # KEEP
├── preview-deploy.yml       # KEEP
├── gitops-deploy.yml        # KEEP
├── release-train.yml        # KEEP
├── dependabot-auto-merge.yml # KEEP
└── (telemetry-manifest enforcement runs inside ci-blocking via tooling/contract-tests)
```

Net: **43 → ~17** workflows. Eliminates ~26 redundant pipelines.

---

## Mapping — every existing workflow

### → `ci-blocking.yml` (single PR-blocking pipeline)
| Existing | Why |
|---|---|
| `ci.yml` | Already the primary; absorb sibling steps |
| `e2e.yml` | Run only when relevant paths change (path filter) |
| `app-floor-check.yml` | Move as job step; small script |
| `repo-inventory-check.yml` | Job step (drift gate) |
| `doc-hygiene.yml` | Job step |
| `agri-core-check.yml` | Path-filtered job step |
| `agri-gov-ingestion-check.yml` | Path-filtered job step |
| `cupe-pilot-readiness.yml` | Path-filtered job step |
| `zonga-check.yml` | Path-filtered job step |

### → `governance.yml` (collapses 4 governance pipelines)
| Existing | Why |
|---|---|
| `nzila-governance.yml` | Master |
| `portfolio-governance.yml` | Job: portfolio-validate |
| `capital-discipline.yml` | Job: capital |
| `compliance.yml` | Job: compliance-baseline |
| `compliance-drift.yml` | Job: compliance-drift |
| `continuous-guards.yml` | Job: guards (rolling) |
| `nzila-ga-gate.yml` | Job: ga-gate |
| `nzila-playbook-runner.yml` | Job: playbook |
| `ai-governance.yml` | Job: ai (path-filtered) |
| `control-tests.yml` | Job: control-tests |
| `platform-automation.yml` | Job: platform-automation |

### → `security.yml` (collapses 6 security pipelines)
| Existing | Why |
|---|---|
| `secret-scan.yml` | Job |
| `sbom.yml` | Job |
| `trivy.yml` | Job |
| `dependency-audit.yml` | Job |
| `dast.yml` | Job (scheduled, not per-PR) |
| `security-design-review.yml` | Job (path-filtered: ARCHITECTURE/security touch) |
| `red-team.yml` | Job (manual + scheduled) |

### → `nightly-audit.yml` (scheduled — `cron: 0 4 * * *`)
| Existing | Why |
|---|---|
| `reliability-guard.yml` | Already scheduled |
| `lighthouse.yml` | Already scheduled |
| `ops-pack.yml` | Job (rolling proof pack) |

### → `weekly-maintenance.yml` (scheduled — `cron: 0 6 * * 1`)
| Existing | Why |
|---|---|
| `console-weekly-digest.yml` | Job |
| `game-day.yml` | Job (manual + weekly) |

### KEEP unchanged
- `deploy-staging.yml`, `deploy-production.yml`, `deploy-web.yml`,
  `deploy-console.yml`, `deploy-partners.yml`, `deploy-union-eyes.yml`,
  `canary-deploy.yml`, `preview-deploy.yml`, `gitops-deploy.yml`,
  `release-train.yml`, `dependabot-auto-merge.yml`

---

## Migration safety checklist (apply to every merge)
1. Capture the existing workflow's `permissions:`, `secrets:`, `concurrency:` — preserve verbatim
2. Convert `on:` triggers into a single broader trigger or per-job `if:` guards
3. Maintain identical `runs-on:` per job
4. Branch protection rules referencing old workflow names must be updated in the same PR (otherwise PRs will fail "expected check missing")
5. Remove the old `.yml` only AFTER the consolidated job has run green on `main` once

---

## Quick wins available NOW (zero-risk, < 30 min each)
1. Merge `compliance.yml` + `compliance-drift.yml` → one workflow with two jobs (same triggers)
2. Merge `agri-core-check.yml` + `agri-gov-ingestion-check.yml` → one `agri-checks.yml` (same path filters)
3. Add `paths-ignore: ['**.md', 'docs/**']` to `e2e.yml` and `lighthouse.yml`

These can ship independently.

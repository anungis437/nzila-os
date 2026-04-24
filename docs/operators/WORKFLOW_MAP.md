# CI/CD Workflow Map

All 41 GitHub Actions workflows classified by category, trigger, and canonical status.

> **Legend:**
>
> - **CANONICAL** — Primary path. Used in production promotion flow.
> - **ACTIVE** — Runs regularly on schedule/PR/push. Well-maintained.
> - **EMERGENCY** — Manual-only, requires explicit ack. Not part of normal flow.
> - **SCAFFOLD** — Placeholder/stub. Not yet exercising real operations.
> - **LEGACY** — Superseded by a canonical workflow. Kept for rollback reference.

## Summary

| Category | Count |
|----------|-------|
| CI Core | 4 |
| Deploy | 10 |
| Governance | 7 |
| Security | 7 |
| Scheduled/Nightly | 5 |
| SRE/Ops | 3 |
| Product-Specific | 4 |
| Manual | 1 |
| **Total** | **41** |

## CI Core (every PR)

| Workflow | Name | Trigger | Status |
|----------|------|---------|--------|
| `ci.yml` | CI | push (main), pull_request (main) | **CANONICAL** |
| `app-floor-check.yml` | App Floor Check | pull_request (paths: `apps/**`) | ACTIVE |
| `dependabot-auto-merge.yml` | Dependabot Auto-Merge | pull_request (opened, synchronize) | ACTIVE |
| `lighthouse.yml` | Lighthouse CI | pull_request (paths: web/console/partners/zonga/agrimo/trade/ui) | ACTIVE |

## Deploy

| Workflow | Name | Trigger | Status | Notes |
|----------|------|---------|--------|-------|
| `gitops-deploy.yml` | GitOps Deploy | push (main), workflow_dispatch | **CANONICAL** | Primary staging deploy path |
| `deploy-production.yml` | Deploy Production | workflow_dispatch, push (tags: `v*`) | **CANONICAL** | Primary production promotion |
| `release-train.yml` | Release Train | push (tags: `v*`), workflow_dispatch | **CANONICAL** | Multi-gate release pipeline |
| `deploy-staging.yml` | Deploy Staging | workflow_dispatch | **EMERGENCY** | Requires typing "EMERGENCY" — NOT for normal use |
| `deploy-console.yml` | Deploy Console | workflow_dispatch | LEGACY | Superseded by `gitops-deploy.yml` matrix |
| `deploy-partners.yml` | Deploy Partners | workflow_dispatch | LEGACY | Superseded by `gitops-deploy.yml` matrix |
| `deploy-union-eyes.yml` | Deploy UnionEyes | workflow_dispatch | LEGACY | Superseded by `gitops-deploy.yml` matrix |
| `deploy-web.yml` | Deploy Web | workflow_dispatch | LEGACY | Superseded by `gitops-deploy.yml` matrix |
| `canary-deploy.yml` | Canary Deploy | workflow_dispatch | ACTIVE | Progressive rollout for high-risk changes |
| `preview-deploy.yml` | Preview Deploy | pull_request (opened, synchronize, reopened) | ACTIVE | PR preview environments |

### Deploy Path Decision Tree

```
Normal deploy:    merge to main → gitops-deploy.yml (automatic)
Production:       pnpm release:tag → release-train.yml → deploy-production.yml
Emergency staging: workflow_dispatch → deploy-staging.yml (EMERGENCY ack required)
Single-app:       Use gitops-deploy.yml with --apps filter (NOT legacy per-app workflows)
```

## Governance

| Workflow | Name | Trigger | Status |
|----------|------|---------|--------|
| `nzila-governance.yml` | Nzila Governance Gate | workflow_call (reusable) | **CANONICAL** |
| `nzila-ga-gate.yml` | Nzila GA Gate | pull_request, push (main), workflow_dispatch | ACTIVE |
| `portfolio-governance.yml` | Portfolio Governance | push (main), pull_request (main) | ACTIVE |
| `capital-discipline.yml` | Capital Discipline | push (main), pull_request (main) | ACTIVE |
| `compliance-drift.yml` | Compliance Drift | push/PR (paths) + schedule (weekly Mon) | ACTIVE |
| `ai-governance.yml` | AI Governance | pull_request (paths: `ai-*`, `ml-*`) | ACTIVE |
| `repo-inventory-check.yml` | Repo Inventory Check | pull_request (paths: apps/packages/workflows/governance) | ACTIVE |

## Security

| Workflow | Name | Trigger | Status |
|----------|------|---------|--------|
| `dependency-audit.yml` | Dependency Audit | push/PR (package.json, lockfile) + daily schedule | **CANONICAL** |
| `secret-scan.yml` | Secret Scan | push (main, develop), pull_request (main) | ACTIVE |
| `trivy.yml` | Container Security Scan | push/PR (Dockerfile) + weekly schedule | ACTIVE |
| `dast.yml` | DAST Security Scan | weekly schedule + workflow_dispatch | ACTIVE |
| `red-team.yml` | Red-Team Adversarial Tests | nightly schedule + workflow_dispatch + PR (paths) | ACTIVE |
| `sbom.yml` | SBOM Generation | push (main), release (published) | ACTIVE |
| `security-design-review.yml` | Security Design Review | pull_request (paths: ai-core/auth/policy/security) | ACTIVE |

## SRE/Ops

| Workflow | Name | Trigger | Status | Notes |
|----------|------|---------|--------|-------|
| `reliability-guard.yml` | Reliability Guard | workflow_dispatch, pull_request, push (main) | **CANONICAL** | Full SRE validation gate |
| `ops-pack.yml` | Ops Pack Validation | push/PR (paths: `ops/**`) + weekly schedule | ACTIVE | |
| `game-day.yml` | Game Day | weekly schedule (Wed 14:00) + workflow_dispatch | **SCAFFOLD** | Chaos experiments are echo stubs — real fault injection TODO |

## Scheduled/Nightly

| Workflow | Name | Schedule | Status |
|----------|------|----------|--------|
| `compliance.yml` | Compliance | Daily 05:00 + Weekly Sun 06:00 | ACTIVE |
| `platform-automation.yml` | Platform Automation | Daily 06:00 | ACTIVE |
| `continuous-guards.yml` | Continuous Guards | Daily 06:30 + workflow_dispatch | **CANONICAL** |
| `control-tests.yml` | Control Tests | Weekly/monthly/quarterly | ACTIVE |
| `console-weekly-digest.yml` | Console Weekly Digest | Weekly Mon 07:00 | ACTIVE |

## Product-Specific

| Workflow | Name | Product | Trigger | Status |
|----------|------|---------|---------|--------|
| `agri-core-check.yml` | Agri Core Check | Agrimo | push/PR (main) | ACTIVE |
| `agri-gov-ingestion-check.yml` | Agri CoraGov Ingestion | Cora | PR (paths: agri-reporting) | ACTIVE |
| `cupe-pilot-readiness.yml` | CUPE Pilot Readiness | Union Eyes | push/PR (release/cupe-pilot) | ACTIVE |
| `zonga-check.yml` | Zonga Enforcement | Zonga | push/PR (paths: `zonga-*`) | ACTIVE |

## Manual Only

| Workflow | Name | Purpose | Status |
|----------|------|---------|--------|
| `nzila-playbook-runner.yml` | Nzila Playbook Runner | Run ops playbooks on demand | ACTIVE |

---

## Known Gaps

| Item | Status | Plan |
|------|--------|------|
| `game-day.yml` chaos experiments are echo stubs | SCAFFOLD | Replace with real fault injection (pod kill, latency inject, DB failover) |
| Legacy per-app deploy workflows (`deploy-console.yml`, etc.) | LEGACY | Archive after 2 release cycles — all deploys via `gitops-deploy.yml` |
| `deploy-staging.yml` used in `deploy-production.yml` source_run_id lookup | DEPENDENCY | Production workflow references staging run artifacts — keep emergency path |

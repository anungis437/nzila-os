# CI Required Checks

All NzilaOS-integrated apps must pass the following CI checks on every
pull request and main-branch push.

## Tier 1 — Blocking (required to merge)

| Check | Tool | Workflow Job |
|-------|------|-------------|
| Secret scanning | Gitleaks + TruffleHog | `secret-scan` |
| Dependency audit | `pnpm audit --audit-level=high` | `dependency-audit` |
| Container scan | Trivy (CRITICAL/HIGH) | `trivy` |
| Lint + Typecheck | ESLint + `tsc --noEmit` | `lint-and-typecheck` |
| Unit tests | Vitest / pytest | `test` |

## Tier 2 — Required for main branch

| Check | Tool | Workflow Job |
|-------|------|-------------|
| SBOM generation | CycloneDX | `sbom` |
| Contract tests | Vitest contract suite | `contract-tests` |
| Evidence seal | `scripts/evidence/seal.ts` | `evidence` |

## Tier 3 — Scheduled / Nightly

| Check | Frequency |
|-------|-----------|
| Red-team scenarios | Nightly (`cron: '0 3 * * *'`) |
| Full dependency tree scan | Weekly |

## Reusable Workflow

Apps should call the governance workflow from the NzilaOS monorepo:

```yaml
jobs:
  governance:
    uses: nzila-os/nzila-automation/.github/workflows/nzila-governance.yml@main
    secrets: inherit
```

See [APP_ADOPTION_GUIDE.md](../../docs/platform/APP_ADOPTION_GUIDE.md) for setup details.

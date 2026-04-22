# test-scaffold-gp

A governed app in the Nzila OS monorepo.

## Governance Controls

| Control | Status |
|---------|--------|
| Enforcement | ✓ Required |
| Governance | ✓ Required |
| Audit | ✓ Required |
| Observability | ✓ Required |
| Security | ✓ Required |
| Model/ML Control | ○ Optional |

## Quick Start

```bash
pnpm dev --filter @nzila/test-scaffold-gp
```

## Governance Compliance

This app's control-manifest.json declares its governance requirements.
Run `pnpm validate:control:manifests` to verify compliance.

Risk Level: **high**
Policy Profile: **commerce**

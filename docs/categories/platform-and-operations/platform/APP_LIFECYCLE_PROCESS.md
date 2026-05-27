# App Lifecycle Process

This document defines how apps move between lifecycle tiers and which checks are required.

## Lifecycle Tiers

- `EXPERIMENTAL`
- `INCUBATING`
- `PILOT`
- `PRODUCTION`

Registry source of truth: `platform/registry/apps.json`.

## Validation Gate

Run:

```bash
pnpm exec tsx scripts/app-lifecycle-check.ts
```

This validates:

1. Every directory in `apps/` is registered.
2. Every registry entry points to an existing app path.
3. Tier value is valid.
4. Required metadata exists (`owner`, `domain`).
5. Tier-specific controls are satisfied (tests/docs/typecheck/health endpoint expectations).

## Promotion Criteria

### EXPERIMENTAL -> INCUBATING

- App is registered in `platform/registry/apps.json`.
- Basic `package.json` scripts exist for lint/typecheck/test.
- Initial ownership declared.

### INCUBATING -> PILOT

- Minimum test coverage for critical paths (at least one test file).
- App docs exist under `apps/<app>/docs/`.
- Governance and policy routes reviewed.

### PILOT -> PRODUCTION

- Stronger test baseline (minimum three test files).
- Health endpoint implementation is present if declared.
- Security and governance checks pass in CI.
- Control manifest is present and aligned.

## Required Artifacts Per App

- `maturity.json`
- `control-manifest.json`
- Registry entry in `platform/registry/apps.json`

## Related Docs

- [GA Readiness](./GA_READINESS.md)
- [Platform Operating Model](./PLATFORM_OPERATING_MODEL.md)
- [Governance Lifecycle Matrix](../governance/APP_LIFECYCLE_MATRIX.md)

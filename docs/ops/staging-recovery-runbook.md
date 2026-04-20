# Staging Recovery Runbook

This runbook defines the recovery workflow for Nzila staging when release smoke is red.

## Objective

Make staging a truthful pre-production signal where green means ready for production promotion.

## Commands

1. Build governance and smoke artifacts.

```bash
pnpm release:staging
```

2. Generate recovery dashboard from latest smoke output.

```bash
pnpm sre:staging:recovery
```

3. Rebuild SRE validation bundle.

```bash
pnpm sre:validate
```

## Triad Contract

Every release-critical app must expose:

- /api/health as liveness (HTTP 200 when process is alive)
- /api/ready as readiness (HTTP 200 only when required dependencies are ready; otherwise 503)
- /api/version as immutable build metadata

## Failure Classification

Smoke failures are classified as:

- not_found
- server_error
- auth
- redirect
- dns
- connectivity
- timeout
- runtime

Treat classification as first-response guidance, then verify logs and ingress settings.

## Recovery Process

1. Identify failing app and endpoint from smoke report in ops/smoke/smoke-staging-latest.json.
2. Validate routing truth in governance/release/deployment-inventory.json.
3. Confirm route existence and semantics in app source:
   - app/api/health/route.ts
   - app/api/ready/route.ts
   - app/api/version/route.ts
4. Redeploy failing app image with current commit and environment variables.
5. Rerun release smoke and confirm all triad probes pass for required apps.
6. Regenerate dashboard and archive artifacts in reports/ and docs/ops/sre/.

## Exit Criteria

Staging is considered recovered when:

- release smoke passes for all required staging apps
- dashboard reports zero failing required apps
- no endpoint is returning stale build metadata

## Artifact Paths

- ops/smoke/smoke-staging-latest.json
- reports/staging-recovery-dashboard.json
- docs/ops/sre/staging-recovery-dashboard.md

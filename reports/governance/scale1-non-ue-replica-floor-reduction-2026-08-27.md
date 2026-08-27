# SCALE1 Non-Union Eyes Replica Floor Reduction

Date: 2026-08-27
Scope: Azure Container Apps cost posture
Subscription: `Azure subscription 1 Nzila`
Subscription ID: `5d819f33-d16f-429c-a3c0-5b0e94740ba3`

## Decision

Union Eyes is the only application that must stay live by default. Non-Union
Eyes applications remain deployable, source-governed, and health-checkable on
demand, but their idle replica floors should not consume always-on runtime
capacity.

## Azure Changes Applied

The following non-Union Eyes Container Apps were changed to `minReplicas=0`.
Union Eyes staging and production were not changed.

### Staging

| Container App | Before | After | Latest ready revision after change |
| --- | ---: | ---: | --- |
| `nzila-os-web` | 1 | 0 | `nzila-os-web--0000362` |
| `nzila-os-console` | 1 | 0 | `nzila-os-console--0000369` |
| `nzila-os-partners` | 1 | 0 | `nzila-os-partners--0000369` |
| `nzila-os-zonga` | 1 | 0 | `nzila-os-zonga--0000362` |
| `nzila-os-control-plane` | 1 | 0 | `nzila-os-control-plane--0000255` |
| `nzila-os-platform-admin` | 1 | 0 | `nzila-os-platform-admin--0000010` |
| `nzila-os-orchestrator-api` | 1 | 0 | `nzila-os-orchestrator-api--0000228` |

The following staging apps were already at `minReplicas=0` and were left in
that posture:

- `nzila-os-flow`
- `nzila-os-cfo`
- `nzila-os-agrimo`
- `nzila-os-cora`
- `nzila-os-trade`
- `nzila-os-mobility`
- `nzila-os-abr`

### Production

| Container App | Before | After | Latest ready revision after change |
| --- | ---: | ---: | --- |
| `nzila-os-web-prod` | 1 | 0 | `nzila-os-web-prod--0000002` |
| `nzila-os-partners-prod` | 1 | 0 | `nzila-os-partners-prod--0000001` |

Production Union Eyes stayed unchanged:

| Container App | Min replicas | Max replicas | Latest ready revision |
| --- | ---: | ---: | --- |
| `nzila-os-union-eyes-prod` | 2 | 6 | `nzila-os-union-eyes-prod--0000206` |

Staging Union Eyes stayed unchanged:

| Container App | Min replicas | Max replicas | Latest ready revision |
| --- | ---: | ---: | --- |
| `nzila-os-union-eyes-staging` | 1 | 3 | `nzila-os-union-eyes-staging--0000108` |

## Live Product Verification

After the scale changes, Union Eyes remained live:

| Endpoint | Result |
| --- | --- |
| `https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/health` | HTTP 200, `status=healthy` |
| `https://nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/ready` | HTTP 200, `status=ready` |
| `https://nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io/api/health` | HTTP 200, `status=healthy` |
| `https://nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io/api/ready` | HTTP 200, `status=ready` |

## Containment Note

Scaling `nzila-os-orchestrator-api` exposed a pre-existing malformed runtime
setting where `NODE_ENV` contained `production NEXT_PUBLIC_APP_ENV=staging`.
That app was corrected to:

- `NODE_ENV=production`
- `NEXT_PUBLIC_APP_ENV=staging`
- `minReplicas=0`

The corrected latest revision became ready as
`nzila-os-orchestrator-api--0000228`. `/health` returned HTTP 200 with
`database=ok` and `github=degraded` because `GITHUB_TOKEN` is not set. That is
an existing functional limitation for dispatch behavior, not a Union Eyes live
dependency.

## Operational Semantics

`minReplicas=0` removes idle replica floors. Existing replicas may remain
running until Azure Container Apps cooldown/drain behavior completes or until
traffic idles out. The cost-control invariant is the configured floor, not
instantaneous replica count immediately after an update.

## Classification

`SCALE1 = CLOSED / PROVEN`

`UNION_EYES_LIVE_SURFACE = UNAFFECTED / HEALTHY`

`NON_UNION_EYES_RUNTIME_FLOORS = COST_CONTAINED / ON_DEMAND`

# Post-ASAP Residual Backlog - 2026-08-27

**Scope:** non-ASAP items left after `ASAP_READINESS = GREEN / CONVERGED`.
**Baseline SHA:** `8d794cdfa6c23ea37c8a682b89da6b4853577b15`
**Local path:** `C:\APPS\nzila-automation`

## Live Read-Only Evidence

Collected against the staging Container Apps in `nzila-canada-staging-rg`.

| App | Container App | Revision | Live health | Live readiness | Classification |
| --- | --- | --- | --- | --- | --- |
| Zonga | `nzila-os-zonga` | `nzila-os-zonga--0000360` | `/api/health` HTTP 200, db/blob/redis true | `/api/ready` HTTP 503 `MIDDLEWARE_FAILURE` | Source routing defect in middleware public matcher |
| Agrimo | `nzila-os-agrimo` | `nzila-os-agrimo--0000217` | `/api/health` HTTP 200, db true | `/api/ready` HTTP 503 `authority_probe_unconfigured` | Missing authority binding/configuration |
| Union Eyes | `nzila-os-union-eyes-staging` | `nzila-os-union-eyes-staging--0000108` | `/api/health` HTTP 200, database/auth/redis/backend ok | `/api/ready` HTTP 200, storage `unknown` | Storage topology architecture decision |

## Dispositions

### Zonga Middleware Readiness

`apps/zonga/app/api/ready/route.ts` returns a valid readiness payload locally, but
the deployed middleware did not exempt `/api/ready`, so the request hit the
fail-closed middleware branch before the readiness handler could respond.

Disposition:

`ZONGA_MIDDLEWARE_READINESS = SOURCE_FIX_APPLIED / REMOTE_PENDING`

Remediation:

- Add `/api/ready(.*)` to the Zonga public route matcher.
- Extend the Zonga middleware regression test to protect both health and
  readiness public probes.

### Agrimo Authority Readiness

The Agrimo readiness route is intentionally fail-closed on a Django authority
probe. Staging does not currently expose either
`AGRIMO_DJANGO_AUTHORITY_HEALTH_URL` or `AGRIMO_DJANGO_BASE_URL` on the
frontend Container App, and no deployed Agrimo Django Container App was found in
the staging or production Container App inventories.

Disposition:

`AGRIMO_AUTHORITY_READINESS = OPEN / AUTHORITY_BINDING_REQUIRED`

Required next decision:

- Deploy or designate the Agrimo Django authority endpoint.
- Bind the frontend to the authoritative health URL.
- Re-probe `/api/ready` after the authority endpoint is reachable.

### Union Eyes Blob Topology

Union Eyes staging is live-ready, but storage remains reported as `unknown` at
the readiness layer. Source code contains real Blob client capability through
`apps/union-eyes/lib/blob-client.ts`, with malware-scan enforcement before
upload. The open item is not an emergency health failure; it is whether Union
Eyes should use a dedicated container/account topology or continue its current
staging doctrine.

Disposition:

`UNION_EYES_BLOB_TOPOLOGY = OPEN / ARCHITECTURE_DECISION_REQUIRED`

Required next decision:

- Confirm whether Union Eyes gets a dedicated Blob container/account per
  environment.
- If yes, bind the storage configuration and promote storage from `unknown` to
  a probed readiness component.
- If no, record the explicit topology decision and keep readiness non-critical.

### DORA Deployment Frequency

The PR #673 DORA threshold miss was dispositioned as non-blocking for that
convergence branch. No artificial deployments were made and the threshold/window
semantics were preserved.

Disposition:

`DORA_DEPLOYMENT_FREQUENCY = OPERATIONAL_KPI / MONITOR`

Required next action:

- Monitor organic deployment cadence through the canonical DORA collector.
- Do not fabricate deployments or silently lower `DORA_MIN_DEPLOYS_PER_WEEK`.


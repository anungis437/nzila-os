# Union Eyes Blob Topology Runtime Proof

Date: 2026-08-27
Repository: `anungis437/NzilaOS`
Local path: `C:\APPS\nzila-automation`

## Classification

UNION_EYES_BLOB_TOPOLOGY: CLOSED / PROVEN

UNION_EYES_LIVE_FIRST_COST_POSTURE: PRESERVED

NON_UNION_EYES_APPS: DEFERRED / REPLICA_FLOORS_ZERO

## Azure State

Union Eyes now has dedicated private Blob containers:

| Environment | Storage account | Document container | Evidence container |
| --- | --- | --- | --- |
| Staging | `nzilacanadastore` | `union-eyes-documents-staging` | `union-eyes-evidence-staging` |
| Production | `nzilacanadaprodev` | `union-eyes-documents` | `union-eyes-evidence` |

All four containers were verified through Azure Resource Manager with
`publicAccess = None`.

Production storage account network posture was adjusted to the cost-conscious
live posture used by staging: authenticated private containers with storage
network `defaultAction = Allow`. A no-cost IP allow rule alone did not make
same-region Container Apps access work because the production Container Apps
environment is not VNet-integrated.

Union Eyes Container Apps were updated with secret references rather than
inline key disclosure:

- `AZURE_STORAGE_ACCOUNT_NAME`
- `AZURE_STORAGE_ACCOUNT_KEY=secretref:document-storage-key`
- `AZURE_BLOB_CONTAINER`
- `AZURE_EVIDENCE_STORAGE_ACCOUNT`
- `AZURE_EVIDENCE_STORAGE_KEY=secretref:evidence-storage-key`
- `AZURE_EVIDENCE_STORAGE_CONTAINER`

Replica floors were preserved for Union Eyes:

- Staging: min `1`, max `3`
- Production: min `2`, max `6`

Dormant non-Union Eyes applications remain cost-contained at min `0`.

## Runtime Proof Before Source Deploy

After Azure wiring, both Union Eyes environments converged to latest ready
revisions:

- Staging: `nzila-os-union-eyes-staging--0000109`
- Production: `nzila-os-union-eyes-prod--0000207`

Public probes returned:

- Staging `/api/health`: HTTP `200`, status `healthy`
- Staging `/api/ready`: HTTP `200`, status `ready`
- Production `/api/health`: HTTP `200`, status `healthy`
- Production `/api/ready`: HTTP `200`, status `ready`

At this point readiness still reported `storage = unknown`, because the prior
source contract did not include an enforceable Blob readiness check.

## Source Contract

Union Eyes readiness now supports `READY_REQUIRE_STORAGE=true`.

When enabled, `/api/ready` checks the configured `AZURE_BLOB_CONTAINER` through
`@nzila/blob` and includes `storage` in required readiness. The default remains
unchanged: storage stays informational unless explicitly required by runtime
configuration.

Shared build metadata now prefers `UE_ENVIRONMENT` over public build metadata,
which prevents the production Container App from reporting a stale staging
environment label when `NEXT_PUBLIC_APP_ENV` is inconsistent.

## Validation

Local validation passed:

- `pnpm --filter @nzila/union-eyes test -- app/api/__tests__/ready.route.test.ts`
- `pnpm --filter @nzila/os-core test -- src/__tests__/runtime-health.test.ts`
- `pnpm --filter @nzila/os-core typecheck`
- `pnpm --filter @nzila/union-eyes typecheck`
- `pnpm --filter @nzila/union-eyes build`
- `pnpm contract-tests -- tooling/contract-tests/ci-cd-hardening.test.ts`
- `pnpm test:fast`
- `git diff --check`

The Union Eyes production build emitted pre-existing Turbopack file-tracing
warnings in cognition/whitepaper code, but completed successfully.

## Final Runtime Proof

Source candidate:

`c8affba53470b42e2bc2563eb25ea1afe1656e1a`

Deployed image digest:

`sha256:da6eaa477d65a1088a0becb1475ec5c4b2b669b27de2ecc9d849517bbb2a4a6e`

Final revisions:

- Staging: `nzila-os-union-eyes-staging--0000112`
- Production: `nzila-os-union-eyes-prod--0000211`

`READY_REQUIRE_STORAGE=true` is enabled on Union Eyes staging and production.

Repeated public probes passed:

- Staging `/api/ready`: HTTP `200`, status `ready`, `storage = ok`
- Production `/api/ready`: HTTP `200`, status `ready`, `storage = ok`
- Staging `/api/health`: HTTP `200`, status `healthy`, environment `staging`
- Production `/api/health`: HTTP `200`, status `healthy`, environment
  `production`

The production environment-label defect was corrected by preferring
`UE_ENVIRONMENT` in build metadata and normalizing the production ACA runtime
environment:

- removed `UE_DEMO_PROFILE`
- removed `NEXT_PUBLIC_UE_DEMO_PROFILE`
- set `NZILA_MODE=production`

Verified:

- latest revision equals latest ready revision;
- `/api/ready` returns HTTP `200`;
- readiness payload has `storage = ok`;
- `/api/health` remains HTTP `200`;
- non-Union Eyes replica floors remain at min `0`;
- rollback revisions remain available through prior inactive revisions.

## Residual Architecture Backlog

For a future higher-security posture, move Union Eyes production Blob access
behind VNet/private endpoint or managed identity. That requires a separately
costed network/topology decision because the current production Container Apps
environment has no VNet configuration.

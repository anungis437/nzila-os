# Health-Check Standard

Single source of truth for operational health endpoint format across Nzila services.

## Scope

This standard applies to:

- Release smoke checks (`scripts/release/run-smoke.ts`)
- On-call and incident runbooks
- Promotion gates and staging recovery

Routing hostnames come from `governance/release/deployment-inventory.json`.

## Canonical Endpoint Contract

Probe these endpoints per service ingress:

- Liveness: `GET /api/health` (or `/health` for Fastify services)
- Readiness: `GET /api/ready` (or `/ready` for Fastify services)
- Build identity: `GET /api/version` (or `/version` for Fastify services)

Expected statuses:

- Health: `200` when service process is alive
- Ready: `200` when required dependencies are available, `503` when not ready
- Version: `200` with immutable build metadata (git SHA / artifact identity)

## Service Endpoint Matrix

| Service class | Health | Ready | Version |
|---|---|---|---|
| Next.js app services | `/api/health` | `/api/ready` | `/api/version` |
| Fastify services (`orchestrator-api`) | `/health` | `/ready` | `/version` |

## Union-Eyes Backend Sidecar Probe

Union-Eyes has an additional Django backend probe exposed through the same ingress.

- Sidecar probe: `GET /api/auth_core/health/`

Operational rule:

- Use the canonical triad above for release and promotion gates.
- Use `/api/auth_core/health/` as an additional component-level probe when debugging Union-Eyes backend pathing or sidecar health.

## Probe Order for Ops

1. Probe `health` endpoint.
2. Probe `ready` endpoint.
3. Probe `version` endpoint and validate expected build identity.
4. For Union-Eyes incidents, also probe `/api/auth_core/health/`.

## Notes

- Do not use `/` for health checks.
- Do not assume all services are Next.js; check the inventory-defined path shape.
- Keep runbooks aligned to this document when adding new services.

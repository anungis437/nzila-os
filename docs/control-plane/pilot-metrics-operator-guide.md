# Control Plane Pilot Metrics Operator Guide

## Access

Pilot metrics surfaces:

- `/pilots?orgId=<org-uuid>`
- `/pilots/health?orgId=<org-uuid>`
- `/pilots/compare?orgId=<org-uuid>`
- `/pilots/reports?orgId=<org-uuid>`
- `/pilots/<pilotId>?orgId=<org-uuid>`

Control Plane APIs:

- `GET/POST /api/control-plane/pilot-metrics`
- `GET/PATCH /api/control-plane/pilot-metrics/{pilotId}`
- `GET /api/control-plane/pilot-metrics/{pilotId}/metrics`
- `GET /api/control-plane/pilot-metrics/{pilotId}/health`
- `GET /api/control-plane/pilot-metrics/{pilotId}/alerts`
- `GET /api/control-plane/pilot-metrics/{pilotId}/export?format=json|csv|markdown`

## Daily Operator Workflow

1. Open health dashboard and identify high-risk pilots.
2. Open pilot detail to inspect alerts and metric snapshots.
3. Recompute health (`/api/control-plane/pilot-metrics/{pilotId}/health?orgId=...&recompute=true`) after significant activity.
4. Export report package for customer/renewal/QBR stakeholders.

## API Guardrails

- Pilot APIs require authenticated Control Plane access.
- `orgId` is mandatory on pilot metric read/export routes.
- Empty states should be treated as missing pilot setup or missing runtime emits, not as errors.

## Empty States

If no metrics appear, verify:

- pilot definition exists and is `active`
- instrumentation events are being emitted by app routes
- orgId query parameter is provided

## Alert Response Playbook

- adoption low: run onboarding/intervention campaign
- SLA spike: investigate staffing and queue routing
- error spike: inspect service reliability and traces
- dead letters high: inspect integration mappings and retries
- revenue drop/mismatch: verify event attribution and payment pipeline

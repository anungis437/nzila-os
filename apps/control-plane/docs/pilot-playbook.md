# Pilot Playbook — Nzila OS Control Plane

## Purpose

This playbook guides pilot operators through creating pilots, validating live metrics,
and exporting proof-grade reports from the Control Plane.

## Week 1 — Access and Baseline

1. Start Control Plane and confirm auth is working.
2. Open pilot surfaces with org context:
	- `/pilots?orgId=<org-uuid>`
	- `/pilots/health?orgId=<org-uuid>`
	- `/pilots/compare?orgId=<org-uuid>`
	- `/pilots/reports?orgId=<org-uuid>`
3. Create or verify pilot definitions via `POST /api/control-plane/pilot-metrics`.
4. Confirm each active pilot has expected app scope (`union-eyes` or `zonga`).

## Week 2 — Runtime Verification

1. Trigger representative runtime actions in UnionEyes and Zonga.
2. Verify pilot API responses:
	- `GET /api/control-plane/pilot-metrics/{pilotId}/metrics?orgId=...`
	- `GET /api/control-plane/pilot-metrics/{pilotId}/health?orgId=...`
	- `GET /api/control-plane/pilot-metrics/{pilotId}/alerts?orgId=...`
3. Recompute health after activity spikes:
	- `GET /api/control-plane/pilot-metrics/{pilotId}/health?orgId=...&recompute=true`
4. Track risk movement (`low` / `medium` / `high`) and open alerts.

## Week 3 — Governance and Remediation

1. Review alert classes: adoption, SLA spike, errors, dead letters, revenue mismatch.
2. Confirm `orgId` and `pilotId` consistency in operational requests.
3. Confirm each pilot metric write path has trace + actor/system identity.
4. Document remediation actions and expected score impact.

## Week 4 — Evidence Packaging

1. Export report bundles:
	- `GET /api/control-plane/pilot-metrics/{pilotId}/export?orgId=...&format=json`
	- `GET /api/control-plane/pilot-metrics/{pilotId}/export?orgId=...&format=csv`
	- `GET /api/control-plane/pilot-metrics/{pilotId}/export?orgId=...&format=markdown`
2. Include health trend, alert timeline, and KPI deltas in QBR/renewal packet.
3. Record unresolved verification gaps separately from validated controls.

## Go/No-Go Criteria

| Criterion | Target |
|---|---|
| Pilot pages load with `orgId` context | ✅ |
| Pilot health score computed for each active pilot | ✅ |
| Open high-risk alerts triaged with owner/action | ✅ |
| Report exports generated (JSON + CSV + markdown) | ✅ |
| No synthetic seed/demo fallback in pilot proof paths | ✅ |

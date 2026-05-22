# Union Eyes Reports

Product-specific readiness assessments and deployment guidance.

## Reports

- `ue-defensibility-pack.md` — Defensibility analysis and competitive positioning
- `ue-procurement-pack-cupe.md` — CUPE pilot procurement materials
- `ue-roi-case-cupe.md` — ROI case study for CUPE pilot
- `claims-ledger.md` — Claims evidence ledger and verification references

## Institutional Longitudinal Intelligence

Union Eyes includes a deterministic, doctrine-safe observatory layer for
cross-institution continuity intelligence without generative AI outputs.

- Aggregation only: anonymized sector-level continuity trend aggregation
- Low-cardinality analysis: fixed-band stewardship transfer themes,
	onboarding survivability patterns, and modernization fragility archetypes
- Deterministic preprocessing: latest-per-institution normalization before
	sector aggregation
- Doctrine-safe reporting: refusal-first below k-anonymity floor, non-ranking,
	non-punitive language

Implementation:

- `apps/union-eyes/lib/intelligence/observatory/sectorContinuityObservatory.ts`
- `apps/union-eyes/lib/intelligence/__tests__/sectorContinuityObservatory.test.ts`

## Deterministic Report AI

ICRA adaptive report generation is deterministic and doctrine-governed.

- Doctrine: [ICRA deterministic report AI doctrine](../../../docs/categories/products-and-market/union-eyes/labor-continuity-intelligence/icra-deterministic-report-ai-doctrine.md)
- Trust notes: [ICRA trust center alignment notes](../../../docs/categories/products-and-market/union-eyes/labor-continuity-intelligence/icra-trust-center-alignment-notes.md)

### Review Route Runbook

The deterministic report AI slot follows a governed lifecycle:

1. Assessment submission persists `_adaptive` context.
2. Deterministic report slot is generated and persisted as pending review.
3. Human reviewer records approve/reject decision.
4. PDF render includes AI-assisted narrative only when review is approved.

Endpoint:

- `POST /api/icra/report/[assessmentId]/review`
- Route file: `apps/union-eyes/app/api/icra/report/[assessmentId]/review/route.ts`

Authentication:

- Header `x-cron-secret: <secret>` or `Authorization: Bearer <secret>`
- Secret source (one required):
	- `CRON_SECRET_KEY`
	- `CRON_SECRET`

Request body:

```json
{
	"action": "approve",
	"summary": "Approved after deterministic continuity and disclosure review.",
	"reviewerRole": "governance_reviewer"
}
```

Valid `action` values:

- `approve`
- `reject`

Valid `reviewerRole` values:

- `facilitator`
- `governance_reviewer`
- `exec_sponsor`

Example (PowerShell):

```powershell
$assessmentId = "00000000-0000-0000-0000-000000000000"
$baseUrl = "https://your-domain.example"
$secret = $env:CRON_SECRET_KEY

$payload = @{
	action = "approve"
	summary = "Approved after deterministic continuity and disclosure review."
	reviewerRole = "governance_reviewer"
} | ConvertTo-Json

Invoke-RestMethod `
	-Uri "$baseUrl/api/icra/report/$assessmentId/review" `
	-Method Post `
	-Headers @{ "x-cron-secret" = $secret } `
	-ContentType "application/json" `
	-Body $payload
```

Success response:

```json
{
	"success": true,
	"assessmentId": "00000000-0000-0000-0000-000000000000",
	"action": "approve",
	"reviewStatus": "approved"
}
```

Operational notes:

- If the slot cannot be resolved, endpoint returns `422` and no mutation is written.
- `submit` and PDF report routes emit warnings when deterministic slot cannot be resolved.
- Approved-only rendering remains enforced in `mapToPdfReportData`.

## Navigation

- Back to [Product Reports](../README.md)
- Union Eyes → See [docs/categories/products-and-market/union-eyes/](../../../docs/categories/products-and-market/union-eyes/)

# CoraGov Ingestion Guide

> How to submit Cora and Agrimo reports to the CoraGov governance pipeline.

## Overview

CoraGov ingestion transforms canonical reports from both Cora and Agrimo into
structured datasets preserving all 5 canonical sections:
**metrics, forecasts, risk_signals, supply_chain_events, provenance_refs**.

```
CanonicalReport → canonicalToCoraGovDataset() → CoraGovPayload → ingestion
```

The legacy `canonicalToCoraGovRows()` is still available for flat metric-only
row transforms but is no longer the primary ingestion path.

## Step 1 — Build a Canonical Report

```typescript
import {
  buildCanonicalReport,
  SourceApp,
  EntityScope,
} from '@nzila/agri-reporting'

const report = buildCanonicalReport({
  org_id: 'org_001',
  source_app: SourceApp.CORA,       // or SourceApp.AGRIMO
  report_type: 'cooperative_summary',
  title: 'Q1 2025 Cooperative Summary',
  entity_scope: EntityScope.COOPERATIVE,
  reporting_period: {
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-03-31T23:59:59.000Z',
  },
  metrics: [
    { key: 'compliance_rate', label: 'Compliance Rate', value: 94.2, unit: '%', period: 'Q1-2025' },
  ],
  extensions: { cora: { governance_tier: 'A' } },
})
```

## Step 2 — Validate

```typescript
import { validateCanonicalReport } from '@nzila/agri-reporting'

const result = validateCanonicalReport(report)
if (!result.ok) {
  console.error('Validation failed:', result.errors)
  return
}
```

## Step 3 — Build Ingestion Payload

```typescript
import { buildCoraGovPayload, SourceApp } from '@nzila/agri-reporting'

const ingestionResult = buildCoraGovPayload(SourceApp.CORA, [report])
if (!ingestionResult.accepted) {
  console.error('Rejected:', ingestionResult.reason)
  return
}
console.log(`Batch ${ingestionResult.batch_id}: ${ingestionResult.dataset_count} datasets`)
console.log('Validated sections:', ingestionResult.validated_sections)
```

## Step 4 — Simulate (Testing)

For integration testing without a live CoraGov endpoint:

```typescript
import { simulateCoraGovIngestion } from '@nzila/agri-reporting'

const result = simulateCoraGovIngestion(rawPayload)
if (result.accepted) {
  console.log(`Accepted: ${result.dataset_count} datasets`)
  console.log('Sections:', result.validated_sections)
}
```

## Dataset Format

Each canonical report becomes one `CoraGovDataset` containing all sections:

| Field | Source |
|-------|--------|
| `org_id` | Report `org_id` |
| `source_app` | `cora` or `agrimo` |
| `report_id` | Report `report_id` |
| `report_type` | Report `report_type` |
| `period_start` | Reporting period start |
| `period_end` | Reporting period end |
| `entity_scope` | `farm`, `cooperative`, `region`, or `national` |
| `generated_at` | Report generation timestamp |
| `schema_version` | `1.0.0` |
| `metrics` | Array of canonical metrics |
| `forecasts` | Array of canonical forecasts |
| `risk_signals` | Array of canonical risk signals |
| `supply_chain_events` | Array of canonical supply chain events |
| `provenance_refs` | Array of canonical provenance references |

## Test Fixtures

Located in `fixtures/agri/coragov/`:

| File | Purpose |
|------|---------|
| `cora-valid.json` | Valid Cora cooperative summary with 2 metrics |
| `agrimo-valid.json` | Valid Agrimo farm summary with 3 metrics, forecasts, risk signals, supply chain events |
| `cora-valid-full.json` | Full Cora fixture with all 5 sections populated |
| `agrimo-valid-full.json` | Full Agrimo fixture with all 5 sections populated |
| `invalid-source.json` | Invalid `source_app` — rejected by schema |
| `malformed-payload.json` | Multiple validation failures — empty strings, bad dates |
| `invalid-missing-provenance.json` | Empty `provenance_id` — fails provenance validation |
| `invalid-schema-drift.json` | Wrong schema version, invalid enums — schema drift detection |

## CI Enforcement

The workflow `.github/workflows/agri-gov-ingestion-check.yml` runs on every PR
that touches `packages/agri-reporting/**` or `fixtures/agri/coragov/**`.

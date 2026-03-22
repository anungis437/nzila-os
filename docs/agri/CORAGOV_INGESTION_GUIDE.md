# CoraGov Ingestion Guide

> How to submit Cora and Agrimo reports to the CoraGov governance pipeline.

## Overview

CoraGov ingestion transforms canonical reports from both Cora and Agrimo into
a flat row-based format suitable for governance table storage. The entire
pipeline runs through `@nzila/agri-reporting`:

```
CanonicalReport → canonicalToCoraGovRows() → CoraGovPayload → ingestion
```

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
console.log(`Batch ${ingestionResult.batch_id}: ${ingestionResult.row_count} rows`)
```

## Step 4 — Simulate (Testing)

For integration testing without a live CoraGov endpoint:

```typescript
import { simulateCoraGovIngestion } from '@nzila/agri-reporting'

const result = simulateCoraGovIngestion(rawPayload)
if (result.accepted) {
  console.log(`Accepted: ${result.row_count} rows`)
}
```

## Row Format

Each metric in a canonical report becomes one `CoraGovRow`:

| Field | Source |
|-------|--------|
| `org_id` | Report `org_id` |
| `source_app` | `cora` or `agrimo` |
| `report_id` | Report `report_id` |
| `report_type` | Report `report_type` |
| `period_start` | Reporting period start |
| `period_end` | Reporting period end |
| `entity_scope` | `farm`, `cooperative`, `region`, or `national` |
| `metric_key` | Metric key |
| `metric_label` | Metric display label |
| `metric_value` | Numeric value |
| `metric_unit` | Unit of measurement |
| `metric_period` | Metric period label |
| `generated_at` | Report generation timestamp |
| `schema_version` | `1.0.0` |

## Test Fixtures

Located in `fixtures/agri/coragov/`:

| File | Purpose |
|------|---------|
| `cora-valid.json` | Valid Cora cooperative summary with 2 metrics |
| `agrimo-valid.json` | Valid Agrimo farm summary with 3 metrics, forecasts, risk signals, supply chain events |
| `invalid-source.json` | Invalid `source_app` — rejected by schema |
| `malformed-payload.json` | Multiple validation failures — empty strings, bad dates |

## CI Enforcement

The workflow `.github/workflows/agri-gov-ingestion-check.yml` runs on every PR
that touches `packages/agri-reporting/**` or `fixtures/agri/coragov/**`.

# Canonical Reporting Schema

> The ONE output model for both Cora and Agrimo reporting.

## Design Principles

1. **Single schema** — both apps use `canonicalReportSchema` from `@nzila/agri-reporting`.
2. **Strict extension namespacing** — app-specific data goes in `extensions.cora` or `extensions.agrimo`.
3. **Versioned** — every report carries `schema_version` (currently `1.0.0`).
4. **Zod-validated** — runtime validation via `validateCanonicalReport()`.

## Schema Structure

```
CanonicalReport
├─ report_id         string
├─ org_id            string
├─ source_app        "cora" | "agrimo"
├─ schema_version    "1.0.0" (literal)
├─ reporting_period
│  ├─ start          ISO 8601 datetime
│  └─ end            ISO 8601 datetime
├─ entity_scope      "farm" | "cooperative" | "region" | "national"
├─ report_type       string
├─ title             string
├─ generated_at      ISO 8601 datetime
├─ metrics[]
│  ├─ key            string
│  ├─ label          string
│  ├─ value          number
│  ├─ unit           string
│  └─ period         string
├─ forecasts[]
│  ├─ forecast_type  string
│  ├─ target_period  string
│  ├─ predicted_value number
│  ├─ confidence_level "high" | "medium" | "low"
│  └─ model_version? string
├─ risk_signals[]
│  ├─ risk_type      string
│  ├─ severity       "critical" | "high" | "medium" | "low"
│  ├─ description    string
│  ├─ affected_entity? string
│  └─ mitigation?    string
├─ supply_chain_events[]
│  ├─ chain_id       string
│  ├─ step_type      string
│  ├─ status         string
│  ├─ timestamp      ISO 8601 datetime
│  ├─ location?      string
│  └─ quantity_kg?   number (≥0)
├─ provenance_refs[]
│  ├─ provenance_id  string
│  ├─ source_type    string
│  ├─ hash           string
│  └─ verified       boolean
└─ extensions?
   ├─ cora?          Record<string, unknown>
   └─ agrimo?        Record<string, unknown>
```

## Usage

### Import

```typescript
import {
  canonicalReportSchema,
  CANONICAL_SCHEMA_VERSION,
  SourceApp,
  EntityScope,
  buildCanonicalReport,
  validateCanonicalReport,
} from '@nzila/agri-reporting'
```

### Build

```typescript
const report = buildCanonicalReport({
  org_id: 'org_001',
  source_app: SourceApp.AGRIMO,
  report_type: 'farm_summary',
  title: 'H1 Farm Summary',
  entity_scope: EntityScope.FARM,
  reporting_period: {
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-06-30T23:59:59.000Z',
  },
  metrics: [
    { key: 'yield_kg', label: 'Yield', value: 18500, unit: 'kg', period: 'H1-2025' },
  ],
})
```

### Validate

```typescript
const result = validateCanonicalReport(payload)
if (result.ok) {
  // result.data is typed as CanonicalReport
} else {
  // result.errors is { path: string; message: string }[]
}
```

## Sub-schemas

Each section has its own Zod schema exported from `@nzila/agri-reporting`:

| Export | Type |
|--------|------|
| `canonicalMetricSchema` | `CanonicalMetric` |
| `canonicalForecastSchema` | `CanonicalForecast` |
| `canonicalRiskSignalSchema` | `CanonicalRiskSignal` |
| `canonicalSupplyChainEventSchema` | `CanonicalSupplyChainEvent` |
| `canonicalProvenanceRefSchema` | `CanonicalProvenanceRef` |
| `canonicalExtensionsSchema` | `CanonicalExtensions` |
| `canonicalReportSchema` | `CanonicalReport` |

## Versioning

- Current version: `1.0.0`
- The version is enforced as a Zod literal — reports with a different
  `schema_version` are rejected.
- When the schema evolves, bump `CANONICAL_SCHEMA_VERSION` and update the
  schema check script.

## CI Enforcement

`scripts/agri-reporting-schema-check.ts` runs 6 checks:

| Check | What It Validates |
|-------|-------------------|
| SCHEMA-CHK-001 | Minimal Cora report parses |
| SCHEMA-CHK-002 | Minimal Agrimo report parses |
| SCHEMA-CHK-003 | Invalid `source_app` rejected |
| SCHEMA-CHK-004 | Wrong `schema_version` rejected |
| SCHEMA-CHK-005 | Unknown extension namespace rejected |
| SCHEMA-CHK-006 | Full report with all sections validates |

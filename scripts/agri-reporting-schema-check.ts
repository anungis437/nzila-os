// ---------------------------------------------------------------------------
// scripts/agri-reporting-schema-check.ts
//
// CI enforcement: ensures that the canonical reporting schema is internally
// consistent and that both Cora- and Agrimo-sourced payloads validate.
//
// Referenced by .github/workflows/agri-core-check.yml
// ---------------------------------------------------------------------------

import { canonicalReportSchema, CANONICAL_SCHEMA_VERSION, SourceApp, EntityScope } from '../packages/agri-reporting/src/canonical-reporting-schema.js'

const FAILURES: string[] = []

function assert(condition: boolean, label: string): void {
  if (!condition) {
    FAILURES.push(label)
    console.error(`  ✗ ${label}`)
  } else {
    console.log(`  ✓ ${label}`)
  }
}

// ─── Check 1: Schema parses a minimal Cora report ─────────────────────────

const minimalCora = {
  report_id: 'crpt_test_1',
  org_id: 'org_001',
  source_app: SourceApp.CORA,
  schema_version: CANONICAL_SCHEMA_VERSION,
  reporting_period: {
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-03-31T23:59:59.000Z',
  },
  entity_scope: EntityScope.COOPERATIVE,
  report_type: 'cooperative_summary',
  title: 'Q1 2025 Cooperative Summary',
  generated_at: '2025-04-01T10:00:00.000Z',
  metrics: [],
}

const coraResult = canonicalReportSchema.safeParse(minimalCora)
assert(coraResult.success, 'SCHEMA-CHK-001 — Minimal Cora report parses')

// ─── Check 2: Schema parses a minimal Agrimo report ───────────────────────

const minimalAgrimo = {
  report_id: 'crpt_test_2',
  org_id: 'org_002',
  source_app: SourceApp.AGRIMO,
  schema_version: CANONICAL_SCHEMA_VERSION,
  reporting_period: {
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-06-30T23:59:59.000Z',
  },
  entity_scope: EntityScope.FARM,
  report_type: 'farm_summary',
  title: 'H1 2025 Farm Summary',
  generated_at: '2025-07-01T10:00:00.000Z',
  metrics: [
    { key: 'yield_kg', label: 'Yield (kg)', value: 12000, unit: 'kg', period: 'H1-2025' },
  ],
}

const agrimoResult = canonicalReportSchema.safeParse(minimalAgrimo)
assert(agrimoResult.success, 'SCHEMA-CHK-002 — Minimal Agrimo report parses')

// ─── Check 3: Invalid source_app rejected ─────────────────────────────────

const badSource = { ...minimalCora, source_app: 'pondu' }
const badSourceResult = canonicalReportSchema.safeParse(badSource)
assert(!badSourceResult.success, 'SCHEMA-CHK-003 — Invalid source_app rejected')

// ─── Check 4: Wrong schema version rejected ──────────────────────────────

const badVersion = { ...minimalCora, schema_version: '99.0.0' }
const badVersionResult = canonicalReportSchema.safeParse(badVersion)
assert(!badVersionResult.success, 'SCHEMA-CHK-004 — Wrong schema_version rejected')

// ─── Check 5: Extensions block is strict ──────────────────────────────────

const badExt = { ...minimalCora, extensions: { cora: {}, unknown_app: {} } }
const badExtResult = canonicalReportSchema.safeParse(badExt)
assert(!badExtResult.success, 'SCHEMA-CHK-005 — Unknown extension namespace rejected')

// ─── Check 6: Full payload with all sections validates ────────────────────

const fullPayload = {
  ...minimalCora,
  metrics: [
    { key: 'yield_kg', label: 'Yield', value: 5000, unit: 'kg', period: 'Q1-2025' },
  ],
  forecasts: [
    {
      forecast_type: 'yield',
      target_period: 'Q2-2025',
      predicted_value: 5500,
      confidence_level: 'high',
    },
  ],
  risk_signals: [
    {
      risk_type: 'drought',
      severity: 'medium',
      description: 'Below-average rainfall predicted',
    },
  ],
  supply_chain_events: [
    {
      chain_id: 'sc_001',
      step_type: 'harvest',
      status: 'completed',
      timestamp: '2025-03-15T08:00:00.000Z',
      quantity_kg: 2000,
    },
  ],
  provenance_refs: [
    {
      provenance_id: 'prov_001',
      source_type: 'field_audit',
      hash: 'sha256:abc123',
      verified: true,
    },
  ],
  extensions: {
    cora: { governance_tier: 'A' },
  },
}

const fullResult = canonicalReportSchema.safeParse(fullPayload)
assert(fullResult.success, 'SCHEMA-CHK-006 — Full report with all sections validates')

// ─── Summary ──────────────────────────────────────────────────────────────

console.log('')
if (FAILURES.length > 0) {
  console.error(`Schema check failed (${FAILURES.length} failure(s)):`)
  FAILURES.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
} else {
  console.log('All schema checks passed ✓')
}

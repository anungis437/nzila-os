# Agri Migration Scripts

Scripts for migrating data from the two legacy agri applications into the unified NzilaOS Agri Stack.

## Source Systems

| System | Legacy App | Archive | Description |
|--------|-----------|---------|-------------|
| Agrimo | Agrimo | `agrimo-ops-93470160.zip` | Field operations (producers, harvests, lots, quality, warehouse, shipments, payments) |
| Cora Insights | Cora | `cora-agri-insights-9f05be41.zip` | Analytics & intelligence (forecasts, price signals, risk scores) |

## Scripts

| Script | Purpose | Idempotent |
|--------|---------|------------|
| `import-agrimo-legacy.ts` | Imports Agrimo producers, crops, harvests, lots, quality, batches, warehouses, shipments, payments, certifications | ✅ |
| `import-cora-legacy.ts` | Imports Cora forecasts, price signals, risk scores into intelligence tables | ✅ |
| `reconciliation-report.ts` | Produces a reconciliation report comparing source counts vs canonical tables | N/A |

## Running

```bash
# Dry-run (default — no writes)
pnpm tsx scripts/migrations/agri/import-agrimo-legacy.ts --dry-run

# Live run
pnpm tsx scripts/migrations/agri/import-agrimo-legacy.ts --live

# Cora analytics import (can run independently of Agrimo)
pnpm tsx scripts/migrations/agri/import-cora-legacy.ts --live

# Reconciliation report (run after both imports)
pnpm tsx scripts/migrations/agri/reconciliation-report.ts
```

## Order of Operations

1. `import-agrimo-legacy.ts` — establishes producers + crops + harvests + lots + quality + warehouses + batches + shipments + payments + certifications
2. `import-cora-legacy.ts` — maps Cora forecasts, price signals, and risk scores into intelligence tables (references producers from step 1)
3. `reconciliation-report.ts` — verify counts, FK integrity, and report mismatches

## Idempotency

All import scripts use `legacySourceId` + `legacySourceSystem` columns.
On re-run, existing records are skipped (upsert by legacy key).

- Agrimo records: `legacySourceSystem = 'agrimo-ops'`
- Cora records: `legacySourceSystem = 'cora-insights'`

## Environment Variables

| Variable | Required By | Description |
|----------|------------|-------------|
| `DATABASE_URL` | All scripts | NzilaOS destination database |
| `LEGACY_AGRIMO_DATABASE_URL` | `import-agrimo-legacy.ts` | Legacy Agrimo database |
| `LEGACY_CORA_DATABASE_URL` | `import-cora-legacy.ts` | Legacy Cora Insights database |

## Rollback

See [docs/agri/08-cutover-plan.md](../../../docs/agri/08-cutover-plan.md) for full rollback procedure.

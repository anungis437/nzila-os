# Agri Stack — Cutover Plan

## Migration Strategy

### Source Systems

| System | Source | Target |
|--------|--------|--------|
| Agrimo (legacy) | `agrimo-ops-93470160.zip` | `apps/agrimo` + shared packages |
| Cora Insights (legacy) | `cora-agri-insights-9f05be41.zip` | `apps/cora` + shared packages |

### Migration Phases

#### Phase 1 — Schema Mapping (Week 1)

1. Extract legacy data schemas from both ZIP archives
2. Map legacy fields → canonical agri tables
3. Identify unmappable fields (store in `metadata` JSONB)
4. Document mapping in `docs/agri/migration-mapping.md`

#### Phase 2 — Import Tool Development (Week 2)

1. Build `import-agrimo-legacy` CLI tool
   - Read legacy Agrimo data (CSV/JSON)
   - Normalize to canonical tables
   - Generate org context (assign org_id)
   - Insert via audited scoped DB
   - Emit migration audit events

2. Build `import-cora-legacy` CLI tool
   - Read legacy Cora analytics data
   - Normalize to intelligence tables
   - Map model outputs to `agri_forecasts` schema

#### Phase 3 — Dry Run Import (Week 3)

1. Run imports against staging database
2. Generate reconciliation report:
   - Row counts per table (expected vs actual)
   - Missing foreign key references
   - Duplicate detection (by natural keys)
   - Unmapped field inventory
3. Fix mapping issues and re-run

#### Phase 4 — Production Cutover (Week 4)

1. Freeze legacy system writes
2. Take final export from legacy
3. Run production import
4. Verify reconciliation report
5. Enable Agrimo + Cora for org
6. Monitor for 48h before decommissioning legacy

### Reconciliation Report Format

```
╔══════════════════════════════════════════════╗
║         AGRI MIGRATION RECONCILIATION        ║
╠══════════════════════════════════════════════╣
║ Source: agrimo-ops-93470160                   ║
║ Target: agri-db (staging)                    ║
║ Run at: 2026-02-27T10:00:00Z                ║
╠══════════════════════════════════════════════╣
║ Table                  │ Source │ Target │ Δ  ║
║ agri_producers         │  1,247 │  1,247 │  0 ║
║ agri_harvests          │ 14,392 │ 14,390 │ -2 ║
║ agri_lots              │  2,103 │  2,103 │  0 ║
║ agri_quality_inspections│ 1,980 │  1,980 │  0 ║
║ ...                    │        │        │    ║
╠══════════════════════════════════════════════╣
║ Warnings:                                    ║
║ - 2 harvests skipped (missing producer ref)  ║
║ - 15 records have unmapped fields → metadata ║
╠══════════════════════════════════════════════╣
║ Duplicates detected: 0                       ║
║ Missing FK references: 2                     ║
╚══════════════════════════════════════════════╝
```

### Rollback Plan

1. Keep legacy system in read-only mode for 30 days
2. If rollback needed:
   - Disable Agrimo + Cora
   - Re-enable legacy write access
   - Export any new data created in NzilaOS
3. Migration audit trail preserved regardless of rollback

### Idempotency

All imports are idempotent:

- Use natural keys for dedup (producer name + org, lot ref + org, etc.)
- Upsert semantics — re-running import updates existing records
- Migration audit events include `migration_run_id` for traceability

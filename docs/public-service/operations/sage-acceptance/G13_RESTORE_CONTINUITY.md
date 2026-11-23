# G13 — Restore and continuity (engineering package)

**Gate status:** Azure PITR / staging restore remains `NOT_PROVEN`.  
Local harness: `pnpm sage:b005:restore` → `RESTORE_HARNESS_PASS` proves fictional
bootstrap dump/restore + revoked-holding non-resurrection in PGlite only.

## Local harness (achievable without Azure)

```bash
pnpm sage:b005:restore -- --receipt reports/proof-runs/sage-b005-restore.json
```

Pass criteria (local only):

- SAGE tables present after restore
- Multi-tenant workspaces preserved
- Revoked office holding remains revoked (no active resurrection)
- Mandate tail (0050–0052 objects) present

## Staging drill (external)

1. Isolated PITR or `pg_dump`/`pg_restore` into scratch DB in staging RG
2. Confirm tenant boundary + audit chain integrity
3. Confirm revoked access does not resurrect
4. File receipt; leave G13 `NOT_PROVEN` until that receipt exists

Generic platform drill: `pnpm db:restore-drill` (not SAGE-specific).

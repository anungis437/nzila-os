# Phase 1B.1-R2A — Import Resolution Closeout

**Status: IMPORT_RESOLUTION_COMPLETE**
**Phase 1B.1: NOT YET CLOSED**
**Phase 1B.2: NOT AUTHORIZED**

## Scope and evidence boundary

This closeout resolves exactly 966 records selected from the accepted R2N audit by `originClass === 'UNRESOLVED_SCHEMA_IMPORT_RESIDUAL'` and `STATIC_EVIDENCE_PATH_REMAINING === 'YES'`. It uses the Union Eyes TypeScript configuration and follows only the matching non-type-only import declarations and named exports. No product code, imports, aliases, exports, schema declarations, migrations, or runtime databases were changed.

The seven initial `DECLARATION_NOT_EXPORTED` labels are input gap classifications, not presumed outcomes. The generator records the current configured module/export result for each exact import. Companion type-only imports are not separate R2A records.

## Input and resolution counts

| Initial R2N gap class         | Count |
| ----------------------------- | ----- |
| ALIAS_RESOLUTION_NOT_FOLLOWED | 959   |
| DECLARATION_NOT_EXPORTED      | 7     |
| SUM                           | 966   |

| Final R2A disposition             | Count |
| --------------------------------- | ----- |
| KNOWN_MISSING_NAMED_EXPORT        | 2     |
| MODULE_AND_NAMED_EXPORTS_RESOLVED | 964   |
| SUM                               | 966   |

Imports no longer requiring static resolution: **966**.
Imports still requiring static resolution: **0**.

### Confirmed missing named exports (not repaired)

These are precise export-resolution defects in the existing source. This closeout does not repair them or infer table authority.

| Residual ID                                                                                                          | Import location                                            | Module                      | Missing export(s)                      |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------- | -------------------------------------- |
| unresolved-schema-import::apps/union-eyes/lib/settlement-recommendation-engine.ts::@/db/schema::883                  | apps/union-eyes/lib/settlement-recommendation-engine.ts:11 | @/db/schema                 | \_Claim                                |
| unresolved-schema-import::apps/union-eyes/services/currency-enforcement-service.ts::@/db/schema/domains/finance::931 | apps/union-eyes/services/currency-enforcement-service.ts:6 | @/db/schema/domains/finance | NewCrossBorderTransaction, t106Filings |

## Updated static-work accounting

| Work class                     | Before R2A | After R2A |
| ------------------------------ | ---------- | --------- |
| Authority-object paths         | 207        | 207       |
| Unresolved schema-import paths | 966        | 0         |
| Targetless-effect paths        | 56         | 56        |
| Total static paths remaining   | 1229       | 263       |

The 247 frozen Phase 1A unknown-effect chains and five R1 records remain separately preserved and are not R2A inputs. R2A links to 499 existing census schema-object IDs as source references only; it makes no authority determination.

## Gate

- `STATIC_WORK_REMAINS`
- Phase 1B.1: `NOT YET CLOSED`
- Phase 1B.2: `NOT AUTHORIZED`
- The 207 authority-object and 56 targetless-effect paths remain unprocessed.

## Reproduction and validation

- Generate artifacts: `node scripts/ue/resolve-r2a-imports.mjs`
- Exact-once record and count assertions run inside the generator.
- Documentation validation: `pnpm validate:docs`
- The complete per-import evidence index is in the adjacent JSON artifact.

# Union Eyes — Public-Schema Grant-Scope Census

Generated: 2026-09-02T14:58:57.402Z

Source of truth for "every canonical PUBLIC-schema table" is scripts/schema-duplicate-table-scan.ts's scanSchemaDeclarations() (db/schema/** only — does not include services/financial-service's own separate database boundary). This census answers scope-completeness for the eventual explicit-GRANT generator; it does NOT re-verify RLS policy correctness (see scripts/rls-verify.ts for that).

- Total canonical physical (schema, table) keys: 702
- Public-schema tables: 693
- Non-public-schema tables: 9 (schemas: audit_security, user_management)
- Public tables WITH an authority-manifest entry: 693
- Public tables WITHOUT an authority-manifest entry: 0

## Public tables missing an authority-manifest entry

(none)

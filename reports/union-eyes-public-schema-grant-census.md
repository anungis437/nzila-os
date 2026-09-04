# Union Eyes — Public-Schema Grant-Scope Census

Generated: 2026-09-04T00:12:56.478Z

PR #752 round 8 terminology correction: scanSchemaDeclarations() (+ the ADDITIONAL_PUBLIC_SCHEMA_FILES merge below, for sibling files outside db/schema/** that SCHEMA_ROOT's walk never visits) proves a table is DECLARED in TypeScript/Drizzle source — it does NOT independently prove the table exists in the deployed PostgreSQL catalog, in migration history, with the expected schema, or that the declaration is not itself an orphaned/stale artifact. Do not read these counts as "live physical tables" until cross-referenced against pg_catalog/information_schema and migration history (tracked separately, see rlsVerificationTier below — currently DECLARED only, no live-catalog evidence in this run). Does not include services/financial-service's own separate database boundary. This census answers scope-completeness for the eventual explicit-GRANT generator; it does NOT re-verify RLS policy correctness (see scripts/rls-verify.ts for that).

- Additional declaration files merged (outside db/schema/**): db/schema-organizations.ts, db/schema-applications.ts, db/data/communication.ts
- Total canonical DECLARED (schema, table) keys: 708
- Canonical DECLARED public-schema tables: 699
- Canonical DECLARED non-public-schema tables: 9 (schemas: audit_security, user_management)
- Public tables WITH an authority-manifest entry: 699
- Public tables WITHOUT an authority-manifest entry: 0

## Public tables missing an authority-manifest entry

(none)

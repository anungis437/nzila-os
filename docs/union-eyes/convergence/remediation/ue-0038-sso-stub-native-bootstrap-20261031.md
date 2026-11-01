# Gate 0 native PostgreSQL bootstrap: 0038 SSO stub shape repair (2026-10-31)

Baseline commit: `9c9cad7efe168d4b387a238ac38ea921c96e6f4e`. Branch: `agents/ue-cursor-final-closure`.

The exact-baseline GitHub Actions runs `41173179764` (PostgreSQL 15/16) and `41173179822` (disposable HTTP/browser) failed during migration `0038_gate0_integrity_columns` because `sso_providers.saml_entity_id` was absent. The combined Django bootstrap creates `sso_providers` with `id` and `organization_id`, whereas the PGlite fixture previously included the three SSO uniqueness columns, concealing the discrepancy.

Source correction: evolve `saml_entity_id`, `oidc_issuer`, and `oidc_client_id` as nullable, idempotent columns before evaluating duplicate-provider queries or creating unique indexes. Preserve existing SSO rows without synthetic provider identifiers. Update the PGlite fixture to match the actual minimal Django stub and test repeat application and null preservation. Preserve the existing migration tag and update its UNQUALIFIED source checksum. Rollback retains the three identity columns because they may predate this migration in another environment; it removes the uniqueness indexes.

Verification levels at authoring: source inspection only; PGlite test not executed in this session; PostgreSQL 15/16, complete Vitest/contract, HTTP/browser, staging, and production acceptance NOT established at this new commit. Existing unrelated full-contract failure: expired governance exceptions for apps/web and apps/zonga, which must be resolved by their accountable owners rather than silently extending expiry dates. This correction does not claim the remaining SSO stub columns or the full SSO login journey are operational.

No frozen defect provenance changed, no defect CLOSED, no independent reviewer or owner-persona ratification, no production GO.

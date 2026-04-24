# UNION EYES DB AND MIGRATION STATE

Date: 2026-04-23
Scope: Union Eyes database readiness for pilot and production

## Architecture Reality

Union Eyes currently uses two DB migration/control planes:

- Frontend/app-side Drizzle migration wrapper:
  - `apps/union-eyes/drizzle.config.ts`
  - `tooling/scripts/run-union-eyes-drizzle-migrate.mjs`
- Backend-side Django migrations:
  - `apps/union-eyes/backend/**/migrations`
  - Backend startup runs `python manage.py migrate --noinput` in `apps/union-eyes/backend/Dockerfile`

This means migration reliability depends on keeping Drizzle and Django ownership boundaries explicit and non-overlapping.

## Required Table Families (Code-Expected)

Based on schema exports and route usage, Union Eyes expects at least:

- Claims/grievances/workflow: `domains/claims`
- Member/steward/org membership: `domains/member`
- Governance/elections/committees: `domains/governance` and committee workspace schema
- Auth/session/policy (platform-auth tables and adapters used by auth routes)
- Cognition/AI-supporting domain tables (`domains/ml`, `domains/analytics`, cognition API routes)
- Integrations and external sync tables (`external_*`, `integration_configs`)

## Migration Determinism Assessment

Status: PASS WITH CONDITIONS

What is solid:

- Drizzle wrapper baselines existing DBs before applying migrations.
- Django container startup applies pending migrations with lock-aware migrate behavior.

What is risky:

- Dual ORM/migration planes raise drift risk if table ownership is unclear.
- This audit did not directly introspect production DB table parity.

## Current Confidence Verdict

- DB safe for pilot: PASS WITH CONDITIONS
- DB safe for production: FAIL (insufficient direct parity proof)

Reason production is FAIL:

- No direct, environment-targeted DB introspection evidence was collected in this pass to prove all required table families exist in the live production database.

## Manual/Operational Steps Still Required

1. Run schema parity check against staging DB.
2. Run schema parity check against production DB.
3. Confirm no table overlap between Django-owned and Drizzle-owned namespaces.
4. Verify auth-critical tables for sessions, invites, magic links, MFA, and policy.
5. Verify cognition-dependent tables used by live AI/cognition endpoints.

## Deployment Break Risks

- Missing table in either migration plane for a route that assumes it exists.
- Schema drift where Drizzle model shape and DB reality diverge.
- Production migration executing while stale env vars point to unintended DB.
- Silent mismatch in auth tables causing login/invite/magic-link regressions.

## Required Verification Commands (Per Environment)

Use both app-level and DB-level checks in each target environment.

1. Application health:

- `GET /api/health`
- `GET /api/version`

2. Migration state:

- Drizzle wrapper execution logs from `pnpm --filter @nzila/union-eyes db:migrate`
- Django migration logs from backend container startup

3. DB parity SQL (example checks):

- Claims/grievance core tables present
- Member/steward tables present
- Governance/elections tables present
- Auth policy/session tables present
- Integration config/external sync tables present

## Final DB Gate

Production DB gate is green only when:

- All required table families are confirmed present in production DB.
- No pending unapplied migrations in either Drizzle or Django plane.
- Route-level smoke tests for claims/auth/cognition pass against production runtime.
- Migration evidence is attached to release artifact.

-- scripts/rls-manual-proof.sql — verified, direct-psql cross-tenant
-- isolation matrix for the RLS tenant-isolation foundation
-- (db/migrations/0108_rls_tenant_isolation_foundation.sql).
--
-- This is the reference proof this migration actually shipped against
-- (2026-09-01, local disposable Postgres 15). scripts/rls-verify.ts
-- --mode=full attempts to automate this same matrix but has an unresolved,
-- environment-specific intermittent failure in its bootstrap step on
-- Windows + Docker Desktop (see the KNOWN ISSUE note in that file) — this
-- script is what to run instead if that happens.
--
-- Usage against a disposable database only:
--   psql -U <admin> -h <host> -p <port> -d <db> -f scripts/rls-manual-proof.sql
--
-- Requires: union_eyes_runtime and union_eyes_system already provisioned
-- with LOGIN passwords (see scripts/provision-runtime-db-roles.ts), and a
-- `grievances` table with an `organization_id` column. Edit the two
-- \c connection-string lines below to match your target roles/passwords
-- before running — they are intentionally left as placeholders, never as
-- real credentials, in this committed copy.

-- 1. Bootstrap fixtures as union_eyes_system (unconditional access).
\c postgresql://union_eyes_system:REPLACE_WITH_SYSTEM_ROLE_PASSWORD@localhost:5432/REPLACE_WITH_DB_NAME
BEGIN;
INSERT INTO organizations (id, name, slug) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Manual Proof Org A', 'manual-proof-org-a'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Manual Proof Org B', 'manual-proof-org-b');
INSERT INTO grievances (id, organization_id) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
COMMIT;

-- 2. Prove isolation as union_eyes_runtime, Org A context.
\c postgresql://union_eyes_runtime:REPLACE_WITH_RUNTIME_ROLE_PASSWORD@localhost:5432/REPLACE_WITH_DB_NAME
BEGIN;
SELECT set_config('app.current_user_id', 'manual_proof_user_a', true);
SELECT set_config('app.current_org_id', 'aaaaaaaa-0000-0000-0000-000000000001', true);

\echo '--- Org A context: SELECT grievances (expect exactly 1 row, Org A''s) ---'
SELECT id, organization_id FROM grievances;

\echo '--- Org A context: direct known Org B row read (expect 0 rows) ---'
SELECT id FROM grievances WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';

\echo '--- Org A context: UPDATE targeting Org B row (expect 0 rows affected) ---'
UPDATE grievances SET organization_id = organization_id WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';

\echo '--- Org A context: DELETE targeting Org B row (expect 0 rows affected) ---'
DELETE FROM grievances WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';

\echo '--- Org A context: INSERT forging Org B organization_id (expect ERROR) ---'
INSERT INTO grievances (id, organization_id) VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');

ROLLBACK;

-- 3. Symmetric proof for Org B context.
BEGIN;
SELECT set_config('app.current_user_id', 'manual_proof_user_b', true);
SELECT set_config('app.current_org_id', 'aaaaaaaa-0000-0000-0000-000000000002', true);

\echo '--- Org B context: SELECT grievances (expect exactly 1 row, Org B''s) ---'
SELECT id, organization_id FROM grievances;

\echo '--- Org B context: direct known Org A row read (expect 0 rows) ---'
SELECT id FROM grievances WHERE id = 'bbbbbbbb-0000-0000-0000-000000000001';

ROLLBACK;

-- 4. No-context proof (fail closed).
BEGIN;
SELECT set_config('app.current_user_id', '', true);
SELECT set_config('app.current_org_id', '', true);
\echo '--- No context: SELECT grievances (expect 0 rows) ---'
SELECT id FROM grievances;
ROLLBACK;

-- 5. Cleanup, as union_eyes_system.
\c postgresql://union_eyes_system:REPLACE_WITH_SYSTEM_ROLE_PASSWORD@localhost:5432/REPLACE_WITH_DB_NAME
BEGIN;
DELETE FROM grievances WHERE organization_id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
DELETE FROM organizations WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002');
COMMIT;
\echo '--- Cleanup verification (expect 0 rows) ---'
SELECT count(*) FROM organizations WHERE slug LIKE 'manual-proof-%';

-- SAGE B-005 least-privilege role bootstrap for isolated PostgreSQL.
-- Mirrors packages/sage-core/src/records-postgres-server.test.ts
-- Do not grant these roles superuser. Do not apply to production without review.

DO $$ BEGIN CREATE ROLE sage_app NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE sage_internal_exec NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE sage_recipient NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO sage_app, sage_internal_exec, sage_recipient;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO sage_app, sage_internal_exec;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO sage_recipient;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sage_app, sage_internal_exec;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO sage_app, sage_internal_exec;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO sage_recipient;

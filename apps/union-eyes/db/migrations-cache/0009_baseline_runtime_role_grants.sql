-- 0009_baseline_runtime_role_grants
--
-- Canonical baseline privilege layer for the RLS tenant-isolation foundation,
-- carried forward verbatim from db/migrations/0108 PART 3 into the ACTIVE
-- scoped migration lineage. A source-native bootstrap never replays the frozen
-- 0108 lineage, so without this migration the two application principals hold
-- privileges on only the handful of tables the specialized closures
-- (0006-0008) touch — leaving the application unusable (Django itself runs as
-- union_eyes_runtime). This restores the established broad-baseline DML
-- envelope the application is built around.
--
-- Scope discipline:
--   * Roles are REFERENCED here, never created (role provisioning owns that).
--   * No LOGIN, no password, no SUPERUSER, no BYPASSRLS, no CREATE ROLE.
--   * Baseline layer ONLY — this does NOT re-declare the RLS ENABLE/POLICY
--     statements or the per-table specialized grants owned by 0006-0008.
--   * RLS remains the authoritative row-level boundary for protected tables;
--     ordinary table grants are necessary but not sufficient there.
--   * Per-table database least privilege is a deferred hardening track and is
--     explicitly NOT established here.
GRANT USAGE ON SCHEMA public TO union_eyes_runtime, union_eyes_system;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO union_eyes_runtime, union_eyes_system;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO union_eyes_runtime, union_eyes_system;--> statement-breakpoint
-- No future-table auto-grant: retract any sticky default privilege a prior
-- revision may have applied. REVOKE on a never-granted privilege is a no-op,
-- so this is safe/idempotent on a fresh database and preserves 0108's explicit
-- "new tables are not auto-granted" invariant.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM union_eyes_runtime, union_eyes_system;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM union_eyes_runtime, union_eyes_system;--> statement-breakpoint
DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO union_eyes_runtime, union_eyes_system', current_database()); END $$;

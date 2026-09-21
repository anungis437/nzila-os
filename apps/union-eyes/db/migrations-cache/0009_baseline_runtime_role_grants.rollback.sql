-- 0009_baseline_runtime_role_grants — rollback
--
-- Retracts the baseline privilege envelope granted by
-- 0009_baseline_runtime_role_grants.sql. Roles are NOT dropped here (role
-- provisioning owns their lifecycle). This is a manual-rollback aid only; the
-- fresh-bootstrap executor never applies rollback files.
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system;--> statement-breakpoint
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system;--> statement-breakpoint
REVOKE USAGE ON SCHEMA public FROM union_eyes_runtime, union_eyes_system;

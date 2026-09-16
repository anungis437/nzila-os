-- Fail-closed rollback for 0008_runtime_acceptance_closure.sql.
-- The checksum column is retained to avoid destructive data loss.

REVOKE INSERT ON TABLE "audit_security"."audit_logs" FROM "union_eyes_runtime";
REVOKE USAGE ON SCHEMA "audit_security" FROM "union_eyes_runtime";
DROP POLICY IF EXISTS "ue_runtime_audit_insert" ON "audit_security"."audit_logs";

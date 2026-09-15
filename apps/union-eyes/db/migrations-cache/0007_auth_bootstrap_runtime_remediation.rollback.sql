-- Rollback for 0007_auth_bootstrap_runtime_remediation.sql.
--
-- Non-destructive: remove the grants/policies added by the remediation, but
-- retain user_management.user_sessions and any issued sessions for auditability.

REVOKE SELECT, UPDATE ON TABLE "user_management"."users" FROM "union_eyes_system";
REVOKE SELECT ON TABLE "user_management"."organization_users" FROM "union_eyes_system";
REVOKE SELECT, INSERT ON TABLE "user_management"."auth_audit_log" FROM "union_eyes_system";
REVOKE SELECT ON TABLE "user_management"."mfa_totp" FROM "union_eyes_system";
REVOKE SELECT ON TABLE "user_management"."org_auth_policies" FROM "union_eyes_system";
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE "user_management"."user_sessions" FROM "union_eyes_system";

DROP POLICY IF EXISTS "ue_auth_bootstrap_users_system" ON "user_management"."users";
DROP POLICY IF EXISTS "ue_auth_bootstrap_users_select_system" ON "user_management"."users";
DROP POLICY IF EXISTS "ue_auth_bootstrap_users_update_system" ON "user_management"."users";
DROP POLICY IF EXISTS "ue_auth_bootstrap_organization_users_system" ON "user_management"."organization_users";
DROP POLICY IF EXISTS "ue_auth_bootstrap_audit_system" ON "user_management"."auth_audit_log";
DROP POLICY IF EXISTS "ue_auth_bootstrap_mfa_system" ON "user_management"."mfa_totp";
DROP POLICY IF EXISTS "ue_auth_bootstrap_org_policies_system" ON "user_management"."org_auth_policies";
DROP POLICY IF EXISTS "ue_auth_bootstrap_sessions_system" ON "user_management"."user_sessions";

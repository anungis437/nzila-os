-- Rollback for 0006_external_specialist_runtime_privilege_closure.sql.
-- Do not run against shared/live databases without an approved rollback window.
--
-- This rollback is intentionally non-destructive: it removes the runtime
-- reachability and policies introduced by the forward migration, but preserves
-- tables, types, indexes, and any governed records that may have been created.

REVOKE SELECT ON TABLE "user_management"."users" FROM "union_eyes_runtime";
REVOKE SELECT ON TABLE "user_management"."organization_users" FROM "union_eyes_runtime";
REVOKE USAGE ON SCHEMA "user_management" FROM "union_eyes_runtime";

REVOKE SELECT ON TABLE "representation_authorities" FROM "union_eyes_runtime";
REVOKE SELECT ON TABLE "external_matter_access_grants" FROM "union_eyes_runtime";
REVOKE SELECT, INSERT ON TABLE "external_document_access_grants" FROM "union_eyes_runtime";

DROP POLICY IF EXISTS "ue_auth_users_self_select" ON "user_management"."users";
DROP POLICY IF EXISTS "ue_auth_organization_users_self_select" ON "user_management"."organization_users";
DROP POLICY IF EXISTS "ue_external_authorities_select" ON "representation_authorities";
DROP POLICY IF EXISTS "ue_external_matter_grants_select" ON "external_matter_access_grants";
DROP POLICY IF EXISTS "ue_external_document_grants_select" ON "external_document_access_grants";
DROP POLICY IF EXISTS "ue_external_document_grants_insert_self" ON "external_document_access_grants";

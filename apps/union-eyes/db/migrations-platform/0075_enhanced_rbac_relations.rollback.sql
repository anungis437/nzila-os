-- Platform migration rollback enhanced_rbac_relations
--
-- Creates 4 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: role_definitions, member_roles, permission_exceptions, rbac_audit_log.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=role_definitions,member_roles,permission_exceptions,rbac_audit_log --label=enhanced_rbac_relations --rollback
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_rollback$
DECLARE
  t text;
  held boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['member_roles', 'permission_exceptions', 'rbac_audit_log', 'role_definitions'] LOOP
    IF to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) IS NULL THEN CONTINUE; END IF;
    IF obj_description(to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END), 'pg_class') IS DISTINCT FROM 'platform-migration:enhanced_rbac_relations' THEN
      RAISE EXCEPTION 'rollback enhanced_rbac_relations refuses: % was not created by this migration.', t;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s)', CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) INTO held;
    IF held THEN
      RAISE EXCEPTION 'rollback enhanced_rbac_relations refuses: % holds rows; export them before removing the relation.', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['member_roles', 'permission_exceptions', 'rbac_audit_log', 'role_definitions'] LOOP
    EXECUTE format('DROP TABLE IF EXISTS %s', CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END);
  END LOOP;
END $ue_rollback$;

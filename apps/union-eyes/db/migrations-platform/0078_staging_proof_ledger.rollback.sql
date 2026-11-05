-- Platform migration rollback staging_proof_ledger
--
-- Creates 3 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: staging_proof_nonce_uses, staging_proof_runs, staging_proof_run_events.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=staging_proof_nonce_uses,staging_proof_runs,staging_proof_run_events --label=staging_proof_ledger --rollback
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_rollback$
DECLARE
  t text;
  held boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['staging_proof_run_events', 'staging_proof_runs', 'staging_proof_nonce_uses'] LOOP
    IF to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) IS NULL THEN CONTINUE; END IF;
    IF obj_description(to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END), 'pg_class') IS DISTINCT FROM 'platform-migration:staging_proof_ledger' THEN
      RAISE EXCEPTION 'rollback staging_proof_ledger refuses: % was not created by this migration.', t;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s)', CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) INTO held;
    IF held THEN
      RAISE EXCEPTION 'rollback staging_proof_ledger refuses: % holds rows; export them before removing the relation.', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['staging_proof_run_events', 'staging_proof_runs', 'staging_proof_nonce_uses'] LOOP
    EXECUTE format('DROP TABLE IF EXISTS %s', CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END);
  END LOOP;
END $ue_rollback$;

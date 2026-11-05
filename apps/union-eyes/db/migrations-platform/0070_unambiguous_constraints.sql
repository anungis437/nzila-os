-- platform-migration:unambiguous_constraints: one foreign key per column, one index per definition, and no CHECK left unvalidated (UE-CONV-H-007).
-- Django migrate runs first and names its own keys and indexes; the platform bootstrap then adds the declared ones under other names, so a column can carry both.
--   Foreign keys: eight columns carry two. Three pairs are the same key twice. Five pairs disagree: the Django key points at claims.id and the declared key at claims.claim_id, two different uuids, so no row
--   can satisfy both and the five grievance tables (assignments, communications, documents, settlements, transitions) could never be written. The declared key stays, the other goes.
--   Indexes: seven definitions exist twice (five Django implicit indexes beside a named one, two unique indexes beside the unique constraint the column already has); the constraint or named index stays.
--   CHECK: employer_payroll_runs_executor_pair (0021) and room_bookings_time_order (0041) were added NOT VALID and never validated; they are validated against the rows that exist.
-- Fail-closed: a key or index is dropped only when the one that stays exists, is valid and (for a key) points where the declaration says; a row that breaks a CHECK stops the migration.
-- The rollback restores each dropped key and index as Django migrate created it.
DO $foreign_keys$
DECLARE
  r record;
  dup record;
  target regclass;
  column_key smallint[];
  keep_oid oid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    ('public', 'cba_clauses', 'cba_id', 'collective_agreements', 'id', 'cba_clauses_cba_id_collective_agreements_id_fk'),
    ('public', 'grievance_assignments', 'claim_id', 'claims', 'claim_id', 'grievance_assignments_claim_id_claims_claim_id_fk'),
    ('public', 'grievance_communications', 'claim_id', 'claims', 'claim_id', 'grievance_communications_claim_id_claims_claim_id_fk'),
    ('public', 'grievance_documents', 'claim_id', 'claims', 'claim_id', 'grievance_documents_claim_id_claims_claim_id_fk'),
    ('public', 'grievance_settlements', 'claim_id', 'claims', 'claim_id', 'grievance_settlements_claim_id_claims_claim_id_fk'),
    ('public', 'grievance_transitions', 'claim_id', 'claims', 'claim_id', 'grievance_transitions_claim_id_claims_claim_id_fk'),
    ('public', 'organization_members', 'organization_id', 'organizations', 'id', 'organization_members_organization_id_fkey'),
    ('public', 'strike_fund_disbursements', 'organization_id', 'organizations', 'id', 'strike_fund_disbursements_organization_id_organizations_id_fk')
    ) AS v(schema_name, table_name, column_name, ref_table, ref_column, keep_name)
    ORDER BY schema_name, table_name, column_name
  LOOP
    target := to_regclass(format('%I.%I', r.schema_name, r.table_name));
    IF target IS NULL THEN
      RAISE EXCEPTION 'platform unambiguous constraints fail-closed: %.% does not exist.', r.schema_name, r.table_name;
    END IF;
    SELECT array_agg(a.attnum) INTO column_key FROM pg_attribute a WHERE a.attrelid = target AND a.attname = r.column_name AND a.attnum > 0 AND NOT a.attisdropped;
    SELECT k.oid INTO keep_oid
      FROM pg_constraint k
     WHERE k.conrelid = target AND k.conname = r.keep_name AND k.contype = 'f' AND k.convalidated AND k.conkey = column_key
       AND k.confrelid = to_regclass(format('%I.%I', r.schema_name, r.ref_table))
       AND k.confkey = (SELECT array_agg(a.attnum) FROM pg_attribute a WHERE a.attrelid = k.confrelid AND a.attname = r.ref_column AND a.attnum > 0 AND NOT a.attisdropped);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'platform unambiguous constraints fail-closed: %.% has no validated foreign key % from % to %(%), so no other foreign key on that column is dropped.', r.schema_name, r.table_name, r.keep_name, r.column_name, r.ref_table, r.ref_column;
    END IF;
    FOR dup IN
      SELECT k.conname FROM pg_constraint k WHERE k.conrelid = target AND k.contype = 'f' AND k.oid <> keep_oid AND k.conkey = column_key ORDER BY k.conname
    LOOP
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.schema_name, r.table_name, dup.conname);
    END LOOP;
  END LOOP;
END
$foreign_keys$;
--> statement-breakpoint
DO $indexes$
DECLARE
  r record;
  dup record;
  target regclass;
  keep_oid oid;
  keep_definition text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    ('public', 'billing_accounts', 'billing_accounts_organization_id_unique'),
    ('public', 'cba_clauses', 'cba_clauses_cba_idx'),
    ('public', 'organization_relationships', 'idx_org_relationships_child'),
    ('public', 'organization_relationships', 'idx_org_relationships_parent'),
    ('public', 'organizations', 'idx_org_legacy_tenant'),
    ('public', 'organizations', 'idx_org_parent'),
    ('public', 'transaction_fee_events', 'transaction_fee_events_idempotency_key_unique')
    ) AS v(schema_name, table_name, keep_name)
    ORDER BY schema_name, table_name, keep_name
  LOOP
    target := to_regclass(format('%I.%I', r.schema_name, r.table_name));
    IF target IS NULL THEN
      RAISE EXCEPTION 'platform unambiguous constraints fail-closed: %.% does not exist.', r.schema_name, r.table_name;
    END IF;
    SELECT i.indexrelid, regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX \S+ ON', 'INDEX x ON') INTO keep_oid, keep_definition
      FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     WHERE i.indrelid = target AND c.relname = r.keep_name AND i.indisvalid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'platform unambiguous constraints fail-closed: %.% has no valid index % to keep, so no duplicate of it is dropped.', r.schema_name, r.table_name, r.keep_name;
    END IF;
    FOR dup IN
      SELECT c.relname, EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid) AS in_use
        FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
       WHERE i.indrelid = target AND i.indexrelid <> keep_oid AND i.indisvalid
         AND regexp_replace(pg_get_indexdef(i.indexrelid), 'INDEX \S+ ON', 'INDEX x ON') = keep_definition
       ORDER BY c.relname
    LOOP
      IF dup.in_use THEN
        RAISE EXCEPTION 'platform unambiguous constraints fail-closed: index %.% duplicates % but backs a constraint, so it cannot be dropped as an index.', r.schema_name, dup.relname, r.keep_name;
      END IF;
      EXECUTE format('DROP INDEX %I.%I', r.schema_name, dup.relname);
    END LOOP;
  END LOOP;
END
$indexes$;
--> statement-breakpoint
DO $validate$
DECLARE
  r record;
  target regclass;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    ('public', 'employer_payroll_runs', 'employer_payroll_runs_executor_pair'),
    ('public', 'room_bookings', 'room_bookings_time_order')
    ) AS v(schema_name, table_name, constraint_name)
    ORDER BY schema_name, table_name, constraint_name
  LOOP
    target := to_regclass(format('%I.%I', r.schema_name, r.table_name));
    IF target IS NULL OR NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = target AND k.conname = r.constraint_name AND NOT k.convalidated) THEN
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I VALIDATE CONSTRAINT %I', r.schema_name, r.table_name, r.constraint_name);
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'platform unambiguous constraints fail-closed: rows of %.% violate %; repair or remove them before this migration.', r.schema_name, r.table_name, r.constraint_name;
    END;
  END LOOP;
END
$validate$;

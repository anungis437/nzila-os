-- Rollback of platform-migration:unambiguous_constraints. It restores the foreign keys and indexes that migration dropped, as Django migrate created them, so the table holds the two keys (or two indexes) again.
-- The two CHECK constraints it validated stay validated: a validated constraint protects more, and marking one NOT VALID again would only discard that.
-- Fail-closed: the five Django keys to claims.id cannot be restored over a grievance row that names a claims.claim_id value, because claims.id never holds it; the rollback stops rather than falsify or delete that row.
DO $rollback$
DECLARE
  r record;
  target regclass;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
    ('public', 'cba_clauses', 'cba_clauses_cba_id_4ccb6ac6_fk_collective_agreements_id', 'ALTER TABLE "public"."cba_clauses" ADD CONSTRAINT "cba_clauses_cba_id_4ccb6ac6_fk_collective_agreements_id" FOREIGN KEY ("cba_id") REFERENCES "public"."collective_agreements" ("id") DEFERRABLE INITIALLY DEFERRED'),
    ('public', 'grievance_assignments', 'grievance_assignments_claim_id_1c041af1_fk_claims_id', 'ALTER TABLE "public"."grievance_assignments" ADD CONSTRAINT "grievance_assignments_claim_id_1c041af1_fk_claims_id" FOREIGN KEY ("claim_id") REFERENCES "public"."claims" ("id") DEFERRABLE INITIALLY DEFERRED'),
    ('public', 'grievance_communications', 'grievance_communications_claim_id_38efbb57_fk_claims_id', 'ALTER TABLE "public"."grievance_communications" ADD CONSTRAINT "grievance_communications_claim_id_38efbb57_fk_claims_id" FOREIGN KEY ("claim_id") REFERENCES "public"."claims" ("id") DEFERRABLE INITIALLY DEFERRED'),
    ('public', 'grievance_documents', 'grievance_documents_claim_id_6840cc51_fk_claims_id', 'ALTER TABLE "public"."grievance_documents" ADD CONSTRAINT "grievance_documents_claim_id_6840cc51_fk_claims_id" FOREIGN KEY ("claim_id") REFERENCES "public"."claims" ("id") DEFERRABLE INITIALLY DEFERRED'),
    ('public', 'grievance_settlements', 'grievance_settlements_claim_id_883b741d_fk_claims_id', 'ALTER TABLE "public"."grievance_settlements" ADD CONSTRAINT "grievance_settlements_claim_id_883b741d_fk_claims_id" FOREIGN KEY ("claim_id") REFERENCES "public"."claims" ("id") DEFERRABLE INITIALLY DEFERRED'),
    ('public', 'grievance_transitions', 'grievance_transitions_claim_id_001004b9_fk_claims_id', 'ALTER TABLE "public"."grievance_transitions" ADD CONSTRAINT "grievance_transitions_claim_id_001004b9_fk_claims_id" FOREIGN KEY ("claim_id") REFERENCES "public"."claims" ("id") DEFERRABLE INITIALLY DEFERRED'),
    ('public', 'organization_members', 'organization_members_organization_id_d55f4961_fk_organizat', 'ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_organization_id_d55f4961_fk_organizat" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") DEFERRABLE INITIALLY DEFERRED'),
    ('public', 'strike_fund_disbursements', 'strike_fund_disbursements_organization_id_fkey', 'ALTER TABLE "public"."strike_fund_disbursements" ADD CONSTRAINT "strike_fund_disbursements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON DELETE CASCADE')
    ) AS v(schema_name, table_name, constraint_name, ddl)
    ORDER BY schema_name, table_name, constraint_name
  LOOP
    target := to_regclass(format('%I.%I', r.schema_name, r.table_name));
    IF target IS NULL THEN
      RAISE EXCEPTION 'platform unambiguous constraints rollback fail-closed: %.% does not exist.', r.schema_name, r.table_name;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = target AND k.conname = r.constraint_name) THEN
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE r.ddl;
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'platform unambiguous constraints rollback fail-closed: rows of %.% do not satisfy the foreign key % that this rollback restores.', r.schema_name, r.table_name, r.constraint_name;
    END;
  END LOOP;
  FOR r IN
    SELECT * FROM (VALUES
    ('public', 'billing_accounts', 'billing_accounts_org_idx', 'CREATE UNIQUE INDEX "billing_accounts_org_idx" ON "public"."billing_accounts" USING btree ("organization_id")'),
    ('public', 'cba_clauses', 'cba_clauses_cba_id_4ccb6ac6', 'CREATE INDEX "cba_clauses_cba_id_4ccb6ac6" ON "public"."cba_clauses" USING btree ("cba_id")'),
    ('public', 'organization_relationships', 'organization_relationships_child_org_id_8bb5a4d4', 'CREATE INDEX "organization_relationships_child_org_id_8bb5a4d4" ON "public"."organization_relationships" USING btree ("child_org_id")'),
    ('public', 'organization_relationships', 'organization_relationships_parent_org_id_adbfccee', 'CREATE INDEX "organization_relationships_parent_org_id_adbfccee" ON "public"."organization_relationships" USING btree ("parent_org_id")'),
    ('public', 'organizations', 'organizations_legacy_tenant_id_f8e17631', 'CREATE INDEX "organizations_legacy_tenant_id_f8e17631" ON "public"."organizations" USING btree ("legacy_tenant_id")'),
    ('public', 'organizations', 'organizations_parent_id_b6fa9bcf', 'CREATE INDEX "organizations_parent_id_b6fa9bcf" ON "public"."organizations" USING btree ("parent_id")'),
    ('public', 'transaction_fee_events', 'txn_fee_events_idempotency_idx', 'CREATE UNIQUE INDEX "txn_fee_events_idempotency_idx" ON "public"."transaction_fee_events" USING btree ("idempotency_key")')
    ) AS v(schema_name, table_name, index_name, ddl)
    ORDER BY schema_name, table_name, index_name
  LOOP
    IF to_regclass(format('%I.%I', r.schema_name, r.table_name)) IS NULL THEN
      RAISE EXCEPTION 'platform unambiguous constraints rollback fail-closed: %.% does not exist.', r.schema_name, r.table_name;
    END IF;
    IF to_regclass(format('%I.%I', r.schema_name, r.index_name)) IS NOT NULL THEN
      CONTINUE;
    END IF;
    EXECUTE r.ddl;
  END LOOP;
END
$rollback$;

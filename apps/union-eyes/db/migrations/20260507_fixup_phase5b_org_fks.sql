-- Fixup: re-add FK constraints from 0001_phase5b_inter_union_features that
-- reference the `organizations` table. On a fresh database those constraints
-- are silently skipped during 0001 because `organizations` is only created
-- later in 0002_true_selene. This migration runs after 0002 and ensures the
-- constraints exist regardless of install path.
-- Existing databases where the constraints were applied in 0001 are unaffected
-- because each DO block catches duplicate_object.

DO $$ BEGIN
 ALTER TABLE "clause_comparisons_history" ADD CONSTRAINT "clause_comparisons_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_clause_library" ADD CONSTRAINT "shared_clause_library_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arbitration_precedents" ADD CONSTRAINT "arbitration_precedents_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "precedent_citations" ADD CONSTRAINT "precedent_citations_citing_organization_id_organizations_id_fk" FOREIGN KEY ("citing_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cross_org_access_log" ADD CONSTRAINT "cross_org_access_log_user_organization_id_organizations_id_fk" FOREIGN KEY ("user_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cross_org_access_log" ADD CONSTRAINT "cross_org_access_log_resource_owner_org_id_organizations_id_fk" FOREIGN KEY ("resource_owner_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_sharing_grants" ADD CONSTRAINT "organization_sharing_grants_grantor_org_id_organizations_id_fk" FOREIGN KEY ("grantor_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_sharing_grants" ADD CONSTRAINT "organization_sharing_grants_grantee_org_id_organizations_id_fk" FOREIGN KEY ("grantee_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_sharing_settings" ADD CONSTRAINT "organization_sharing_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

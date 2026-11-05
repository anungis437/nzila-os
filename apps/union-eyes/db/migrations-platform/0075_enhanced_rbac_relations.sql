-- Platform migration enhanced_rbac_relations
--
-- Creates 4 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: role_definitions, member_roles, permission_exceptions, rbac_audit_log.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=role_definitions,member_roles,permission_exceptions,rbac_audit_log --label=enhanced_rbac_relations
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_create$
DECLARE
  present text[];
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'platform enhanced_rbac_relations fail-closed: public.organizations does not exist (a foreign key target).';
  END IF;
  IF false THEN
    RAISE EXCEPTION 'platform enhanced_rbac_relations fail-closed: a schema these relations belong to does not exist.';
  END IF;
  SELECT array_agg(t ORDER BY t) INTO present FROM unnest(ARRAY['role_definitions', 'member_roles', 'permission_exceptions', 'rbac_audit_log']) AS t
   WHERE to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) IS NOT NULL;
  IF present IS NOT NULL THEN
    RAISE EXCEPTION 'platform enhanced_rbac_relations fail-closed: relations already exist and are not replaced: %', present;
  END IF;
END $ue_create$;
--> statement-breakpoint
CREATE TABLE public."role_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_code" varchar(100) NOT NULL,
	"role_name" varchar(255) NOT NULL,
	"role_description" text,
	"role_level" integer NOT NULL,
	"is_elected" boolean DEFAULT false NOT NULL,
	"requires_board_approval" boolean DEFAULT false NOT NULL,
	"default_term_years" integer,
	"can_delegate" boolean DEFAULT false NOT NULL,
	"can_have_multiple_holders" boolean DEFAULT true NOT NULL,
	"parent_role_code" varchar(100),
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_definitions_role_code_unique" UNIQUE("role_code"),
	CONSTRAINT "role_definitions_level_nonnegative" CHECK (role_level >= 0),
	CONSTRAINT "role_definitions_default_term_positive" CHECK (default_term_years IS NULL OR default_term_years > 0),
	CONSTRAINT "role_definitions_permissions_array" CHECK (jsonb_typeof(permissions) = 'array')
);
--> statement-breakpoint
COMMENT ON TABLE public."role_definitions" IS 'platform-migration:enhanced_rbac_relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."role_definitions" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."role_definitions" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."role_definitions" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."member_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role_code" varchar(100) NOT NULL,
	"scope_type" varchar(50) DEFAULT 'global' NOT NULL,
	"scope_value" varchar(255),
	"start_date" date DEFAULT CURRENT_DATE NOT NULL,
	"end_date" date,
	"term_years" integer,
	"next_election_date" date,
	"assignment_type" varchar(20) DEFAULT 'appointed' NOT NULL,
	"election_date" date,
	"elected_by" text,
	"vote_count" integer,
	"total_votes" integer,
	"vote_percentage" numeric(5, 2),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"suspension_reason" text,
	"suspended_at" timestamp with time zone,
	"suspended_by" text,
	"is_acting_role" boolean DEFAULT false NOT NULL,
	"acting_for_member_id" uuid,
	"acting_reason" text,
	"acting_start_date" date,
	"acting_end_date" date,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"approved_by" text,
	"approval_date" timestamp with time zone,
	"approval_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "member_roles_assignment_type_valid" CHECK (assignment_type IN ('elected', 'appointed', 'acting', 'emergency')),
	CONSTRAINT "member_roles_status_valid" CHECK (status IN ('active', 'expired', 'suspended', 'pending_approval')),
	CONSTRAINT "member_roles_end_after_start" CHECK (end_date IS NULL OR end_date >= start_date),
	CONSTRAINT "member_roles_acting_end_after_start" CHECK (acting_end_date IS NULL OR acting_start_date IS NULL OR acting_end_date >= acting_start_date),
	CONSTRAINT "member_roles_term_years_positive" CHECK (term_years IS NULL OR term_years > 0),
	CONSTRAINT "member_roles_votes_consistent" CHECK ((vote_count IS NULL OR vote_count >= 0) AND (total_votes IS NULL OR total_votes >= COALESCE(vote_count, 0))),
	CONSTRAINT "member_roles_vote_percentage_range" CHECK (vote_percentage IS NULL OR (vote_percentage >= 0 AND vote_percentage <= 100)),
	CONSTRAINT "member_roles_approval_recorded" CHECK (NOT (status = 'active' AND requires_approval AND approved_by IS NULL))
);
--> statement-breakpoint
COMMENT ON TABLE public."member_roles" IS 'platform-migration:enhanced_rbac_relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."member_roles" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."member_roles" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."member_roles" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."permission_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"permission" varchar(150) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"reason" text NOT NULL,
	"approved_by" text NOT NULL,
	"approval_date" timestamp with time zone DEFAULT now() NOT NULL,
	"approval_notes" text,
	"effective_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"revocation_reason" text,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"usage_limit" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permission_exceptions_usage_count_nonnegative" CHECK (usage_count >= 0),
	CONSTRAINT "permission_exceptions_usage_limit_positive" CHECK (usage_limit IS NULL OR usage_limit > 0),
	CONSTRAINT "permission_exceptions_expires_after_effective" CHECK (expires_at IS NULL OR expires_at > effective_date),
	CONSTRAINT "permission_exceptions_revocation_consistent" CHECK (revoked_at IS NULL OR NOT is_active)
);
--> statement-breakpoint
COMMENT ON TABLE public."permission_exceptions" IS 'platform-migration:enhanced_rbac_relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."permission_exceptions" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."permission_exceptions" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."permission_exceptions" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."rbac_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" bigint GENERATED ALWAYS AS IDENTITY (sequence name "rbac_audit_log_sequence_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text,
	"actor_role" text,
	"on_behalf_of_id" text,
	"on_behalf_of_name" text,
	"action" text NOT NULL,
	"action_category" text,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"resource_description" text,
	"organization_id" uuid NOT NULL,
	"organization_name" text,
	"required_permission" text,
	"granted" boolean NOT NULL,
	"grant_method" text,
	"denial_reason" text,
	"ip_address" text,
	"user_agent" text,
	"session_id" text,
	"request_id" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"changed_fields" text[],
	"record_hash" varchar(128) NOT NULL,
	"previous_hash" varchar(128),
	"execution_time_ms" integer,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"requires_review" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"review_notes" text,
	CONSTRAINT "rbac_audit_log_review_consistent" CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL))
);
--> statement-breakpoint
COMMENT ON TABLE public."rbac_audit_log" IS 'platform-migration:enhanced_rbac_relations';
--> statement-breakpoint
REVOKE ALL ON TABLE public."rbac_audit_log" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."rbac_audit_log" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."rbac_audit_log" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
ALTER TABLE public."role_definitions" ADD CONSTRAINT "role_definitions_parent_role_code_fk" FOREIGN KEY ("parent_role_code") REFERENCES "public"."role_definitions"("role_code") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."member_roles" ADD CONSTRAINT "member_roles_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."member_roles" ADD CONSTRAINT "member_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."member_roles" ADD CONSTRAINT "member_roles_role_code_role_definitions_role_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."role_definitions"("role_code") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."member_roles" ADD CONSTRAINT "member_roles_acting_for_member_id_organization_members_id_fk" FOREIGN KEY ("acting_for_member_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."permission_exceptions" ADD CONSTRAINT "permission_exceptions_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."permission_exceptions" ADD CONSTRAINT "permission_exceptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_role_definitions_level" ON public."role_definitions" USING btree ("role_level");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_roles_live_assignment" ON public."member_roles" USING btree ("member_id","role_code","scope_type",(coalesce(scope_value, ''))) WHERE status IN ('active', 'pending_approval', 'suspended');
--> statement-breakpoint
CREATE INDEX "idx_member_roles_member_organization" ON public."member_roles" USING btree ("member_id","organization_id");
--> statement-breakpoint
CREATE INDEX "idx_member_roles_organization_status" ON public."member_roles" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "idx_member_roles_role_code" ON public."member_roles" USING btree ("role_code");
--> statement-breakpoint
CREATE INDEX "idx_member_roles_end_date" ON public."member_roles" USING btree ("end_date") WHERE end_date IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_member_roles_next_election" ON public."member_roles" USING btree ("next_election_date") WHERE next_election_date IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_permission_exceptions_member_organization" ON public."permission_exceptions" USING btree ("member_id","organization_id") WHERE is_active;
--> statement-breakpoint
CREATE INDEX "idx_permission_exceptions_organization_permission" ON public."permission_exceptions" USING btree ("organization_id","permission");
--> statement-breakpoint
CREATE INDEX "idx_rbac_audit_log_organization_sequence" ON public."rbac_audit_log" USING btree ("organization_id","sequence_number");
--> statement-breakpoint
CREATE INDEX "idx_rbac_audit_log_organization_timestamp" ON public."rbac_audit_log" USING btree ("organization_id","timestamp");
--> statement-breakpoint
CREATE INDEX "idx_rbac_audit_log_actor" ON public."rbac_audit_log" USING btree ("organization_id","actor_id","timestamp");
--> statement-breakpoint
CREATE INDEX "idx_rbac_audit_log_resource" ON public."rbac_audit_log" USING btree ("organization_id","resource_type","resource_id");
--> statement-breakpoint
CREATE INDEX "idx_rbac_audit_log_denied" ON public."rbac_audit_log" USING btree ("organization_id","timestamp") WHERE NOT granted;
--> statement-breakpoint
CREATE INDEX "idx_rbac_audit_log_pending_review" ON public."rbac_audit_log" USING btree ("organization_id","timestamp") WHERE requires_review AND reviewed_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rbac_audit_log_record_hash" ON public."rbac_audit_log" USING btree ("organization_id","record_hash");
--> statement-breakpoint
DO $ue_post$
DECLARE
  wrong text[];
BEGIN
  SELECT array_agg(e.s || '.' || e.t ORDER BY e.s, e.t) INTO wrong
  FROM (VALUES ('public', 'role_definitions', 17), ('public', 'member_roles', 33), ('public', 'permission_exceptions', 21), ('public', 'rbac_audit_log', 34)) AS e(s, t, n)
  WHERE (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = e.s AND c.table_name = e.t) <> e.n
     OR obj_description(to_regclass(quote_ident(e.s) || '.' || quote_ident(e.t)), 'pg_class') IS DISTINCT FROM 'platform-migration:enhanced_rbac_relations';
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform enhanced_rbac_relations postflight: relations without the declared column count or tag: %', wrong;
  END IF;
  SELECT array_agg(e.s || '.' || e.t ORDER BY e.s, e.t) INTO wrong
  FROM (VALUES ('public', 'role_definitions', 17), ('public', 'member_roles', 33), ('public', 'permission_exceptions', 21), ('public', 'rbac_audit_log', 34)) AS e(s, t, n)
  WHERE (to_regrole('union_eyes_runtime') IS NOT NULL AND (has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'SELECT') OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'INSERT')
        OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'UPDATE') OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'DELETE')))
     OR (to_regrole('union_eyes_system') IS NOT NULL AND (has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'SELECT') OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'INSERT')
        OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'UPDATE') OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'DELETE')));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform enhanced_rbac_relations postflight: relations already carry runtime or system privileges before the manifest grants them: %', wrong;
  END IF;
END $ue_post$;

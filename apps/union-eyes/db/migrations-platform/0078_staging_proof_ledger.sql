-- Platform migration staging_proof_ledger
--
-- Creates 3 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: staging_proof_nonce_uses, staging_proof_runs, staging_proof_run_events.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=staging_proof_nonce_uses,staging_proof_runs,staging_proof_run_events --label=staging_proof_ledger
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_create$
DECLARE
  present text[];
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'platform staging_proof_ledger fail-closed: public.organizations does not exist (a foreign key target).';
  END IF;
  IF false THEN
    RAISE EXCEPTION 'platform staging_proof_ledger fail-closed: a schema these relations belong to does not exist.';
  END IF;
  SELECT array_agg(t ORDER BY t) INTO present FROM unnest(ARRAY['staging_proof_nonce_uses', 'staging_proof_runs', 'staging_proof_run_events']) AS t
   WHERE to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) IS NOT NULL;
  IF present IS NOT NULL THEN
    RAISE EXCEPTION 'platform staging_proof_ledger fail-closed: relations already exist and are not replaced: %', present;
  END IF;
END $ue_create$;
--> statement-breakpoint
CREATE TABLE public."staging_proof_nonce_uses" (
	"nonce" text PRIMARY KEY NOT NULL,
	"proof_run_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."staging_proof_nonce_uses" IS 'platform-migration:staging_proof_ledger';
--> statement-breakpoint
REVOKE ALL ON TABLE public."staging_proof_nonce_uses" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."staging_proof_nonce_uses" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."staging_proof_nonce_uses" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."staging_proof_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"scenario" text NOT NULL,
	"correlation_id" text NOT NULL,
	"status" text NOT NULL,
	"cleanup_passed" boolean,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staging_proof_runs_status_valid" CHECK ("staging_proof_runs"."status" IN ('started', 'completed', 'failed', 'cleanup_failed')),
	CONSTRAINT "staging_proof_runs_finalized_when_settled" CHECK (("staging_proof_runs"."status" = 'started') = ("staging_proof_runs"."finalized_at" IS NULL))
);
--> statement-breakpoint
COMMENT ON TABLE public."staging_proof_runs" IS 'platform-migration:staging_proof_ledger';
--> statement-breakpoint
REVOKE ALL ON TABLE public."staging_proof_runs" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."staging_proof_runs" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."staging_proof_runs" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."staging_proof_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proof_run_id" uuid NOT NULL,
	"scenario" text NOT NULL,
	"event_type" text NOT NULL,
	"correlation_id" text NOT NULL,
	"created_identifiers" jsonb,
	"expected_outcome" jsonb,
	"actual_outcome" jsonb,
	"cleanup_passed" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staging_proof_run_events_type_valid" CHECK ("staging_proof_run_events"."event_type" IN ('started', 'completed', 'failed', 'cleanup_failed'))
);
--> statement-breakpoint
COMMENT ON TABLE public."staging_proof_run_events" IS 'platform-migration:staging_proof_ledger';
--> statement-breakpoint
REVOKE ALL ON TABLE public."staging_proof_run_events" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."staging_proof_run_events" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."staging_proof_run_events" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
ALTER TABLE public."staging_proof_runs" ADD CONSTRAINT "staging_proof_runs_nonce_fk" FOREIGN KEY ("nonce") REFERENCES "public"."staging_proof_nonce_uses"("nonce") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."staging_proof_run_events" ADD CONSTRAINT "staging_proof_run_events_run_fk" FOREIGN KEY ("proof_run_id") REFERENCES "public"."staging_proof_runs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_staging_proof_nonce_uses_expires" ON public."staging_proof_nonce_uses" USING btree ("expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "staging_proof_runs_nonce_uidx" ON public."staging_proof_runs" USING btree ("nonce");
--> statement-breakpoint
CREATE INDEX "idx_staging_proof_run_events_run" ON public."staging_proof_run_events" USING btree ("proof_run_id");
--> statement-breakpoint
DO $ue_post$
DECLARE
  wrong text[];
BEGIN
  SELECT array_agg(e.s || '.' || e.t ORDER BY e.s, e.t) INTO wrong
  FROM (VALUES ('public', 'staging_proof_nonce_uses', 4), ('public', 'staging_proof_runs', 8), ('public', 'staging_proof_run_events', 10)) AS e(s, t, n)
  WHERE (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = e.s AND c.table_name = e.t) <> e.n
     OR obj_description(to_regclass(quote_ident(e.s) || '.' || quote_ident(e.t)), 'pg_class') IS DISTINCT FROM 'platform-migration:staging_proof_ledger';
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform staging_proof_ledger postflight: relations without the declared column count or tag: %', wrong;
  END IF;
  SELECT array_agg(e.s || '.' || e.t ORDER BY e.s, e.t) INTO wrong
  FROM (VALUES ('public', 'staging_proof_nonce_uses', 4), ('public', 'staging_proof_runs', 8), ('public', 'staging_proof_run_events', 10)) AS e(s, t, n)
  WHERE (to_regrole('union_eyes_runtime') IS NOT NULL AND (has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'SELECT') OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'INSERT')
        OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'UPDATE') OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'DELETE')))
     OR (to_regrole('union_eyes_system') IS NOT NULL AND (has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'SELECT') OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'INSERT')
        OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'UPDATE') OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'DELETE')));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform staging_proof_ledger postflight: relations already carry runtime or system privileges before the manifest grants them: %', wrong;
  END IF;
END $ue_post$;

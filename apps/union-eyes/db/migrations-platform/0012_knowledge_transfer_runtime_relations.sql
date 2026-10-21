--+ ============================================================================
-- Post-freeze PLATFORM_SQL SCHEMA_CREATION
-- Root: apps/union-eyes/db/migrations-platform/
-- File: 0012_knowledge_transfer_runtime_relations.sql
-- Owner: PLATFORM_SQL_OWNED (exactly one owner each)
-- Relations: ue_cognition_memory, ue_reasoning_sessions, ue_copilot_conversations
-- Evidence:
--   - Both relations were previously created by application code
--     (CREATE TABLE IF NOT EXISTS inside request paths in
--     lib/knowledge-transfer/{cognition-memory,reasoning-sessions,copilot}). Runtime
--     identities must not hold schema authority, so creation moves here.
--   - Tenant ownership is organization_id uuid NOT NULL, the canonical
--     contract for tenant tables. The runtime-created shape used org_id text.
--   - RLS (FORCE) lives in migrations-cache/0018. Grants come from the
--     storage-authority manifest at activation.
-- Legacy adoption: a relation already created by the old runtime code is
-- converted in place only when every id and org_id is a well-formed UUID.
-- Otherwise this migration fails closed rather than guessing ownership.
-- Forward-only. Does not modify frozen lineage.
--+ ============================================================================

DO $$
DECLARE
  t text;
  malformed bigint;
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  FOREACH t IN ARRAY ARRAY['ue_cognition_memory', 'ue_reasoning_sessions', 'ue_copilot_conversations'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'org_id'
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE id::text !~ %L OR org_id::text !~ %L',
      t, uuid_re, uuid_re
    ) INTO malformed;
    IF malformed > 0 THEN
      RAISE EXCEPTION 'platform 0012 fail-closed: % row(s) in legacy public.% have a malformed id or org_id; refusing to infer tenant ownership.', malformed, t;
    END IF;
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN org_id TO organization_id', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id TYPE uuid USING organization_id::uuid', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id TYPE uuid USING id::uuid', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid()', t);
    -- The old runtime identity created these relations and so owned them.
    EXECUTE format('ALTER TABLE public.%I OWNER TO %I', t, current_user);
  END LOOP;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_cognition_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  memory_type text NOT NULL,
  title text NOT NULL,
  context_summary text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resilience_score_at_capture integer,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  session_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_cognition_memory_org_idx ON ue_cognition_memory (organization_id, created_at DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_reasoning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  title text NOT NULL,
  focus text NOT NULL DEFAULT 'general_continuity',
  status text NOT NULL DEFAULT 'active',
  context_description text NOT NULL DEFAULT '',
  graph_state jsonb,
  active_simulations jsonb NOT NULL DEFAULT '[]'::jsonb,
  annotations jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_memory_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  latest_resilience_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_reasoning_sessions_org_idx ON ue_reasoning_sessions (organization_id, created_at DESC);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_copilot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  session_id text,
  title text NOT NULL DEFAULT 'Continuity Conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_copilot_conversations_org_idx ON ue_copilot_conversations (organization_id, created_at DESC);

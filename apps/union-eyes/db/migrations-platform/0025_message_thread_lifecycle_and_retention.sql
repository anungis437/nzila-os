-- PLATFORM_SQL 0025_message_thread_lifecycle_and_retention
--
-- Closing, archiving, legal holds, retention policy and read state for member conversations. RLS is scoped by cache
-- 0024; exact DML comes from the storage-authority manifest (db/rls-storage-authority/communications-notifications.ts).
--
--   message_thread_lifecycle     append-only history of every close, archive and legal-hold decision on a conversation,
--                                and how it was authorized (the member, the current assignee, an organization
--                                administrator). It never holds message text. A hold carries only a reference to the
--                                matter or authority that requires it.
--   message_retention_policies   an organization's ADOPTED retention period for closed conversations, recorded with the
--                                authority that adopted it. Append-only apart from supersession. No row means no policy
--                                has been adopted and nothing is ever eligible for disposition. This migration contains
--                                no deletion of any kind.
--   message_thread_reads         the last time each participant read a conversation, so a member can see whether the
--                                union has read their message and staff can see whether the member has.
--
-- message_threads itself gains guards: a conversation can only move to closed and archived (never reopen, never
-- un-archive), an archive requires a closed conversation, and a status or archive change is only valid together with its
-- lifecycle history record in the same transaction.

DO $$
BEGIN
  IF to_regclass('public.message_threads') IS NULL
     OR to_regclass('public.message_thread_assignments') IS NULL THEN
    RAISE EXCEPTION 'platform 0025 fail-closed: message_threads or message_thread_assignments does not exist (platform 0014 not applied).';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.message_thread_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigint GENERATED ALWAYS AS IDENTITY,
  organization_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.message_threads (id) ON DELETE RESTRICT,
  action text NOT NULL,
  acted_by text NOT NULL,
  acted_via text NOT NULL,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_lifecycle_action_valid CHECK (action IN ('close', 'archive', 'hold_place', 'hold_release')),
  CONSTRAINT message_lifecycle_via_valid CHECK (acted_via IN ('thread_member', 'current_assignee', 'organization_administrator')),
  CONSTRAINT message_lifecycle_hold_by_administrator CHECK ((action IN ('hold_place', 'hold_release')) = (acted_via = 'organization_administrator')),
  CONSTRAINT message_lifecycle_hold_reference CHECK ((action IN ('hold_place', 'hold_release')) = (reference IS NOT NULL AND length(btrim(reference)) > 0))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS message_thread_lifecycle_thread_idx
  ON public.message_thread_lifecycle (organization_id, thread_id, seq);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.message_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  policy_reference text NOT NULL,
  authority_reference text NOT NULL,
  retention_days integer NOT NULL,
  adopted_by text NOT NULL,
  adopted_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  superseded_by text,
  CONSTRAINT message_retention_days_ck CHECK (retention_days BETWEEN 1 AND 36500),
  CONSTRAINT message_retention_reference_ck CHECK (length(btrim(policy_reference)) > 0 AND length(btrim(authority_reference)) > 0),
  CONSTRAINT message_retention_supersession_pair CHECK ((superseded_at IS NULL) = (superseded_by IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS message_retention_policies_live_uq
  ON public.message_retention_policies (organization_id)
  WHERE superseded_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.message_thread_reads (
  thread_id uuid NOT NULL REFERENCES public.message_threads (id) ON DELETE RESTRICT,
  user_id text NOT NULL,
  organization_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_threads_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'closed' THEN
    RAISE EXCEPTION 'message_threads: a conversation can only move to closed' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.is_archived IS TRUE AND NEW.is_archived IS NOT TRUE THEN
    RAISE EXCEPTION 'message_threads: an archived conversation stays archived' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.is_archived IS TRUE AND OLD.is_archived IS NOT TRUE AND NEW.status <> 'closed' THEN
    RAISE EXCEPTION 'message_threads: only a closed conversation can be archived' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_threads_lifecycle_guard ON public.message_threads;
--> statement-breakpoint
CREATE TRIGGER message_threads_lifecycle_guard BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.message_threads_lifecycle_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_threads_lifecycle_requires_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT EXISTS (
    SELECT 1 FROM public.message_thread_lifecycle l
    WHERE l.thread_id = NEW.id AND l.organization_id = NEW.organization_id
      AND l.action = 'close' AND l.created_at = transaction_timestamp()
  ) THEN
    RAISE EXCEPTION 'message_threads: closing requires its lifecycle record' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.is_archived IS TRUE AND OLD.is_archived IS NOT TRUE AND NOT EXISTS (
    SELECT 1 FROM public.message_thread_lifecycle l
    WHERE l.thread_id = NEW.id AND l.organization_id = NEW.organization_id
      AND l.action = 'archive' AND l.created_at = transaction_timestamp()
  ) THEN
    RAISE EXCEPTION 'message_threads: archiving requires its lifecycle record' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_threads_lifecycle_requires_history ON public.message_threads;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER message_threads_lifecycle_requires_history AFTER UPDATE ON public.message_threads
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.message_threads_lifecycle_requires_history();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  thread public.message_threads%ROWTYPE;
  last_hold text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'message_thread_lifecycle is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';
  END IF;
  SELECT * INTO thread FROM public.message_threads t WHERE t.id = NEW.thread_id AND t.organization_id = NEW.organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'message_thread_lifecycle: the record does not match a conversation of its tenant' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.action = 'close' AND thread.status <> 'closed' THEN
    RAISE EXCEPTION 'message_thread_lifecycle: the conversation is not closed' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.action = 'archive' AND thread.is_archived IS NOT TRUE THEN
    RAISE EXCEPTION 'message_thread_lifecycle: the conversation is not archived' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.action IN ('close', 'archive') AND EXISTS (
    SELECT 1 FROM public.message_thread_lifecycle l WHERE l.thread_id = NEW.thread_id AND l.action = NEW.action
  ) THEN
    RAISE EXCEPTION 'message_thread_lifecycle: the conversation already has a % record', NEW.action USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.action IN ('hold_place', 'hold_release') THEN
    SELECT l.action INTO last_hold FROM public.message_thread_lifecycle l
      WHERE l.thread_id = NEW.thread_id AND l.action IN ('hold_place', 'hold_release')
      ORDER BY l.seq DESC LIMIT 1;
    IF NEW.action = 'hold_place' AND last_hold = 'hold_place' THEN
      RAISE EXCEPTION 'message_thread_lifecycle: the conversation is already under a legal hold' USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.action = 'hold_release' AND last_hold IS DISTINCT FROM 'hold_place' THEN
      RAISE EXCEPTION 'message_thread_lifecycle: the conversation is not under a legal hold' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_lifecycle_guard_write ON public.message_thread_lifecycle;
--> statement-breakpoint
CREATE TRIGGER message_lifecycle_guard_write BEFORE INSERT OR UPDATE OR DELETE ON public.message_thread_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.message_lifecycle_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_retention_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'message_retention_policies is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.superseded_at IS NOT NULL THEN
    RAISE EXCEPTION 'message_retention_policies: a superseded policy is final' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.policy_reference IS DISTINCT FROM OLD.policy_reference
     OR NEW.authority_reference IS DISTINCT FROM OLD.authority_reference
     OR NEW.retention_days IS DISTINCT FROM OLD.retention_days
     OR NEW.adopted_by IS DISTINCT FROM OLD.adopted_by
     OR NEW.adopted_at IS DISTINCT FROM OLD.adopted_at THEN
    RAISE EXCEPTION 'message_retention_policies: only supersession may be recorded' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_retention_guard_update ON public.message_retention_policies;
--> statement-breakpoint
CREATE TRIGGER message_retention_guard_update BEFORE UPDATE ON public.message_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.message_retention_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_retention_guard_delete ON public.message_retention_policies;
--> statement-breakpoint
CREATE TRIGGER message_retention_guard_delete BEFORE DELETE ON public.message_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.message_retention_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_reads_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'message_thread_reads: % refused', TG_OP USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.thread_id IS DISTINCT FROM OLD.thread_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'message_thread_reads: identity of a read marker is immutable' USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.last_read_at < OLD.last_read_at THEN
      RAISE EXCEPTION 'message_thread_reads: a read marker never moves backwards' USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.message_threads t WHERE t.id = NEW.thread_id AND t.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'message_thread_reads: the marker does not match a conversation of its tenant' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_reads_guard_write ON public.message_thread_reads;
--> statement-breakpoint
CREATE TRIGGER message_reads_guard_write BEFORE INSERT OR UPDATE OR DELETE ON public.message_thread_reads
  FOR EACH ROW EXECUTE FUNCTION public.message_reads_guard();

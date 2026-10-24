-- PLATFORM_SQL 0014_message_thread_triage
--
-- Staff assignment for member conversations. A conversation is created by a member and
-- starts unassigned. Visibility to staff is never derived from rank: a person sees a thread
-- as its assignee, or sees the unassigned queue metadata only while holding a live,
-- expiring triage designation granted by an administrator.
--
--   message_triage_designations   explicit, expiring, revocable authority to triage
--   message_thread_assignments    append-only history of every assignment decision
--
-- message_threads itself gains a guard trigger so that the runtime, which receives UPDATE
-- only for assignment and lifecycle, can never alter ownership, tenant, subject or creation.
-- RLS is scoped 0021; exact DML comes from the storage-authority manifest.

DO $$
BEGIN
  IF to_regclass('public.message_threads') IS NULL THEN
    RAISE EXCEPTION 'platform 0014 fail-closed: public.message_threads does not exist.';
  END IF;
END $$;
--> statement-breakpoint
-- Canonical stub evolution. Django created message_threads without column defaults, and created messages and
-- in_app_notifications as bare stubs (id, timestamps and one reference). The messaging engine and the Drizzle
-- projections need the full shape, so it is added here, additively. A NOT NULL column that cannot be backfilled is
-- only enforced on an empty relation; a populated stub fails closed rather than inventing sender or content.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'message_status' AND n.nspname = 'public') THEN
    CREATE TYPE public.message_status AS ENUM ('sent', 'delivered', 'read');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'message_type' AND n.nspname = 'public') THEN
    CREATE TYPE public.message_type AS ENUM ('text', 'file', 'system');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.message_threads ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE public.message_threads ALTER COLUMN status SET DEFAULT 'open';
--> statement-breakpoint
ALTER TABLE public.message_threads ALTER COLUMN is_archived SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE public.message_threads ALTER COLUMN created_at SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.message_threads ALTER COLUMN updated_at SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_id text,
  ADD COLUMN IF NOT EXISTS sender_role text,
  ADD COLUMN IF NOT EXISTS message_type public.message_type NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size text,
  ADD COLUMN IF NOT EXISTS status public.message_status NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS read_at timestamp,
  ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamp,
  ADD COLUMN IF NOT EXISTS metadata text;
--> statement-breakpoint
ALTER TABLE public.messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE public.messages ALTER COLUMN created_at SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.messages ALTER COLUMN updated_at SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.in_app_notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS action_label text,
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS data jsonb,
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at timestamp,
  ADD COLUMN IF NOT EXISTS expires_at timestamp;
--> statement-breakpoint
ALTER TABLE public.in_app_notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE public.in_app_notifications ALTER COLUMN created_at SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.in_app_notifications ALTER COLUMN updated_at SET DEFAULT now();
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.messages WHERE sender_id IS NULL OR sender_role IS NULL) THEN
    RAISE EXCEPTION 'platform 0014 fail-closed: public.messages holds rows with no sender; the sender cannot be inferred.';
  END IF;
  ALTER TABLE public.messages ALTER COLUMN sender_id SET NOT NULL;
  ALTER TABLE public.messages ALTER COLUMN sender_role SET NOT NULL;
  IF EXISTS (SELECT 1 FROM public.in_app_notifications WHERE title IS NULL OR message IS NULL) THEN
    RAISE EXCEPTION 'platform 0014 fail-closed: public.in_app_notifications holds rows with no content; it cannot be inferred.';
  END IF;
  ALTER TABLE public.in_app_notifications ALTER COLUMN title SET NOT NULL;
  ALTER TABLE public.in_app_notifications ALTER COLUMN message SET NOT NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.message_triage_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id text NOT NULL,
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by text,
  CONSTRAINT message_triage_no_self_grant CHECK (granted_by <> user_id),
  CONSTRAINT message_triage_expiry_after_grant CHECK (expires_at > granted_at),
  CONSTRAINT message_triage_revocation_pair CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS message_triage_designations_live_uq
  ON public.message_triage_designations (organization_id, user_id)
  WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.message_thread_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.message_threads (id) ON DELETE RESTRICT,
  action text NOT NULL,
  from_staff_id text,
  to_staff_id text,
  acted_by text NOT NULL,
  acted_via text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_assignment_action_valid CHECK (action IN ('assign', 'reassign', 'release')),
  CONSTRAINT message_assignment_via_valid CHECK (acted_via IN ('triage_designation', 'current_assignee')),
  CONSTRAINT message_assignment_target_shape CHECK ((action = 'release') = (to_staff_id IS NULL)),
  CONSTRAINT message_assignment_source_shape CHECK ((action = 'assign') = (from_staff_id IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS message_thread_assignments_thread_idx
  ON public.message_thread_assignments (organization_id, thread_id, created_at);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_triage_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'message_triage_designations is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'message_triage_designations: a revoked designation is final' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.granted_by IS DISTINCT FROM OLD.granted_by
     OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'message_triage_designations: only revocation may be recorded' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_triage_guard_update ON public.message_triage_designations;
--> statement-breakpoint
CREATE TRIGGER message_triage_guard_update BEFORE UPDATE ON public.message_triage_designations
  FOR EACH ROW EXECUTE FUNCTION public.message_triage_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_triage_guard_delete ON public.message_triage_designations;
--> statement-breakpoint
CREATE TRIGGER message_triage_guard_delete BEFORE DELETE ON public.message_triage_designations
  FOR EACH ROW EXECUTE FUNCTION public.message_triage_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_assignment_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'message_thread_assignments is append-only: % refused', TG_OP USING ERRCODE = 'restrict_violation';
  END IF;
  -- The recorded tenant must be the thread's tenant, and the recorded source must be the thread's current assignee.
  IF NOT EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = NEW.thread_id
      AND t.organization_id = NEW.organization_id
      AND t.staff_id IS NOT DISTINCT FROM NEW.to_staff_id
  ) THEN
    RAISE EXCEPTION 'message_thread_assignments: record does not match the thread tenant or its resulting assignee'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_assignment_guard_insert ON public.message_thread_assignments;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER message_assignment_guard_insert AFTER INSERT ON public.message_thread_assignments
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION public.message_assignment_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_assignment_guard_mutate ON public.message_thread_assignments;
--> statement-breakpoint
CREATE TRIGGER message_assignment_guard_mutate BEFORE UPDATE OR DELETE ON public.message_thread_assignments
  FOR EACH ROW EXECUTE FUNCTION public.message_assignment_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_threads_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'message_threads: tenant, owner, subject and creation are immutable' USING ERRCODE = 'restrict_violation';
  END IF;
  -- An assignment change is only valid together with its history record; the assignment trigger verifies it.
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_threads_guard_update ON public.message_threads;
--> statement-breakpoint
CREATE TRIGGER message_threads_guard_update BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.message_threads_guard_update();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.message_threads_assignment_requires_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.staff_id IS DISTINCT FROM OLD.staff_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.message_thread_assignments a
      WHERE a.thread_id = NEW.id
        AND a.organization_id = NEW.organization_id
        AND a.to_staff_id IS NOT DISTINCT FROM NEW.staff_id
        AND a.from_staff_id IS NOT DISTINCT FROM OLD.staff_id
        AND a.created_at = (SELECT max(created_at) FROM public.message_thread_assignments b WHERE b.thread_id = NEW.id)
    ) THEN
      RAISE EXCEPTION 'message_threads: an assignment change requires its history record' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS message_threads_assignment_requires_history ON public.message_threads;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER message_threads_assignment_requires_history AFTER UPDATE ON public.message_threads
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.message_threads_assignment_requires_history();

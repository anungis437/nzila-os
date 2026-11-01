-- PLATFORM_SQL 0054_public_intake_audit_events
--
-- A workbook that nobody has claimed has no organization, no acting person and no consent: its identifier is its only credential. The
-- routes that list, add, change and remove the people it names therefore had nothing to record an access under, and a read or a write of
-- that data left no durable evidence at all. This migration adds a deliberately scoped, platform-level, append-only audit store for
-- pseudonymous public-intake access. It records WHAT happened to a pseudonymous subject, never WHO (there is no one to name) and never
-- on behalf of an organization that does not exist.
--
--   * subject_ref is a keyed HMAC of the bearer identifier (the application holds the key; the database never sees the identifier). The
--     identifier is a credential, so it is not stored; the keyed reference lets the events of one subject be correlated and lets a holder
--     of the key prove an identifier belongs to a subject. Losing or rotating the key loses correlation, not the record.
--   * Events of one subject form a hash chain (previous_hash -> content_hash) so a later rewrite of an earlier event is detectable. The
--     unique index on (subject_ref, previous_hash) makes a fork impossible even if two writers race.
--   * The table is append-only by privilege (the system role holds SELECT and INSERT only) and by trigger (UPDATE, DELETE and TRUNCATE
--     are refused for every role that is not a superuser bypassing triggers).
--   * It does not replace organization audit: when a workbook is claimed, later access is recorded under the claiming organization.
--
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION. RLS is cache 0044.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.public_intake_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL,
  subject_kind varchar(40) NOT NULL,
  subject_ref varchar(64) NOT NULL,
  surface varchar(80) NOT NULL,
  action varchar(100) NOT NULL,
  operation varchar(10) NOT NULL,
  outcome varchar(10) NOT NULL DEFAULT 'success',
  resource_ref varchar(64),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash varchar(64),
  content_hash varchar(64) NOT NULL,
  CONSTRAINT public_intake_audit_events_kind_check CHECK (subject_kind IN ('unclaimed_workbook')),
  CONSTRAINT public_intake_audit_events_subject_check CHECK (subject_ref ~ '^[0-9a-f]{64}$'),
  CONSTRAINT public_intake_audit_events_operation_check CHECK (operation IN ('read', 'create', 'update', 'delete', 'denied')),
  CONSTRAINT public_intake_audit_events_outcome_check CHECK (outcome IN ('success', 'failure')),
  CONSTRAINT public_intake_audit_events_previous_check CHECK (previous_hash IS NULL OR previous_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT public_intake_audit_events_content_check CHECK (content_hash ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS public_intake_audit_events_subject_time_idx
  ON public.public_intake_audit_events (subject_ref, occurred_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS public_intake_audit_events_chain_uq
  ON public.public_intake_audit_events (subject_ref, (coalesce(previous_hash, '')));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_public_intake_audit_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'public_intake_audit_events is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_public_intake_audit_events_no_change ON public.public_intake_audit_events;
--> statement-breakpoint
CREATE TRIGGER ue_public_intake_audit_events_no_change
  BEFORE UPDATE OR DELETE ON public.public_intake_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.ue_public_intake_audit_events_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_public_intake_audit_events_no_truncate ON public.public_intake_audit_events;
--> statement-breakpoint
CREATE TRIGGER ue_public_intake_audit_events_no_truncate
  BEFORE TRUNCATE ON public.public_intake_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.ue_public_intake_audit_events_append_only();

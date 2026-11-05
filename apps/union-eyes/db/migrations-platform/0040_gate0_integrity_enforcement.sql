-- PLATFORM_SQL 0040_gate0_integrity_enforcement
--
-- Database-level enforcement for fixes that application code could only check before it wrote:
--   1. employer_execution_replay_mode gains new_engine, so an engine-change replay is recorded as one and not as a
--      faithful re-run (the requested mode no longer has to travel only inside the diff).
--   2. ml_predictions gains model_version and subject_id, so a prediction records the model that made it and the case it
--      scored; feedback can then be bound to that version and a prediction can be traced to its case.
--   3. course_registrations gains one registration per member and session, and a capacity trigger that locks the
--      session row, so two simultaneous registrations for the last place cannot both succeed.
--
-- Additive only. The unique index refuses to apply over existing duplicate registrations instead of deleting any.
-- Each relation is optional: the statement is skipped when the relation is absent. Registered UNQUALIFIED. Not applied
-- here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace WHERE t.typname = 'employer_execution_replay_mode' AND s.nspname = 'public') THEN
    ALTER TYPE public.employer_execution_replay_mode ADD VALUE IF NOT EXISTS 'new_engine';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.ml_predictions') IS NOT NULL THEN
    ALTER TABLE public.ml_predictions ADD COLUMN IF NOT EXISTS model_version varchar(20);
    ALTER TABLE public.ml_predictions ADD COLUMN IF NOT EXISTS subject_id varchar(255);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.course_registrations') IS NOT NULL AND to_regclass('public.course_sessions') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.course_registrations
      GROUP BY organization_id, member_id, session_id HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'course_registrations holds duplicate registrations for one member and session; resolve them before applying 0040';
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_course_registrations_member_session
      ON public.course_registrations (organization_id, member_id, session_id);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.course_registrations') IS NOT NULL AND to_regclass('public.course_sessions') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.enforce_course_session_capacity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    DECLARE
      cap integer;
      taken integer;
    BEGIN
      IF NEW.registration_status IS DISTINCT FROM 'registered' THEN
        RETURN NEW;
      END IF;
      IF TG_OP = 'UPDATE' AND OLD.registration_status IS NOT DISTINCT FROM 'registered' AND OLD.session_id IS NOT DISTINCT FROM NEW.session_id THEN
        RETURN NEW;
      END IF;
      -- Holding the session row serialises registrations for the same session, so the count below is not stale.
      SELECT max_enrollment INTO cap FROM public.course_sessions WHERE id = NEW.session_id FOR UPDATE;
      IF cap IS NULL THEN
        RETURN NEW;
      END IF;
      SELECT count(*) INTO taken FROM public.course_registrations
        WHERE session_id = NEW.session_id AND registration_status = 'registered' AND id IS DISTINCT FROM NEW.id;
      IF taken >= cap THEN
        RAISE EXCEPTION 'course session is full' USING ERRCODE = '23514', CONSTRAINT = 'course_registrations_session_capacity';
      END IF;
      RETURN NEW;
    END
    $fn$;
    REVOKE ALL ON FUNCTION public.enforce_course_session_capacity() FROM PUBLIC;
    DROP TRIGGER IF EXISTS trg_course_registrations_capacity ON public.course_registrations;
    CREATE TRIGGER trg_course_registrations_capacity
      BEFORE INSERT OR UPDATE OF registration_status, session_id ON public.course_registrations
      FOR EACH ROW EXECUTE FUNCTION public.enforce_course_session_capacity();
  END IF;
END $$;

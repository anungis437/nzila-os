-- Rollback for 0040_gate0_integrity_enforcement. A PostgreSQL enum value cannot be removed, so new_engine stays; rows
-- written with it must be reviewed before any attempt to rebuild the type. Forward recovery is preferred.
DROP TRIGGER IF EXISTS trg_course_registrations_capacity ON public.course_registrations;
DROP FUNCTION IF EXISTS public.enforce_course_session_capacity();
DROP INDEX IF EXISTS public.uq_course_registrations_member_session;
-- ml_predictions.model_version and subject_id are nullable and carry recorded provenance; drop them only after
-- confirming no reader depends on them.

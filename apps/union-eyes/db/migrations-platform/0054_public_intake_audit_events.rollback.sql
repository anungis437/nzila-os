-- Rollback for 0054_public_intake_audit_events. The pseudonymous access evidence is discarded; export it first. The append-only triggers
-- are removed with the table, so the rollback itself is the only way the history is ever removed, and it is a schema change, not a data
-- operation of the application.
DROP TABLE IF EXISTS public.public_intake_audit_events;
DROP FUNCTION IF EXISTS public.ue_public_intake_audit_events_append_only();

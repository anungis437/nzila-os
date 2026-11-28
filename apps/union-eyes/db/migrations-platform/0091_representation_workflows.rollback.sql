-- Rollback for 0091_representation_workflows. Drops the group participant and representation record tables, their triggers and
-- functions. Destroys consent, withdrawal, approval, handoff and abandonment history: forward recovery only, and only with
-- explicit human approval after export.
DROP TABLE IF EXISTS public.grievance_representation_records;
--> statement-breakpoint
DROP TABLE IF EXISTS public.grievance_group_participants;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.representation_participant_withdraw_only();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.representation_append_only();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.representation_grievance_same_org();

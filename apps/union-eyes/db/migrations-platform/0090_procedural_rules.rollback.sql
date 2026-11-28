-- Rollback for 0090_procedural_rules. Drops the procedural rule tables, their triggers and guard functions.
-- Destroys stored rule versions, calendars, lifecycle history and grievance procedural facts: forward recovery only,
-- and only with explicit human approval after export.
DROP TABLE IF EXISTS public.grievance_procedural_exceptions;
--> statement-breakpoint
DROP TABLE IF EXISTS public.grievance_procedural_facts;
--> statement-breakpoint
DROP TABLE IF EXISTS public.grievance_procedure_bindings;
--> statement-breakpoint
DROP TABLE IF EXISTS public.procedural_rule_lifecycle_events;
--> statement-breakpoint
DROP TABLE IF EXISTS public.procedural_holiday_calendars;
--> statement-breakpoint
DROP TABLE IF EXISTS public.procedural_rule_sets;
--> statement-breakpoint
DROP TABLE IF EXISTS public.procedural_rule_sources;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.procedural_exception_guard();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.procedural_void_only();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.procedural_append_only();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.procedural_versioned_rule_guard();
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.procedural_grievance_same_org();

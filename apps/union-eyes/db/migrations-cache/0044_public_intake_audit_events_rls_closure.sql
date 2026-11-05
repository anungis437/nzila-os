-- 0044_public_intake_audit_events_rls_closure
--
-- public_intake_audit_events (platform 0054) is platform-level evidence about pseudonymous public-intake access, not tenant data: FORCE
-- RLS, no runtime (tenant) policy at all, and system-role policies for SELECT and INSERT only, so even a policy cannot be read as
-- permission to change or remove an event. The reviewed SYSTEM_ONLY shape (see 0036) narrowed to append-only. This migration does not
-- grant DML: exact privileges come from the storage-authority manifest (db/rls-storage-authority/reference-latent.ts).

DO $$
BEGIN
  IF to_regclass('public.public_intake_audit_events') IS NULL THEN
    RAISE EXCEPTION 'RLS 0044 fail-closed: public.public_intake_audit_events does not exist (platform 0054 not applied).';
  END IF;
  IF to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0044 fail-closed: role union_eyes_system does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.public_intake_audit_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.public_intake_audit_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_select ON public.public_intake_audit_events;
--> statement-breakpoint
CREATE POLICY ue_system_select ON public.public_intake_audit_events FOR SELECT TO union_eyes_system USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_insert ON public.public_intake_audit_events;
--> statement-breakpoint
CREATE POLICY ue_system_insert ON public.public_intake_audit_events FOR INSERT TO union_eyes_system WITH CHECK (true);

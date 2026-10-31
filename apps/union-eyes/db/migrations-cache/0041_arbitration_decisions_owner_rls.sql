-- 0041_arbitration_decisions_owner_rls
--
-- Row security for arbitration_decisions (platform 0051). The library is readable by a tenant only where the decision is public and
-- carries no access restriction (so, as the route already filters, a private or restricted decision is not served to a stranger) or
-- where the tenant supplied it; it is written only by the organization that owns the row. A decision with no owner (platform-supplied)
-- is readable when public and is changed only by the system role. The comparison is on text so a missing or malformed
-- app.current_org_id can never raise or match. This migration does not grant DML: exact privileges come from the storage-authority
-- manifest (db/rls-storage-authority/claims-continuity.ts).

DO $$
BEGIN
  IF to_regclass('public.arbitration_decisions') IS NULL THEN
    RAISE EXCEPTION 'RLS 0041 fail-closed: public.arbitration_decisions does not exist.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'arbitration_decisions' AND column_name = 'source_organization_id') THEN
    RAISE EXCEPTION 'RLS 0041 fail-closed: arbitration_decisions.source_organization_id is missing (platform 0051 not applied).';
  END IF;
  IF to_regrole('union_eyes_runtime') IS NULL OR to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0041 fail-closed: the application roles do not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.arbitration_decisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.arbitration_decisions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_decision_public_select ON public.arbitration_decisions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_decision_owner_select ON public.arbitration_decisions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_decision_owner_insert ON public.arbitration_decisions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_decision_owner_update ON public.arbitration_decisions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_decision_owner_delete ON public.arbitration_decisions;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_system_full_access ON public.arbitration_decisions;
--> statement-breakpoint
CREATE POLICY ue_decision_public_select ON public.arbitration_decisions FOR SELECT TO union_eyes_runtime
  USING (is_public IS TRUE AND COALESCE(access_restrictions, '') = '');
--> statement-breakpoint
CREATE POLICY ue_decision_owner_select ON public.arbitration_decisions FOR SELECT TO union_eyes_runtime
  USING (source_organization_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
CREATE POLICY ue_decision_owner_insert ON public.arbitration_decisions FOR INSERT TO union_eyes_runtime
  WITH CHECK (source_organization_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
CREATE POLICY ue_decision_owner_update ON public.arbitration_decisions FOR UPDATE TO union_eyes_runtime
  USING (source_organization_id::text = current_setting('app.current_org_id', true))
  WITH CHECK (source_organization_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
CREATE POLICY ue_decision_owner_delete ON public.arbitration_decisions FOR DELETE TO union_eyes_runtime
  USING (source_organization_id::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
CREATE POLICY ue_system_full_access ON public.arbitration_decisions FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);

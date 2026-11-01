-- PLATFORM_SQL 0049_claim_status_transitions
--
-- The SLA clock of a claim ran from claims.updated_at, which any edit moves, so a claim that was touched often never breached. The
-- clock must start at the last change of STATUS, and the claims table recorded no such moment. This migration adds it two ways:
--
--   1. claims.status_changed_at, kept by a BEFORE trigger: set to now() when a claim is created and whenever its status actually
--      changes (an update that leaves the status as it is does not move it). It is NULL for a claim whose history is unknown (every
--      claim that exists before this migration): it is not backfilled from updated_at, which is the value being replaced. Readers treat
--      an unknown moment as the creation time (the clock cannot be restarted by an edit) and say so.
--   2. claim_status_transitions, an append-only history (claim, organization, from, to, when, who), written by an AFTER trigger. The
--      trigger function is SECURITY DEFINER so the tenant and system roles hold SELECT only: no role the application runs as can
--      forge, change or remove a transition. A claim with no organization is outside tenancy and records no transition row.
--
-- who is app.current_user_id when the session sets it, otherwise NULL. Idempotent. Registered UNQUALIFIED. Not applied here; native
-- PostgreSQL execution is READY_FOR_VS_EXECUTION. The RLS closure is cache 0039.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.claims') IS NULL THEN
    RAISE EXCEPTION 'claim status transitions fail-closed: public.claims does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.claim_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claims (id) ON DELETE CASCADE,
  from_status varchar(50),
  to_status varchar(50) NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by varchar(255)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS claim_status_transitions_claim_idx ON public.claim_status_transitions (claim_id, changed_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS claim_status_transitions_org_idx ON public.claim_status_transitions (organization_id, changed_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_claims_stamp_status_changed() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_changed_at IS NULL THEN
      NEW.status_changed_at := now();
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  ELSE
    -- An edit that leaves the status as it is never moves the clock, whatever the statement tried to set.
    NEW.status_changed_at := OLD.status_changed_at;
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_claims_record_status_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.claim_status_transitions (organization_id, claim_id, from_status, to_status, changed_at, changed_by)
    VALUES (NEW.organization_id, NEW.id, NULL, NEW.status, COALESCE(NEW.status_changed_at, now()), NULLIF(current_setting('app.current_user_id', true), ''));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.claim_status_transitions (organization_id, claim_id, from_status, to_status, changed_at, changed_by)
    VALUES (NEW.organization_id, NEW.id, OLD.status, NEW.status, COALESCE(NEW.status_changed_at, now()), NULLIF(current_setting('app.current_user_id', true), ''));
  END IF;
  RETURN NULL;
END;
$fn$;
--> statement-breakpoint
-- A SECURITY DEFINER function is not callable by a runtime principal; a trigger still fires it (EXECUTE is checked when the trigger is created).
REVOKE ALL ON FUNCTION public.ue_claims_record_status_transition() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_claims_stamp_status_changed ON public.claims;
--> statement-breakpoint
CREATE TRIGGER ue_claims_stamp_status_changed BEFORE INSERT OR UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.ue_claims_stamp_status_changed();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_claims_record_status_transition ON public.claims;
--> statement-breakpoint
CREATE TRIGGER ue_claims_record_status_transition AFTER INSERT OR UPDATE OF status ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.ue_claims_record_status_transition();

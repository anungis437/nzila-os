-- Platform migration representation_workflows
--
-- Member-service representation records (lib/representation-workflows), institution-neutral:
--   grievance_group_participants      one row per member of a group grievance: the member's own consent (form and evidence), the
--                                     portion of the employer administration the member works in, and a withdrawal that leaves
--                                     the group matter and its history intact
--   grievance_representation_records  append-only typed records: an employer-initiated filing, a union policy filing, filing approvals, a final-level
--                                     handoff (executive signatory, packet, receiving component) and its receipt, a written
--                                     abandonment or missed-escalation finding, and a beyond-control exception
--
-- Nothing here changes a grievance's status: no record closes a grievance. Rows are never deleted; a participant's only update is
-- the one-time withdrawal. Every table carries a direct organization_id uuid NOT NULL; RLS is applied by scoped (cache) 0064 with
-- ue_create_direct_org_rls_policy. No DML grants: exact privileges come from the storage-authority manifest. Idempotent.
DO $ue_representation_prereq$
BEGIN
  IF to_regclass('public.grievances') IS NULL OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'platform representation_workflows fail-closed: public.grievances and public.organizations must exist.';
  END IF;
END $ue_representation_prereq$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.grievance_group_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  grievance_id uuid NOT NULL REFERENCES public.grievances(id),
  member_user_id text NOT NULL CHECK (length(btrim(member_user_id)) > 0),
  employer_portion_ref text NOT NULL CHECK (length(btrim(employer_portion_ref)) > 0),
  consent_form text NOT NULL CHECK (consent_form IN ('written_signature','electronic_signature','alternate_compliant_form')),
  consent_evidence_ref text NOT NULL CHECK (length(btrim(consent_evidence_ref)) > 0),
  consented_at timestamptz NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  withdrawn_recorded_by text,
  withdrawal_reason text,
  withdrawal_evidence_ref text,
  CONSTRAINT grievance_group_participants_withdrawal_ck CHECK (
    (withdrawn_at IS NULL AND withdrawn_recorded_by IS NULL AND withdrawal_reason IS NULL AND withdrawal_evidence_ref IS NULL)
    OR (withdrawn_at IS NOT NULL AND withdrawn_recorded_by IS NOT NULL AND length(btrim(coalesce(withdrawal_reason, ''))) > 0)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_grievance_group_participants_active ON public.grievance_group_participants (grievance_id, member_user_id) WHERE withdrawn_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_grievance_group_participants_grievance ON public.grievance_group_participants (grievance_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.grievance_representation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  grievance_id uuid NOT NULL REFERENCES public.grievances(id),
  record_kind text NOT NULL CHECK (record_kind IN ('employer_initiated_filing','policy_filing','filing_approval','final_level_handoff','handoff_receipt','abandonment','beyond_control_exception')),
  parent_record_id uuid REFERENCES public.grievance_representation_records(id),
  actor_office text,
  payload jsonb NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grievance_representation_records_parent_ck CHECK ((record_kind IN ('filing_approval','handoff_receipt')) = (parent_record_id IS NOT NULL)),
  CONSTRAINT grievance_representation_records_office_ck CHECK (record_kind <> 'filing_approval' OR length(btrim(coalesce(actor_office, ''))) > 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_grievance_representation_records_grievance ON public.grievance_representation_records (grievance_id, record_kind);
--> statement-breakpoint
-- One approval per approver per record.
CREATE UNIQUE INDEX IF NOT EXISTS ux_grievance_representation_approval_once ON public.grievance_representation_records (parent_record_id, recorded_by) WHERE record_kind = 'filing_approval';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.representation_grievance_same_org() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.grievances g WHERE g.id = NEW.grievance_id AND g.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION '%: grievance % is not in organization %', TG_TABLE_NAME, NEW.grievance_id, NEW.organization_id USING ERRCODE = 'check_violation';
  END IF;
  IF TG_TABLE_NAME = 'grievance_representation_records' AND (to_jsonb(NEW) ->> 'parent_record_id') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.grievance_representation_records p WHERE p.id = (to_jsonb(NEW) ->> 'parent_record_id')::uuid AND p.grievance_id = NEW.grievance_id AND p.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'grievance_representation_records: the parent record belongs to another grievance' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.representation_append_only() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  RAISE EXCEPTION '%: rows are append-only', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $ue_fn$;
--> statement-breakpoint
-- A participant row changes once: the withdrawal columns are set; consent, member and portion never change.
CREATE OR REPLACE FUNCTION public.representation_participant_withdraw_only() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
DECLARE
  withdrawal text[] := ARRAY['withdrawn_at','withdrawn_recorded_by','withdrawal_reason','withdrawal_evidence_ref'];
BEGIN
  IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF OLD.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'grievance_group_participants: a withdrawal is final' USING ERRCODE = 'check_violation';
  END IF;
  IF (to_jsonb(OLD) - withdrawal) IS DISTINCT FROM (to_jsonb(NEW) - withdrawal) THEN
    RAISE EXCEPTION 'grievance_group_participants: only a withdrawal may be recorded' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_group_participants_same_org ON public.grievance_group_participants;
--> statement-breakpoint
CREATE TRIGGER grievance_group_participants_same_org BEFORE INSERT ON public.grievance_group_participants
  FOR EACH ROW EXECUTE FUNCTION public.representation_grievance_same_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_group_participants_withdraw_only ON public.grievance_group_participants;
--> statement-breakpoint
CREATE TRIGGER grievance_group_participants_withdraw_only BEFORE UPDATE ON public.grievance_group_participants
  FOR EACH ROW EXECUTE FUNCTION public.representation_participant_withdraw_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_group_participants_no_delete ON public.grievance_group_participants;
--> statement-breakpoint
CREATE TRIGGER grievance_group_participants_no_delete BEFORE DELETE ON public.grievance_group_participants
  FOR EACH ROW EXECUTE FUNCTION public.representation_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_representation_records_same_org ON public.grievance_representation_records;
--> statement-breakpoint
CREATE TRIGGER grievance_representation_records_same_org BEFORE INSERT ON public.grievance_representation_records
  FOR EACH ROW EXECUTE FUNCTION public.representation_grievance_same_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_representation_records_append_only ON public.grievance_representation_records;
--> statement-breakpoint
CREATE TRIGGER grievance_representation_records_append_only BEFORE UPDATE OR DELETE ON public.grievance_representation_records
  FOR EACH ROW EXECUTE FUNCTION public.representation_append_only();

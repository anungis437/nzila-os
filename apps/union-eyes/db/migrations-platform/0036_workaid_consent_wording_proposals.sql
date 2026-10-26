-- PLATFORM_SQL 0036_workaid_consent_wording_proposals
-- UNQUALIFIED. Do not apply from Cursor. Native execution is READY_FOR_VS_EXECUTION.
--
-- A proposal is not consent wording. One executive records the exact text the institution
-- supplied. A different executive adopts it, and only that adoption inserts a current
-- ue_authority_workaid_consent_texts row. This migration does not insert wording,
-- does not invent approved language, and does not activate counsel.

DO $$
BEGIN
  IF to_regclass('public.ue_authority_workaid_consent_texts') IS NULL
     OR to_regprocedure('ue_authority_record_event()') IS NULL
     OR to_regprocedure('ue_authority_guard_actor()') IS NULL
     OR to_regprocedure('ue_authority_block_mutation()') IS NULL THEN
    RAISE EXCEPTION 'platform 0036 fail-closed: union-side WorkAid consent storage is not installed.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ue_authority_workaid_consent_text_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  version text NOT NULL,
  body text NOT NULL,
  body_sha256 text NOT NULL,
  proposed_by ue_authority_principal NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  adopted_by ue_authority_principal,
  adopted_at timestamptz,
  adopted_text_id uuid REFERENCES ue_authority_workaid_consent_texts (id),
  withdrawn_by ue_authority_principal,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_wa_proposal_version_chk CHECK (version ~ '^[A-Za-z0-9._-]{1,64}$'),
  CONSTRAINT ue_authority_wa_proposal_body_chk CHECK (length(btrim(body)) > 0),
  CONSTRAINT ue_authority_wa_proposal_hash_chk CHECK (body_sha256 = encode(sha256(convert_to(body, 'UTF8')), 'hex')),
  CONSTRAINT ue_authority_wa_proposal_adopted_chk CHECK ((adopted_at IS NULL) = (adopted_by IS NULL) AND (adopted_at IS NULL) = (adopted_text_id IS NULL)),
  CONSTRAINT ue_authority_wa_proposal_withdrawn_chk CHECK ((withdrawn_at IS NULL) = (withdrawn_by IS NULL)),
  CONSTRAINT ue_authority_wa_proposal_terminal_chk CHECK (adopted_at IS NULL OR withdrawn_at IS NULL),
  CONSTRAINT ue_authority_wa_proposal_segregation_chk CHECK (adopted_by IS NULL OR adopted_by <> proposed_by),
  CONSTRAINT ue_authority_wa_proposal_withdrawer_chk CHECK (withdrawn_by IS NULL OR withdrawn_by = proposed_by)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_wa_proposal_open_uq
  ON ue_authority_workaid_consent_text_proposals (organization_id, version)
  WHERE adopted_at IS NULL AND withdrawn_at IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ue_authority_guard_workaid_wording_proposal() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.adopted_at IS NOT NULL OR OLD.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'wording proposal % is terminal', OLD.id USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(OLD) - ARRAY['adopted_at','adopted_by','adopted_text_id','withdrawn_at','withdrawn_by'])
     IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['adopted_at','adopted_by','adopted_text_id','withdrawn_at','withdrawn_by']) THEN
    RAISE EXCEPTION 'wording proposal % may only be adopted or withdrawn', OLD.id USING ERRCODE = '42501';
  END IF;
  IF NEW.adopted_at IS NOT NULL AND NEW.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'wording proposal % cannot be both adopted and withdrawn', OLD.id USING ERRCODE = '23514';
  END IF;
  IF NEW.adopted_by IS NOT NULL AND NEW.adopted_by = OLD.proposed_by THEN
    RAISE EXCEPTION 'WORDING_ADOPTION_SEGREGATION: the proposer cannot adopt the wording' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_no_delete ON ue_authority_workaid_consent_text_proposals;
--> statement-breakpoint
CREATE TRIGGER ue_authority_no_delete BEFORE DELETE ON ue_authority_workaid_consent_text_proposals FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_no_truncate ON ue_authority_workaid_consent_text_proposals;
--> statement-breakpoint
CREATE TRIGGER ue_authority_no_truncate BEFORE TRUNCATE ON ue_authority_workaid_consent_text_proposals FOR EACH STATEMENT EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_record_event ON ue_authority_workaid_consent_text_proposals;
--> statement-breakpoint
CREATE TRIGGER ue_authority_record_event AFTER INSERT OR UPDATE ON ue_authority_workaid_consent_text_proposals FOR EACH ROW EXECUTE FUNCTION ue_authority_record_event();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_workaid_consent_text_proposals;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_workaid_consent_text_proposals FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_workaid_wording_proposal();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_actor ON ue_authority_workaid_consent_text_proposals;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_actor BEFORE INSERT OR UPDATE ON ue_authority_workaid_consent_text_proposals FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_actor('proposed_by', 'adopted_by,withdrawn_by');

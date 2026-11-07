-- Rollback of platform-migration:platform_staff_mandate_kind. Refuses while any mandate or issuance rule uses the
-- 'platform_staff' kind/domain, then narrows both CHECK constraints back to the five original values.
DO $rollback$
DECLARE
  mandate_holds boolean;
  rule_holds boolean;
BEGIN
  IF to_regclass('public.ue_authority_mandates') IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.ue_authority_mandates WHERE kind = 'platform_staff') INTO mandate_holds;
    IF mandate_holds THEN
      RAISE EXCEPTION 'platform-migration:platform_staff_mandate_kind rollback refuses: ue_authority_mandates holds a platform_staff row.';
    END IF;
  END IF;
  IF to_regclass('public.ue_authority_issuance_rules') IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.ue_authority_issuance_rules WHERE domain = 'platform_staff') INTO rule_holds;
    IF rule_holds THEN
      RAISE EXCEPTION 'platform-migration:platform_staff_mandate_kind rollback refuses: ue_authority_issuance_rules holds a platform_staff row.';
    END IF;
  END IF;

  IF to_regclass('public.ue_authority_mandates') IS NOT NULL THEN
    ALTER TABLE public.ue_authority_mandates DROP CONSTRAINT IF EXISTS ue_authority_mandates_kind_chk;
    ALTER TABLE public.ue_authority_mandates ADD CONSTRAINT ue_authority_mandates_kind_chk
      CHECK (kind IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access'));
  END IF;
  IF to_regclass('public.ue_authority_issuance_rules') IS NOT NULL THEN
    ALTER TABLE public.ue_authority_issuance_rules DROP CONSTRAINT IF EXISTS ue_authority_rule_domain_chk;
    ALTER TABLE public.ue_authority_issuance_rules ADD CONSTRAINT ue_authority_rule_domain_chk
      CHECK (domain IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access', 'delegation', 'case_assignment', 'recusal'));
  END IF;
END
$rollback$;

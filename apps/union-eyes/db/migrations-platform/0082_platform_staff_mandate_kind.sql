-- platform-migration:platform_staff_mandate_kind: widens the mandate/issuance-rule kind vocabulary so the kernel can
-- represent a platform-staff mandate (DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ, DEF-0B10-OPL-14).
-- Both defects are already engineered down to an identity-fact check (isPlatformAdminUser) with atomic audit and
-- minimal projection; what remains is that the kernel's mandate vocabulary is organization-rooted only
-- ('supervisory' | 'financial' | 'governance_review' | 'executive_office' | 'emergency_access'), so a platform-wide
-- mandate cannot be represented, let alone issued. This migration ONLY widens the two CHECK constraints that
-- enumerate the kind/domain vocabulary to add 'platform_staff'. It creates no row, activates no rule, and changes
-- no runtime behavior: a platform_staff mandate still cannot be issued without a drafted-and-adopted issuance rule
-- (ue_authority_issuance_rules, requires an active member with 'executive' capacity to draft AND two more to
-- approve), and no organization today has a member holding that capacity for this purpose - see
-- docs/union-eyes/convergence/decisions/platform-staff-mandate-decision-record.md for exactly what institutional
-- step is still required. Purely additive; the five existing kind values are unchanged and still accepted.
DO $platform_staff_kind$
BEGIN
  IF to_regclass('public.ue_authority_mandates') IS NULL THEN
    RAISE EXCEPTION 'platform-migration:platform_staff_mandate_kind fail-closed: public.ue_authority_mandates does not exist.';
  END IF;
  IF to_regclass('public.ue_authority_issuance_rules') IS NULL THEN
    RAISE EXCEPTION 'platform-migration:platform_staff_mandate_kind fail-closed: public.ue_authority_issuance_rules does not exist.';
  END IF;

  ALTER TABLE public.ue_authority_mandates DROP CONSTRAINT IF EXISTS ue_authority_mandates_kind_chk;
  ALTER TABLE public.ue_authority_mandates ADD CONSTRAINT ue_authority_mandates_kind_chk
    CHECK (kind IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access', 'platform_staff'));

  ALTER TABLE public.ue_authority_issuance_rules DROP CONSTRAINT IF EXISTS ue_authority_rule_domain_chk;
  ALTER TABLE public.ue_authority_issuance_rules ADD CONSTRAINT ue_authority_rule_domain_chk
    CHECK (domain IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access', 'platform_staff', 'delegation', 'case_assignment', 'recusal'));
END
$platform_staff_kind$;

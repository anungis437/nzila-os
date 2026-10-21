-- PLATFORM_SQL 0008 — current-lifecycle strike-fund organization provenance.
--
-- The frozen file db/migrations/20260909_strike_fund_disbursements_organization_id.sql
-- joins organizations.slug to organization_members.organization_id. That file
-- stays immutable. It is historical evidence for a text membership column and
-- is not a producer for the canonical UUID foreign key.
--
-- This statement requires organization_members.organization_id to be uuid and
-- assigns strike_fund_disbursements.organization_id only when exactly one
-- membership was effective at that disbursement's payment_date
-- (joined_at <= payment_date AND (deleted_at IS NULL OR deleted_at > payment_date)).
-- Zero candidates and multiple candidates leave the row null and abort.
-- Existing non-null organization_id values are preserved.
-- The foreign key uses ON DELETE CASCADE because that is the constraint
-- already declared by the canonical Drizzle projection and by the frozen
-- historical migration. This statement does not introduce a new delete action.
-- Deleting an organization cascading into historical disbursements is not a
-- proven retention decision: UE_V2_FINANCIAL_SCOPE_AUTHORITY lists this table
-- as NOT_PROVEN. The action is preserved, not newly chosen.
--
-- payment_date is required to attribute a historical row. A physical table
-- that has rows and no payment_date fails closed. An empty table without
-- payment_date can receive organization_id without inventing dates. This
-- statement does not delete financial rows and does not create the table.
--
-- The platform executor wraps this file in one transaction. Do not add BEGIN
-- or COMMIT here. If strike_fund_disbursements is absent, fail closed.

DO $$
DECLARE
  disbursement_table regclass;
  membership_type text;
  has_payment_date boolean;
  existing_row_count bigint;
  ambiguous_or_unmapped_count integer;
BEGIN
  disbursement_table := to_regclass('public.strike_fund_disbursements');
  IF disbursement_table IS NULL THEN
    RAISE EXCEPTION
      'strike_fund_disbursements is absent. Refusing to invent the table. Create it from its canonical owner before this provenance step.';
  END IF;

  SELECT c.data_type INTO membership_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'organization_members'
    AND c.column_name = 'organization_id';

  IF membership_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION
      'organization_members.organization_id is %, not uuid. The slug join in frozen 20260909 is not the current producer.',
      COALESCE(membership_type, 'missing');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'strike_fund_disbursements'
      AND c.column_name = 'payment_date'
  ) INTO has_payment_date;

  IF NOT has_payment_date THEN
    SELECT COUNT(*) INTO existing_row_count FROM public.strike_fund_disbursements;
    IF existing_row_count > 0 THEN
      RAISE EXCEPTION
        'strike_fund_disbursements.payment_date is absent and % historical row(s) exist. Refusing to invent payment dates, delete rows, or attribute organization_id without a payment date.',
        existing_row_count;
    END IF;
  END IF;

  ALTER TABLE public.strike_fund_disbursements
    ADD COLUMN IF NOT EXISTS organization_id uuid;

  IF NOT has_payment_date THEN
    ALTER TABLE public.strike_fund_disbursements
      ALTER COLUMN organization_id SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.strike_fund_disbursements'::regclass
        AND conname = 'strike_fund_disbursements_organization_id_fkey'
    ) THEN
      ALTER TABLE public.strike_fund_disbursements
        ADD CONSTRAINT strike_fund_disbursements_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;

    CREATE INDEX IF NOT EXISTS strike_fund_disbursements_organization_id_idx
      ON public.strike_fund_disbursements(organization_id);
    RETURN;
  END IF;

  WITH historically_effective_membership AS (
    SELECT
      sfd.id AS disbursement_id,
      o.id AS candidate_organization_id
    FROM public.strike_fund_disbursements sfd
    JOIN public.organization_members om
      ON om.user_id = sfd.user_id
     AND om.joined_at <= sfd.payment_date
     AND (om.deleted_at IS NULL OR om.deleted_at > sfd.payment_date)
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE sfd.organization_id IS NULL
  ),
  disbursement_candidates AS (
    SELECT
      disbursement_id,
      COUNT(DISTINCT candidate_organization_id) AS candidate_count,
      (array_agg(DISTINCT candidate_organization_id))[1] AS sole_candidate_organization_id
    FROM historically_effective_membership
    GROUP BY disbursement_id
  )
  UPDATE public.strike_fund_disbursements sfd
  SET organization_id = dc.sole_candidate_organization_id
  FROM disbursement_candidates dc
  WHERE sfd.id = dc.disbursement_id
    AND dc.candidate_count = 1
    AND sfd.organization_id IS NULL;

  SELECT COUNT(*) INTO ambiguous_or_unmapped_count
  FROM public.strike_fund_disbursements
  WHERE organization_id IS NULL;

  IF ambiguous_or_unmapped_count > 0 THEN
    RAISE EXCEPTION
      'strike_fund_disbursements organization_id backfill left % row(s) with zero or ambiguous (>1) organization_members candidates effective at their own payment_date. Existing financial rows were not deleted and no organization was chosen arbitrarily.',
      ambiguous_or_unmapped_count;
  END IF;

  ALTER TABLE public.strike_fund_disbursements
    ALTER COLUMN organization_id SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.strike_fund_disbursements'::regclass
      AND conname = 'strike_fund_disbursements_organization_id_fkey'
  ) THEN
    ALTER TABLE public.strike_fund_disbursements
      ADD CONSTRAINT strike_fund_disbursements_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  CREATE INDEX IF NOT EXISTS strike_fund_disbursements_organization_id_idx
    ON public.strike_fund_disbursements(organization_id);
END $$;

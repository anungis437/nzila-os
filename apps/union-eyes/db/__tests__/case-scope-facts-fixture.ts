/** Minimal persisted fact shapes for authority loader fixtures; physical adoption is tested against current model DDL separately. */
export const CASE_SCOPE_FACTS_FIXTURE_SQL = `
  CREATE TABLE public.bargaining_units(id uuid PRIMARY KEY,organization_id uuid,status text DEFAULT 'active',archived_at timestamptz);
  CREATE TABLE public.case_territories(id uuid PRIMARY KEY,organization_id uuid,retired_at timestamptz,source_instrument text);
  CREATE TABLE public.case_authority_scopes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,case_id uuid,
    claim_id uuid,grievance_id uuid,unit_id uuid,territory_id uuid,revision integer DEFAULT 0,last_proposal_id uuid,
    grievance_mirror_id uuid,mirror_recorded_at timestamptz,mirror_recorded_by text);
  CREATE TABLE public.case_respondents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,scope_id uuid,
    respondent_user_id text,recorded_at timestamptz DEFAULT now(),recorded_by text,revoked_at timestamptz,revoked_by text,revoked_proposal_id uuid);
`

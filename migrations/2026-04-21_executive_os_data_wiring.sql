-- ExecutiveOS data wiring: FP&A, Renewals, Grants, Security findings
-- Idempotent DDL for the new tables introduced by exec-data.ts and grants.ts.

CREATE TABLE IF NOT EXISTS budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  fiscal_year integer NOT NULL,
  period_key text NOT NULL,
  budget_type text NOT NULL,
  category text NOT NULL,
  subcategory text,
  product_key text,
  department_key text,
  owner text,
  planned_amount numeric(18,2) NOT NULL,
  actual_amount numeric(18,2),
  currency text DEFAULT 'CAD',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_lines_org_period ON budget_lines(organization_id, period_key);
CREATE INDEX IF NOT EXISTS idx_budget_lines_org_category ON budget_lines(organization_id, category);

CREATE TABLE IF NOT EXISTS cs_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_name text NOT NULL,
  account_owner text,
  product_key text,
  contract_value numeric(18,2),
  renewal_date date,
  renewal_status text,
  health_score text,
  sponsor_last_contact_at timestamptz,
  last_qbr_at timestamptz,
  usage_state text,
  open_support_count integer DEFAULT 0,
  expansion_signal boolean DEFAULT false,
  risk_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cs_accounts_org ON cs_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_cs_accounts_renewal ON cs_accounts(organization_id, renewal_date);

CREATE TABLE IF NOT EXISTS security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text,
  affected_surface text,
  product_key text,
  owner text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  resolved_at timestamptz,
  fingerprint text,
  evidence_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_findings_org_status ON security_findings(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_security_findings_org_severity ON security_findings(organization_id, severity);

CREATE TABLE IF NOT EXISTS security_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL,
  approved_by text NOT NULL,
  reason text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_waivers_finding ON security_waivers(finding_id);

CREATE TABLE IF NOT EXISTS grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  program_name text NOT NULL,
  grantor text,
  status text NOT NULL DEFAULT 'prospecting',
  amount_requested numeric(18,2),
  amount_awarded numeric(18,2),
  amount_drawn_down numeric(18,2),
  currency text DEFAULT 'CAD',
  application_deadline date,
  decision_date date,
  report_due_date date,
  owner text,
  product_key text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grants_org_status ON grants(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_grants_org_appdeadline ON grants(organization_id, application_deadline);

CREATE TABLE IF NOT EXISTS grant_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL,
  report_type text NOT NULL,
  due_date date NOT NULL,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grant_reports_grant ON grant_reports(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_reports_due ON grant_reports(due_date);

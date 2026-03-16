-- ============================================================================
-- Staging DB: Create missing tables, views, and materialized views
-- Referenced by raw SQL in analytics, RBAC, integrations, financial service
-- Run: psql -h nzila-staging-db.postgres.database.azure.com -U nzilaadmin -d nzila_os_staging -f _staging_missing_tables.sql
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 0. Expand claim_deadlines stub (5 cols → full schema from deadlines.ts)
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN CREATE TYPE deadline_status AS ENUM ('pending','in_progress','completed','overdue','extended','waived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deadline_priority AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE claim_deadlines
  ADD COLUMN IF NOT EXISTS deadline_rule_id uuid,
  ADD COLUMN IF NOT EXISTS deadline_name varchar(255),
  ADD COLUMN IF NOT EXISTS deadline_type varchar(100),
  ADD COLUMN IF NOT EXISTS event_date timestamptz,
  ADD COLUMN IF NOT EXISTS original_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS due_date timestamptz,
  ADD COLUMN IF NOT EXISTS current_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS priority varchar(20) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS extension_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_extension_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_extension_date timestamptz,
  ADD COLUMN IF NOT EXISTS last_extension_reason text,
  ADD COLUMN IF NOT EXISTS completed_by varchar(255),
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS is_overdue boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS days_until_due integer,
  ADD COLUMN IF NOT EXISTS days_overdue integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_to varchar(255),
  ADD COLUMN IF NOT EXISTS alert_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_alert_sent timestamptz;

-- Backfill: current_deadline = due_date for compatibility with raw SQL
UPDATE claim_deadlines SET current_deadline = due_date WHERE current_deadline IS NULL AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claim_deadlines_org ON claim_deadlines(organization_id);
CREATE INDEX IF NOT EXISTS idx_claim_deadlines_status ON claim_deadlines(status);
CREATE INDEX IF NOT EXISTS idx_claim_deadlines_overdue ON claim_deadlines(is_overdue) WHERE is_overdue = true;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. RBAC Tables (enhanced-rbac-queries.ts)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS role_definitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code       varchar(50) NOT NULL,
  role_name       varchar(200) NOT NULL,
  role_description text,
  role_level      integer NOT NULL DEFAULT 0,
  is_elected      boolean NOT NULL DEFAULT false,
  requires_board_approval boolean NOT NULL DEFAULT false,
  default_term_years integer,
  can_delegate    boolean NOT NULL DEFAULT false,
  can_have_multiple_holders boolean NOT NULL DEFAULT true,
  parent_role_code varchar(50),
  permissions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system_role  boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_definitions_code ON role_definitions(role_code);
CREATE INDEX IF NOT EXISTS idx_role_definitions_active ON role_definitions(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS member_roles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL,
  organization_id   uuid NOT NULL,
  role_code         varchar(50) NOT NULL,
  scope_type        varchar(50) NOT NULL DEFAULT 'organization',
  scope_value       text,
  start_date        date NOT NULL DEFAULT CURRENT_DATE,
  end_date          date,
  term_years        integer,
  next_election_date date,
  assignment_type   varchar(20) NOT NULL DEFAULT 'appointed',
  election_date     date,
  elected_by        text,
  vote_count        integer,
  total_votes       integer,
  vote_percentage   numeric(5,2),
  status            varchar(20) NOT NULL DEFAULT 'active',
  suspension_reason text,
  suspended_at      timestamptz,
  suspended_by      text,
  is_acting_role    boolean NOT NULL DEFAULT false,
  acting_for_member_id uuid,
  acting_reason     text,
  acting_start_date date,
  acting_end_date   date,
  requires_approval boolean NOT NULL DEFAULT false,
  approved_by       text,
  approval_date     timestamptz,
  approval_notes    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        text,
  CONSTRAINT member_roles_assignment_type_check CHECK (assignment_type IN ('elected','appointed','acting','emergency')),
  CONSTRAINT member_roles_status_check CHECK (status IN ('active','expired','suspended','pending_approval'))
);
CREATE INDEX IF NOT EXISTS idx_member_roles_member ON member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_org ON member_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON member_roles(role_code);
CREATE INDEX IF NOT EXISTS idx_member_roles_active ON member_roles(status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS permission_exceptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         uuid NOT NULL,
  organization_id   uuid NOT NULL,
  permission        varchar(100) NOT NULL,
  resource_type     varchar(50) NOT NULL,
  resource_id       uuid,
  reason            text NOT NULL,
  approved_by       text NOT NULL,
  approval_date     timestamptz NOT NULL DEFAULT now(),
  approval_notes    text,
  effective_date    date NOT NULL DEFAULT CURRENT_DATE,
  expires_at        timestamptz,
  revoked_at        timestamptz,
  revoked_by        text,
  revocation_reason text,
  is_sensitive      boolean NOT NULL DEFAULT false,
  requires_review   boolean NOT NULL DEFAULT false,
  reviewed_at       timestamptz,
  reviewed_by       text,
  review_notes      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_permission_exceptions_member ON permission_exceptions(member_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_permission_exceptions_active ON permission_exceptions(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS rbac_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id          text NOT NULL,
  actor_name        text,
  actor_role        text,
  action            varchar(100) NOT NULL,
  action_category   varchar(50),
  resource_type     varchar(50),
  resource_id       text,
  organization_id   uuid NOT NULL,
  organization_name text,
  required_permission varchar(100),
  granted           boolean NOT NULL,
  grant_method      varchar(50),
  denial_reason     text,
  ip_address        inet,
  user_agent        text,
  session_id        text,
  request_id        text,
  record_hash       text,
  previous_hash     text,
  execution_time_ms integer,
  is_sensitive      boolean NOT NULL DEFAULT false,
  timestamp         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_org ON rbac_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_actor ON rbac_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_ts ON rbac_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rbac_audit_action ON rbac_audit_log(action);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Export Jobs (analytics-queries.ts, scheduled-reports-queries.ts)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS export_jobs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL,
  report_id             uuid,
  schedule_id           uuid,
  export_type           varchar(50) NOT NULL,
  status                varchar(20) NOT NULL DEFAULT 'pending',
  file_url              text,
  error_message         text,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  processing_duration_ms integer,
  created_by            text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_export_jobs_org ON export_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created ON export_jobs(created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Report Schedules — NOTE: Drizzle schema uses 'scheduled_reports'
--    This migration was corrected to NOT create report_schedules.
--    The table already exists as 'scheduled_reports' from Drizzle push.
-- ════════════════════════════════════════════════════════════════════════════

-- SKIPPED: scheduled_reports already exists from Drizzle push

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Strike Actions (board-packet-generator.ts)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS strike_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL,
  strike_fund_id    uuid,
  action_type       varchar(50) NOT NULL DEFAULT 'picket',
  action_date       date NOT NULL,
  description       text,
  amount            numeric(12,2) NOT NULL DEFAULT 0,
  participant_count integer DEFAULT 0,
  location          text,
  status            varchar(20) NOT NULL DEFAULT 'completed',
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_strike_actions_org ON strike_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_strike_actions_date ON strike_actions(action_date DESC);
CREATE INDEX IF NOT EXISTS idx_strike_actions_fund ON strike_actions(strike_fund_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Strike Funds (financial-service schema — strikeFunds pgTable)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS strike_funds (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  fund_name               varchar(255) NOT NULL,
  fund_code               varchar(50) NOT NULL,
  description             text,
  fund_type               varchar(50) NOT NULL,
  current_balance         numeric(12,2) NOT NULL DEFAULT 0.00,
  target_amount           numeric(12,2),
  minimum_threshold       numeric(12,2),
  contribution_rate       numeric(10,2),
  contribution_frequency  varchar(20),
  strike_status           varchar(50) NOT NULL DEFAULT 'inactive',
  strike_start_date       date,
  strike_end_date         date,
  weekly_stipend_amount   numeric(10,2),
  daily_picket_bonus      numeric(8,2),
  minimum_attendance_hours numeric(4,2) DEFAULT 4.0,
  estimated_burn_rate     numeric(10,2),
  estimated_duration_weeks integer,
  fund_depletion_date     date,
  last_prediction_update  timestamptz,
  accepts_public_donations boolean DEFAULT false,
  donation_page_url       text,
  fundraising_goal        numeric(12,2),
  status                  varchar(20) DEFAULT 'active',
  created_by              text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  organization_id         uuid REFERENCES organizations(id)
);
CREATE INDEX IF NOT EXISTS idx_strike_funds_active ON strike_funds(tenant_id) WHERE strike_status = 'active';
CREATE INDEX IF NOT EXISTS idx_strike_funds_organization_id ON strike_funds(organization_id);
CREATE INDEX IF NOT EXISTS idx_strike_funds_status ON strike_funds(tenant_id, strike_status);
CREATE INDEX IF NOT EXISTS idx_strike_funds_tenant ON strike_funds(tenant_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Stipend Disbursements (financial-service schema)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stipend_disbursements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  strike_fund_id      uuid NOT NULL,
  member_id           uuid NOT NULL,
  week_start_date     date NOT NULL,
  week_end_date       date NOT NULL,
  days_worked         integer DEFAULT 0,
  hours_worked        numeric(6,2) NOT NULL,
  calculated_amount   numeric(10,2),
  base_stipend_amount numeric(10,2) NOT NULL,
  bonus_amount        numeric(10,2) DEFAULT 0.00,
  total_amount        numeric(10,2) NOT NULL,
  status              varchar(50) NOT NULL DEFAULT 'calculated',
  payment_date        timestamptz,
  payment_method      varchar(50),
  payment_reference   varchar(255),
  approved_by         text,
  approved_at         timestamptz,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT unique_member_week_stipend UNIQUE (tenant_id, strike_fund_id, member_id, week_start_date)
);
CREATE INDEX IF NOT EXISTS idx_stipends_fund ON stipend_disbursements(strike_fund_id);
CREATE INDEX IF NOT EXISTS idx_stipends_member ON stipend_disbursements(member_id);
CREATE INDEX IF NOT EXISTS idx_stipends_status ON stipend_disbursements(status);
CREATE INDEX IF NOT EXISTS idx_stipends_tenant ON stipend_disbursements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stipends_week ON stipend_disbursements(week_start_date);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Arrears (financial-service schema)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS arrears (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  member_id               uuid NOT NULL,
  total_owed              numeric(10,2) NOT NULL DEFAULT 0.00,
  oldest_debt_date        date,
  months_overdue          integer DEFAULT 0,
  arrears_status          text NOT NULL DEFAULT 'active',
  notification_stage      text DEFAULT 'none',
  payment_plan_active     boolean DEFAULT false,
  payment_plan_amount     numeric(10,2),
  payment_plan_frequency  text,
  payment_plan_start_date date,
  payment_plan_end_date   date,
  suspension_effective_date date,
  suspension_reason       text,
  collection_agency       text,
  legal_action_date       date,
  legal_reference         text,
  notes                   text,
  last_contact_date       date,
  next_follow_up_date     date,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  CONSTRAINT unique_member_arrears UNIQUE (tenant_id, member_id)
);
CREATE INDEX IF NOT EXISTS arrears_member_idx ON arrears(member_id);
CREATE INDEX IF NOT EXISTS arrears_status_idx ON arrears(arrears_status);
CREATE INDEX IF NOT EXISTS arrears_tenant_idx ON arrears(tenant_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. Integration Deliveries (v2/admin/integrations routes)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL,
  config_id            uuid,
  channel              varchar(50) NOT NULL DEFAULT 'webhook',
  provider             varchar(100),
  recipient_ref        text,
  status               varchar(20) NOT NULL DEFAULT 'queued',
  attempts             integer NOT NULL DEFAULT 0,
  max_attempts         integer NOT NULL DEFAULT 3,
  last_error           text,
  provider_message_id  text,
  correlation_id       text,
  payload              jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_org ON integration_deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_status ON integration_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_created ON integration_deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_config ON integration_deliveries(config_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. Integration DLQ (v2/admin/integrations routes)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_dlq (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL,
  delivery_id       uuid,
  config_id         uuid,
  channel           varchar(50) NOT NULL DEFAULT 'webhook',
  provider          varchar(100),
  error_code        varchar(50),
  error_message     text,
  payload           jsonb,
  original_created  timestamptz,
  replayed_at       timestamptz,
  replayed_by       text,
  replay_result     varchar(20),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integration_dlq_org ON integration_dlq(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_dlq_pending ON integration_dlq(replayed_at) WHERE replayed_at IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. Tenant-Org Mappings (tenant-to-org-mapper.ts — migration helper)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenant_org_mappings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  organization_id   uuid NOT NULL,
  tenant_name       varchar(255),
  organization_name varchar(255),
  migration_status  varchar(20) NOT NULL DEFAULT 'pending',
  migrated_at       timestamptz,
  migrated_by       text,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_tenant_org_mapping UNIQUE (tenant_id, organization_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_org_mappings_status ON tenant_org_mappings(migration_status);

-- ════════════════════════════════════════════════════════════════════════════
-- 11. Views (enhanced-rbac-queries.ts, deadline-queries.ts)
-- ════════════════════════════════════════════════════════════════════════════

-- View: Active member roles (joined with role_definitions)
CREATE OR REPLACE VIEW v_active_member_roles AS
SELECT
  mr.id,
  mr.member_id,
  mr.organization_id,
  mr.role_code,
  mr.scope_type,
  mr.scope_value,
  mr.start_date,
  mr.end_date,
  mr.term_years,
  mr.next_election_date,
  mr.assignment_type,
  mr.status,
  mr.is_acting_role,
  mr.acting_for_member_id,
  mr.created_at,
  rd.role_name,
  rd.role_level,
  rd.permissions,
  rd.is_elected,
  CASE
    WHEN mr.end_date IS NULL THEN 'indefinite'
    WHEN mr.end_date < CURRENT_DATE THEN 'expired'
    WHEN mr.end_date < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
    ELSE 'active'
  END AS term_status
FROM member_roles mr
JOIN role_definitions rd ON rd.role_code = mr.role_code AND rd.is_active = true
WHERE mr.status = 'active';

-- View: Upcoming elections
CREATE OR REPLACE VIEW v_upcoming_elections AS
SELECT
  mr.id,
  mr.member_id,
  mr.organization_id,
  mr.role_code,
  rd.role_name,
  mr.next_election_date,
  mr.end_date,
  rd.default_term_years,
  mr.start_date AS current_term_start
FROM member_roles mr
JOIN role_definitions rd ON rd.role_code = mr.role_code
WHERE mr.status = 'active'
  AND rd.is_elected = true
  AND mr.next_election_date IS NOT NULL
ORDER BY mr.next_election_date;

-- View: Critical deadlines
CREATE OR REPLACE VIEW v_critical_deadlines AS
SELECT
  cd.id,
  cd.organization_id,
  cd.claim_id,
  cd.deadline_type,
  cd.current_deadline,
  cd.status,
  cd.priority,
  cd.days_overdue,
  cd.created_at
FROM claim_deadlines cd
WHERE cd.status IN ('pending', 'overdue')
  AND (cd.priority = 'critical' OR cd.days_overdue > 3)
ORDER BY cd.current_deadline;

-- ════════════════════════════════════════════════════════════════════════════
-- 12. Materialized Views (analytics-queries.ts)
-- ════════════════════════════════════════════════════════════════════════════

-- Monthly trends
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_trends AS
SELECT
  c.organization_id,
  date_trunc('month', c.created_at) AS month,
  count(*) AS total_claims,
  count(*) FILTER (WHERE c.status = 'resolved') AS resolved_claims,
  avg(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution_days,
  round(100.0 * count(*) FILTER (WHERE c.resolution_outcome = 'won') / NULLIF(count(*) FILTER (WHERE c.resolution_outcome IS NOT NULL), 0), 1) AS win_rate,
  0::numeric AS month_over_month_growth
FROM claims c
GROUP BY c.organization_id, date_trunc('month', c.created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_trends_pk ON mv_monthly_trends(organization_id, month);

-- Claims daily summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_claims_daily_summary AS
SELECT
  c.organization_id,
  c.created_at::date AS report_date,
  count(*) AS new_claims,
  count(*) FILTER (WHERE c.status = 'resolved') AS resolved_claims,
  avg(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution_days
FROM claims c
GROUP BY c.organization_id, c.created_at::date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_claims_daily_pk ON mv_claims_daily_summary(organization_id, report_date);

-- Steward performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_steward_performance AS
SELECT
  c.assigned_to AS steward_id,
  c.organization_id,
  om.name AS steward_name,
  count(*) AS total_caseload,
  count(*) FILTER (WHERE c.status = 'resolved') AS resolved_cases,
  avg(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution_days,
  round(100.0 * count(*) FILTER (WHERE c.resolution_outcome = 'won') / NULLIF(count(*) FILTER (WHERE c.resolution_outcome IS NOT NULL), 0), 1) AS win_rate,
  round(50 + COALESCE(
    10.0 * count(*) FILTER (WHERE c.resolution_outcome = 'won') / NULLIF(count(*), 0), 0
  ) + COALESCE(
    -5.0 * avg(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0) FILTER (WHERE c.resolved_at IS NOT NULL) / NULLIF(30, 0), 0
  ), 1) AS performance_score
FROM claims c
LEFT JOIN organization_members om ON om.id::text = c.assigned_to AND om.organization_id = c.organization_id::text
WHERE c.assigned_to IS NOT NULL
GROUP BY c.assigned_to, c.organization_id, om.name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_steward_perf_pk ON mv_steward_performance(steward_id, organization_id);

-- Member cohorts
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_member_cohorts AS
SELECT
  om.organization_id,
  date_trunc('month', om.created_at) AS cohort_month,
  count(*) AS cohort_size,
  round(100.0 * count(*) FILTER (WHERE om.status = 'active') / NULLIF(count(*), 0), 1) AS retention_rate
FROM organization_members om
GROUP BY om.organization_id, date_trunc('month', om.created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_member_cohorts_pk ON mv_member_cohorts(organization_id, cohort_month);

-- Member engagement
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_member_engagement AS
SELECT
  om.id AS member_id,
  om.organization_id,
  om.name AS member_name,
  count(c.claim_id) AS total_claims,
  round(100.0 * count(c.claim_id) FILTER (WHERE c.resolution_outcome = 'won') / NULLIF(count(c.claim_id) FILTER (WHERE c.resolution_outcome IS NOT NULL), 0), 1) AS win_rate_percentage,
  LEAST(100, COALESCE(count(c.claim_id) * 10, 0)) AS engagement_score
FROM organization_members om
LEFT JOIN claims c ON c.member_id = om.id::text AND c.organization_id::text = om.organization_id
GROUP BY om.id, om.organization_id, om.name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_member_engagement_pk ON mv_member_engagement(member_id, organization_id);

-- Deadline compliance daily
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_deadline_compliance_daily AS
SELECT
  cd.organization_id,
  cd.created_at::date AS report_date,
  count(*) AS total_deadlines,
  count(*) FILTER (WHERE cd.status = 'overdue') AS overdue_deadlines,
  round(100.0 * count(*) FILTER (WHERE cd.status = 'completed' AND cd.completed_at <= cd.current_deadline) /
    NULLIF(count(*) FILTER (WHERE cd.status IN ('completed','overdue')), 0), 1) AS on_time_percentage
FROM claim_deadlines cd
GROUP BY cd.organization_id, cd.created_at::date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_deadline_compliance_pk ON mv_deadline_compliance_daily(organization_id, report_date);

-- Financial summary daily
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_financial_summary_daily AS
SELECT
  c.organization_id,
  c.created_at::date AS report_date,
  sum(COALESCE(c.claim_amount::numeric, 0)) AS total_claim_value,
  sum(COALESCE(c.settlement_amount::numeric, 0)) AS total_settlements,
  sum(COALESCE(c.legal_costs::numeric, 0)) AS total_legal_costs
FROM claims c
GROUP BY c.organization_id, c.created_at::date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_financial_summary_pk ON mv_financial_summary_daily(organization_id, report_date);

-- Weekly activity heatmap
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_activity AS
SELECT
  c.organization_id,
  EXTRACT(DOW FROM c.created_at)::int AS day_of_week,
  EXTRACT(HOUR FROM c.created_at)::int AS hour_of_day,
  count(*) AS claim_count,
  count(*)::numeric AS activity_score
FROM claims c
GROUP BY c.organization_id, EXTRACT(DOW FROM c.created_at), EXTRACT(HOUR FROM c.created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_activity_pk ON mv_weekly_activity(organization_id, day_of_week, hour_of_day);

-- ════════════════════════════════════════════════════════════════════════════
-- 13. Refresh analytics function (analytics-queries.ts)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_claims_daily_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_steward_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_member_cohorts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_member_engagement;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deadline_compliance_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_financial_summary_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_activity;
END;
$$ LANGUAGE plpgsql;

COMMIT;

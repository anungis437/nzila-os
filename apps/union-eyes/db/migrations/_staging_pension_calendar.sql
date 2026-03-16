-- ============================================================================
-- Staging Migration: Pension + Calendar domains
-- Generated: 2026-03-15
-- Expands stub tables and creates missing tables for pension & calendar schemas
-- ============================================================================

-- ── Section 1: Enum Types ─────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE pension_provider AS ENUM ('OTPP','CPP_QPP','OMERS','HOOPP','LAPP','PSPP','BCMPP','SHEPP','CSSB','CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pension_plan_type AS ENUM ('defined_benefit','defined_contribution','hybrid','target_benefit','multi_employer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pension_member_status AS ENUM ('active','deferred','retired','disabled','terminated','deceased','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pension_contribution_type AS ENUM ('employee_regular','employer_regular','employee_voluntary','employee_buyback','transfer_in','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE calendar_provider AS ENUM ('OUTLOOK','GOOGLE','APPLE','CALDAV','CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE calendar_event_status AS ENUM ('confirmed','tentative','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE attendee_response AS ENUM ('accepted','declined','tentative','needs_action','delegated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE calendar_event_type AS ENUM ('meeting','bargaining_session','grievance_hearing','arbitration','steward_training','membership_meeting','strike_vote','ratification_vote','executive_board','committee','social_event','deadline','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Section 2: Pension Tables ─────────────────────────────────────────────

-- external_pension_plans
CREATE TABLE IF NOT EXISTS external_pension_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider pension_provider NOT NULL,
  plan_name VARCHAR(500) NOT NULL,
  plan_type pension_plan_type NOT NULL,
  plan_number VARCHAR(100),
  jurisdiction VARCHAR(100),
  regulatory_body VARCHAR(255),
  effective_date DATE NOT NULL,
  termination_date DATE,
  employee_contribution_rate NUMERIC(6,4),
  employer_contribution_rate NUMERIC(6,4),
  vesting_period_months INTEGER,
  normal_retirement_age INTEGER,
  early_retirement_age INTEGER,
  status VARCHAR(50) NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_pension_plans_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_pension_members
CREATE TABLE IF NOT EXISTS external_pension_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider pension_provider NOT NULL,
  employee_id VARCHAR(255) NOT NULL,
  employee_name VARCHAR(500),
  plan_id VARCHAR(255) NOT NULL,
  membership_number VARCHAR(100),
  member_status pension_member_status NOT NULL,
  enrollment_date DATE NOT NULL,
  vesting_date DATE,
  termination_date DATE,
  credited_service NUMERIC(8,4),
  eligible_service NUMERIC(8,4),
  pensionable_salary NUMERIC(14,2),
  date_of_birth DATE,
  expected_retirement_date DATE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_pension_members_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_pension_contributions
CREATE TABLE IF NOT EXISTS external_pension_contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider pension_provider NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  plan_id VARCHAR(255) NOT NULL,
  contribution_type pension_contribution_type NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  employee_amount NUMERIC(12,2),
  employer_amount NUMERIC(12,2),
  pensionable_earnings NUMERIC(14,2),
  service_credit NUMERIC(6,4),
  pay_period VARCHAR(50),
  status VARCHAR(50) NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_pension_contrib_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_pension_service_credits
CREATE TABLE IF NOT EXISTS external_pension_service_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider pension_provider NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  plan_id VARCHAR(255) NOT NULL,
  credit_type VARCHAR(100) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  credited_years NUMERIC(8,4) NOT NULL,
  cost_of_buyback NUMERIC(14,2),
  approved BOOLEAN,
  approval_date DATE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_pension_svc_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_pension_estimates
CREATE TABLE IF NOT EXISTS external_pension_estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider pension_provider NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  plan_id VARCHAR(255) NOT NULL,
  estimate_date DATE NOT NULL,
  retirement_age INTEGER NOT NULL,
  expected_retirement_date DATE NOT NULL,
  credited_service_at_retirement NUMERIC(8,4),
  annual_pension NUMERIC(14,2),
  monthly_pension NUMERIC(14,2),
  bridge_benefit NUMERIC(14,2),
  survivor_benefit NUMERIC(14,2),
  commuted_value NUMERIC(18,2),
  inflation_adjusted BOOLEAN,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_pension_est_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_pension_beneficiaries
CREATE TABLE IF NOT EXISTS external_pension_beneficiaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider pension_provider NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100) NOT NULL,
  allocation_percent NUMERIC(5,2) NOT NULL,
  date_of_birth DATE,
  beneficiary_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  effective_date DATE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_pension_ben_unique UNIQUE (organization_id, external_provider, external_id)
);

-- ── Section 3: Calendar Tables ────────────────────────────────────────────

-- external_calendars
CREATE TABLE IF NOT EXISTS external_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider calendar_provider NOT NULL,
  calendar_name VARCHAR(500) NOT NULL,
  description TEXT,
  color VARCHAR(20),
  timezone VARCHAR(100),
  owner_email VARCHAR(255),
  is_shared BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  sync_enabled BOOLEAN DEFAULT TRUE,
  sync_direction VARCHAR(20) DEFAULT 'inbound',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_calendars_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_calendar_events
CREATE TABLE IF NOT EXISTS external_calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider calendar_provider NOT NULL,
  calendar_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  location VARCHAR(500),
  meeting_url TEXT,
  event_type calendar_event_type,
  status calendar_event_status NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_event_id VARCHAR(255),
  organizer_email VARCHAR(255),
  organizer_name VARCHAR(255),
  visibility VARCHAR(20) DEFAULT 'default',
  importance VARCHAR(20) DEFAULT 'normal',
  attendee_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_cal_events_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_calendar_attendees
CREATE TABLE IF NOT EXISTS external_calendar_attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider calendar_provider NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  response_status attendee_response NOT NULL,
  is_organizer BOOLEAN DEFAULT FALSE,
  is_optional BOOLEAN DEFAULT FALSE,
  comment TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_cal_att_unique UNIQUE (organization_id, external_provider, external_id)
);

-- external_calendar_recurring_patterns
CREATE TABLE IF NOT EXISTS external_calendar_recurring_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider calendar_provider NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  interval_count INTEGER DEFAULT 1,
  days_of_week VARCHAR(100),
  day_of_month INTEGER,
  month_of_year INTEGER,
  count INTEGER,
  until_date TIMESTAMPTZ,
  exceptions TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ext_cal_recur_unique UNIQUE (organization_id, external_provider, external_id)
);

-- ── Section 4: Drop the old stub table ────────────────────────────────────

-- external_calendar_connections was a 5-column stub, replaced by external_calendars
DROP TABLE IF EXISTS external_calendar_connections;

-- ── Section 5: Indexes ────────────────────────────────────────────────────

-- Pension Plans
CREATE INDEX IF NOT EXISTS ext_pension_plans_org_provider_idx ON external_pension_plans(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_pension_plans_number_idx ON external_pension_plans(plan_number);
CREATE INDEX IF NOT EXISTS ext_pension_plans_status_idx ON external_pension_plans(status);
CREATE INDEX IF NOT EXISTS ext_pension_plans_jurisdiction_idx ON external_pension_plans(jurisdiction);

-- Pension Members
CREATE INDEX IF NOT EXISTS ext_pension_members_org_provider_idx ON external_pension_members(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_pension_members_employee_idx ON external_pension_members(employee_id);
CREATE INDEX IF NOT EXISTS ext_pension_members_plan_idx ON external_pension_members(plan_id);
CREATE INDEX IF NOT EXISTS ext_pension_members_status_idx ON external_pension_members(member_status);

-- Pension Contributions
CREATE INDEX IF NOT EXISTS ext_pension_contrib_org_provider_idx ON external_pension_contributions(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_pension_contrib_member_idx ON external_pension_contributions(member_id);
CREATE INDEX IF NOT EXISTS ext_pension_contrib_plan_idx ON external_pension_contributions(plan_id);
CREATE INDEX IF NOT EXISTS ext_pension_contrib_period_idx ON external_pension_contributions(period_start, period_end);
CREATE INDEX IF NOT EXISTS ext_pension_contrib_type_idx ON external_pension_contributions(contribution_type);

-- Pension Service Credits
CREATE INDEX IF NOT EXISTS ext_pension_svc_org_provider_idx ON external_pension_service_credits(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_pension_svc_member_idx ON external_pension_service_credits(member_id);
CREATE INDEX IF NOT EXISTS ext_pension_svc_plan_idx ON external_pension_service_credits(plan_id);
CREATE INDEX IF NOT EXISTS ext_pension_svc_type_idx ON external_pension_service_credits(credit_type);

-- Pension Estimates
CREATE INDEX IF NOT EXISTS ext_pension_est_org_provider_idx ON external_pension_estimates(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_pension_est_member_idx ON external_pension_estimates(member_id);
CREATE INDEX IF NOT EXISTS ext_pension_est_plan_idx ON external_pension_estimates(plan_id);
CREATE INDEX IF NOT EXISTS ext_pension_est_ret_age_idx ON external_pension_estimates(retirement_age);

-- Pension Beneficiaries
CREATE INDEX IF NOT EXISTS ext_pension_ben_org_provider_idx ON external_pension_beneficiaries(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_pension_ben_member_idx ON external_pension_beneficiaries(member_id);
CREATE INDEX IF NOT EXISTS ext_pension_ben_status_idx ON external_pension_beneficiaries(status);

-- Calendars
CREATE INDEX IF NOT EXISTS ext_calendars_org_provider_idx ON external_calendars(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_calendars_owner_idx ON external_calendars(owner_email);

-- Calendar Events
CREATE INDEX IF NOT EXISTS ext_cal_events_org_provider_idx ON external_calendar_events(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_cal_events_calendar_idx ON external_calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS ext_cal_events_time_range_idx ON external_calendar_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS ext_cal_events_status_idx ON external_calendar_events(status);
CREATE INDEX IF NOT EXISTS ext_cal_events_type_idx ON external_calendar_events(event_type);
CREATE INDEX IF NOT EXISTS ext_cal_events_organizer_idx ON external_calendar_events(organizer_email);

-- Calendar Attendees
CREATE INDEX IF NOT EXISTS ext_cal_att_org_provider_idx ON external_calendar_attendees(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_cal_att_event_idx ON external_calendar_attendees(event_id);
CREATE INDEX IF NOT EXISTS ext_cal_att_email_idx ON external_calendar_attendees(email);
CREATE INDEX IF NOT EXISTS ext_cal_att_response_idx ON external_calendar_attendees(response_status);

-- Calendar Recurring Patterns
CREATE INDEX IF NOT EXISTS ext_cal_recur_org_provider_idx ON external_calendar_recurring_patterns(organization_id, external_provider);
CREATE INDEX IF NOT EXISTS ext_cal_recur_event_idx ON external_calendar_recurring_patterns(event_id);

-- ── Done ──────────────────────────────────────────────────────────────────
SELECT 'Migration complete: pension + calendar tables created' AS result;

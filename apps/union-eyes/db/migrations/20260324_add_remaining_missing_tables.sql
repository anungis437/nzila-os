-- Migration: Create 20 missing tables referenced by CRUD routes
-- Date: 2026-03-24
-- Tables: analytics_metrics, bargaining_units, calendars, calendar_events,
--   chat_sessions, committees, external_accounts, external_calendar_connections,
--   external_invoices, federations, knowledge_base, kpi_configurations, meeting_rooms,
--   member_segments, ml_predictions, oauth_providers, pending_profiles, trend_analyses,
--   voting_sessions, worksites
-- Note: cba_clauses and claim_deadlines already exist

-- ============================================================
-- 1. Create missing enum types
-- ============================================================

DO $$ BEGIN
  CREATE TYPE unit_type AS ENUM ('full_time','part_time','casual','mixed','craft','industrial','professional');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_status AS ENUM ('active','under_certification','decertified','merged','inactive','archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('synced','pending','failed','disconnected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('meeting','appointment','deadline','reminder','task','hearing','mediation','negotiation','training','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('scheduled','confirmed','cancelled','completed','no_show','rescheduled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chat_session_status AS ENUM ('active','archived','deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ai_provider AS ENUM ('openai','anthropic','google','internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE committee_type AS ENUM ('bargaining','grievance','health_safety','political_action','equity','education','organizing','steward','executive','finance','communications','social','pension_benefits','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE deadline_status AS ENUM ('pending','completed','missed','extended','waived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE deadline_priority AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE worksite_status AS ENUM ('active','temporarily_closed','permanently_closed','seasonal','archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE room_status AS ENUM ('available','booked','maintenance','unavailable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE federation_type AS ENUM ('provincial','regional','sectoral','international');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE knowledge_document_type AS ENUM ('collective_agreement','union_policy','labor_law','precedent','faq','guide','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Create tables (ordered by FK dependencies)
-- ============================================================

-- 2.1 analytics_metrics (no FK deps beyond organizations)
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT,
  period_type TEXT NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  metadata JSONB,
  comparison_value NUMERIC,
  trend TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.2 worksites (needed by bargaining_units and committees)
CREATE TABLE IF NOT EXISTS worksites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  status worksite_status NOT NULL DEFAULT 'active',
  address JSONB,
  employee_count INTEGER,
  shift_count INTEGER,
  operates_weekends BOOLEAN DEFAULT FALSE,
  operates_24_hours BOOLEAN DEFAULT FALSE,
  site_manager_name VARCHAR(255),
  site_manager_email VARCHAR(255),
  site_manager_phone VARCHAR(50),
  description TEXT,
  notes TEXT,
  custom_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES profiles(user_id),
  updated_by TEXT REFERENCES profiles(user_id),
  archived_at TIMESTAMPTZ
);

-- 2.3 bargaining_units (references worksites, employers, profiles)
CREATE TABLE IF NOT EXISTS bargaining_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  worksite_id UUID REFERENCES worksites(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  unit_number VARCHAR(50),
  unit_type unit_type NOT NULL,
  status unit_status NOT NULL DEFAULT 'active',
  certification_number VARCHAR(100),
  certification_date DATE,
  certification_body VARCHAR(100),
  certification_expiry_date DATE,
  current_collective_agreement_id UUID,
  contract_expiry_date DATE,
  next_bargaining_date DATE,
  member_count INTEGER DEFAULT 0,
  classifications JSONB,
  chief_steward_id TEXT REFERENCES profiles(user_id),
  bargaining_chair_id TEXT REFERENCES profiles(user_id),
  description TEXT,
  notes TEXT,
  custom_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES profiles(user_id),
  updated_by TEXT REFERENCES profiles(user_id),
  archived_at TIMESTAMPTZ
);

-- 2.4 calendars (needed by calendar_events)
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  icon VARCHAR(50),
  owner_id TEXT NOT NULL,
  is_personal BOOLEAN DEFAULT TRUE,
  is_shared BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  external_provider VARCHAR(50),
  external_calendar_id TEXT,
  sync_enabled BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMP,
  sync_status sync_status DEFAULT 'disconnected',
  sync_token TEXT,
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  default_event_duration INTEGER DEFAULT 60,
  reminder_default_minutes INTEGER DEFAULT 15,
  allow_overlap BOOLEAN DEFAULT TRUE,
  require_approval BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.5 calendar_events (references calendars)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  location_url TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  is_all_day BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,
  recurrence_exceptions JSONB,
  parent_event_id UUID,
  event_type event_type DEFAULT 'meeting',
  status event_status DEFAULT 'scheduled',
  priority VARCHAR(20) DEFAULT 'normal',
  claim_id TEXT,
  case_number TEXT,
  member_id TEXT,
  meeting_room_id UUID,
  meeting_url TEXT,
  meeting_password TEXT,
  agenda TEXT,
  organizer_id TEXT NOT NULL,
  reminders JSONB DEFAULT '[15]'::jsonb,
  external_event_id TEXT,
  external_provider VARCHAR(50),
  external_html_link TEXT,
  last_sync_at TIMESTAMP,
  is_private BOOLEAN DEFAULT FALSE,
  visibility VARCHAR(20) DEFAULT 'default',
  metadata JSONB,
  attachments JSONB,
  created_by TEXT NOT NULL,
  cancelled_at TIMESTAMP,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.6 chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status chat_session_status NOT NULL DEFAULT 'active',
  ai_provider ai_provider NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-4',
  temperature TEXT DEFAULT '0.7',
  context_tags JSONB,
  related_entity_type TEXT,
  related_entity_id TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMP,
  helpful BOOLEAN,
  feedback_comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.7 committees (references bargaining_units, worksites, profiles)
CREATE TABLE IF NOT EXISTS committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  committee_type committee_type NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  unit_id UUID REFERENCES bargaining_units(id) ON DELETE SET NULL,
  worksite_id UUID REFERENCES worksites(id) ON DELETE SET NULL,
  is_organization_wide BOOLEAN DEFAULT FALSE,
  mandate TEXT,
  meeting_frequency VARCHAR(100),
  meeting_day VARCHAR(50),
  meeting_time VARCHAR(50),
  meeting_location TEXT,
  max_members INTEGER,
  current_member_count INTEGER DEFAULT 0,
  requires_appointment BOOLEAN DEFAULT FALSE,
  requires_election BOOLEAN DEFAULT FALSE,
  term_length INTEGER,
  chair_id TEXT REFERENCES profiles(user_id),
  secretary_id TEXT REFERENCES profiles(user_id),
  contact_email VARCHAR(255),
  description TEXT,
  notes TEXT,
  custom_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES profiles(user_id),
  updated_by TEXT REFERENCES profiles(user_id),
  archived_at TIMESTAMPTZ
);

-- 2.8 external_accounts
CREATE TABLE IF NOT EXISTS external_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider VARCHAR(50) NOT NULL,
  account_name VARCHAR(500) NOT NULL,
  account_type VARCHAR(100) NOT NULL,
  account_sub_type VARCHAR(100),
  classification VARCHAR(100),
  current_balance NUMERIC(15,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.9 external_calendar_connections
CREATE TABLE IF NOT EXISTS external_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_account_id TEXT NOT NULL,
  provider_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  scope TEXT,
  sync_enabled BOOLEAN DEFAULT TRUE,
  sync_direction VARCHAR(20) DEFAULT 'both',
  last_sync_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  sync_status sync_status DEFAULT 'synced',
  sync_error TEXT,
  sync_past_days INTEGER DEFAULT 30,
  sync_future_days INTEGER DEFAULT 365,
  sync_only_free_time BOOLEAN DEFAULT FALSE,
  calendar_mappings JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.10 external_invoices
CREATE TABLE IF NOT EXISTS external_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  external_provider VARCHAR(50) NOT NULL,
  invoice_number VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  customer_name VARCHAR(500) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  total_amount NUMERIC(12,2) NOT NULL,
  balance_amount NUMERIC(12,2),
  status VARCHAR(50) NOT NULL,
  last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.11 federations
CREATE TABLE IF NOT EXISTS federations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),
  slug VARCHAR(255) NOT NULL,
  federation_type federation_type NOT NULL DEFAULT 'provincial',
  province VARCHAR(2),
  region VARCHAR(100),
  jurisdiction VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  website TEXT,
  address JSONB,
  founded_date DATE,
  affiliated_with_clc BOOLEAN DEFAULT TRUE,
  clc_affiliate_code VARCHAR(50),
  total_member_unions INTEGER DEFAULT 0,
  total_represented_workers INTEGER DEFAULT 0,
  per_capita_rate NUMERIC(10,4),
  currency VARCHAR(3) DEFAULT 'CAD',
  fiscal_year_end VARCHAR(5),
  status VARCHAR(20) DEFAULT 'active',
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  mission TEXT,
  constitution TEXT,
  bylaws TEXT,
  strategic_plan TEXT,
  settings JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);

-- 2.12 knowledge_base (skip vector column if pgvector not available)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type knowledge_document_type NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT,
  source_url TEXT,
  embedding TEXT,
  embedding_model TEXT DEFAULT 'text-embedding-ada-002',
  tags JSONB,
  keywords JSONB,
  language TEXT NOT NULL DEFAULT 'en',
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_organizations JSONB,
  view_count INTEGER NOT NULL DEFAULT 0,
  citation_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.13 kpi_configurations
CREATE TABLE IF NOT EXISTS kpi_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL,
  data_source TEXT NOT NULL,
  calculation JSONB NOT NULL,
  visualization_type TEXT NOT NULL,
  target_value NUMERIC,
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,
  alert_enabled BOOLEAN DEFAULT FALSE,
  alert_recipients JSONB,
  refresh_interval INTEGER DEFAULT 3600,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER,
  dashboard_layout JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.14 meeting_rooms
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  building_name VARCHAR(200),
  floor VARCHAR(50),
  room_number VARCHAR(50),
  address TEXT,
  capacity INTEGER DEFAULT 10,
  features JSONB,
  equipment JSONB,
  status room_status DEFAULT 'available',
  is_active BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT FALSE,
  min_booking_duration INTEGER DEFAULT 30,
  max_booking_duration INTEGER DEFAULT 480,
  advance_booking_days INTEGER DEFAULT 90,
  operating_hours JSONB,
  allowed_user_roles JSONB,
  blocked_dates JSONB,
  contact_person_id TEXT,
  contact_email TEXT,
  contact_phone VARCHAR(20),
  image_url TEXT,
  floor_plan_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.15 member_segments
CREATE TABLE IF NOT EXISTS member_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_executed_at TIMESTAMP,
  execution_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2.16 ml_predictions
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  target_date TIMESTAMP NOT NULL,
  predicted_value NUMERIC NOT NULL,
  confidence_interval JSONB,
  confidence_score NUMERIC,
  features JSONB,
  actual_value NUMERIC,
  accuracy NUMERIC,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMP
);

-- 2.17 oauth_providers (in user_management schema)
-- (user_management schema does not exist at this migration point — skipped)
-- CREATE TABLE IF NOT EXISTS user_management.oauth_providers ( ... );

-- 2.18 pending_profiles
CREATE TABLE IF NOT EXISTS pending_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  token TEXT,
  membership membership NOT NULL DEFAULT 'pro',
  payment_provider payment_provider DEFAULT 'whop',
  whop_user_id TEXT,
  whop_membership_id TEXT,
  plan_duration TEXT,
  billing_cycle_start TIMESTAMP,
  billing_cycle_end TIMESTAMP,
  next_credit_renewal TIMESTAMP,
  usage_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_by_user_id TEXT,
  claimed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.19 trend_analyses
CREATE TABLE IF NOT EXISTS trend_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  data_source TEXT NOT NULL,
  time_range JSONB NOT NULL,
  detected_trend TEXT,
  trend_strength NUMERIC,
  anomalies_detected JSONB,
  anomaly_count INTEGER DEFAULT 0,
  seasonal_pattern JSONB,
  correlations JSONB,
  insights TEXT,
  recommendations JSONB,
  statistical_tests JSONB,
  visualization_data JSONB,
  confidence NUMERIC,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2.20 voting_sessions
CREATE TABLE IF NOT EXISTS voting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  meeting_type VARCHAR(50) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  scheduled_end_time TIMESTAMPTZ,
  allow_anonymous BOOLEAN DEFAULT TRUE,
  requires_quorum BOOLEAN DEFAULT TRUE,
  quorum_threshold INTEGER DEFAULT 50,
  total_eligible_voters INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

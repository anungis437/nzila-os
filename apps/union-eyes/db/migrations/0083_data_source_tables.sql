-- Migration: 0083_data_source_tables.sql
-- Creates tables referenced by the data-source dashboard page
-- Tables: claims, claim_deadlines, dues_assignments,
--         wage_benchmarks, union_density, cost_of_living_data,
--         contribution_rates, external_data_sync_log

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE claim_status AS ENUM (
    'submitted','under_review','assigned','investigation',
    'pending_documentation','resolved','rejected','closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE claim_priority AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE claim_type AS ENUM (
    'grievance_discipline','grievance_schedule','grievance_pay',
    'workplace_safety',
    'discrimination_age','discrimination_gender','discrimination_race',
    'discrimination_disability','discrimination_other',
    'harassment_sexual','harassment_workplace',
    'wage_dispute','contract_dispute','retaliation','wrongful_termination','other',
    'harassment_verbal','harassment_physical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE visibility_scope AS ENUM ('member','staff','admin','system');
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
  CREATE TYPE extension_status AS ENUM ('pending','approved','denied','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('info','warning','urgent','critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_method AS ENUM ('email','sms','push','in_app');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('pending','sent','delivered','failed','bounced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 1. CLAIMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS claims (
  claim_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number    VARCHAR(50) NOT NULL UNIQUE,
  organization_id UUID NOT NULL,
  member_id       VARCHAR(255) NOT NULL,
  is_anonymous    BOOLEAN DEFAULT TRUE,

  -- Claim details
  claim_type      claim_type NOT NULL,
  status          claim_status NOT NULL DEFAULT 'submitted',
  priority        claim_priority NOT NULL DEFAULT 'medium',

  -- Incident information
  incident_date   TIMESTAMPTZ NOT NULL,
  location        TEXT NOT NULL,
  description     TEXT NOT NULL,
  desired_outcome TEXT NOT NULL,

  -- Witness and reporting
  witnesses_present       BOOLEAN DEFAULT FALSE,
  witness_details         TEXT,
  previously_reported     BOOLEAN DEFAULT FALSE,
  previous_report_details TEXT,

  -- Assignment
  assigned_to VARCHAR(255),
  assigned_at TIMESTAMPTZ,

  -- AI analysis
  ai_score          INTEGER,
  ai_analysis       JSONB,
  merit_confidence  INTEGER,
  precedent_match   INTEGER,
  complexity_score  INTEGER,

  -- Progress
  progress INTEGER DEFAULT 0,

  -- Financial
  claim_amount      VARCHAR(20),
  settlement_amount VARCHAR(20),
  legal_costs       VARCHAR(20),
  court_costs       VARCHAR(20),

  -- Resolution
  resolution_outcome VARCHAR(100),
  filed_date         TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,

  -- Attachments & voice
  attachments          JSONB DEFAULT '[]'::jsonb,
  voice_transcriptions JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  metadata   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at  TIMESTAMPTZ
);

-- ============================================================================
-- 2. CLAIM DEADLINES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS claim_deadlines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id              UUID NOT NULL,
  organization_id       UUID NOT NULL,
  deadline_rule_id      UUID,
  deadline_name         VARCHAR(255) NOT NULL,
  deadline_type         VARCHAR(100) NOT NULL,
  event_date            TIMESTAMP NOT NULL,
  original_deadline     TIMESTAMP NOT NULL,
  due_date              TIMESTAMP NOT NULL,
  completed_at          TIMESTAMP,
  status                deadline_status NOT NULL DEFAULT 'pending',
  priority              deadline_priority NOT NULL DEFAULT 'medium',
  extension_count       INTEGER NOT NULL DEFAULT 0,
  total_extension_days  INTEGER NOT NULL DEFAULT 0,
  last_extension_date   TIMESTAMP,
  last_extension_reason TEXT,
  completed_by          VARCHAR(255),
  completion_notes      TEXT,
  is_overdue            BOOLEAN NOT NULL DEFAULT FALSE,
  days_until_due        INTEGER,
  days_overdue          INTEGER NOT NULL DEFAULT 0,
  escalated_at          TIMESTAMP,
  escalated_to          VARCHAR(255),
  alert_count           INTEGER NOT NULL DEFAULT 0,
  last_alert_sent       TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. DUES ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dues_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  member_id       UUID NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  frequency       VARCHAR(50) NOT NULL DEFAULT 'monthly',
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  effective_date  TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. WAGE BENCHMARKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS wage_benchmarks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noc_code            VARCHAR(10)  NOT NULL,
  noc_name            VARCHAR(255) NOT NULL,
  noc_category        VARCHAR(100),
  geography_code      VARCHAR(10)  NOT NULL,
  geography_name      VARCHAR(255) NOT NULL,
  geography_type      VARCHAR(20)  NOT NULL DEFAULT 'national',
  naics_code          VARCHAR(10),
  naics_name          VARCHAR(255),
  wage_value          NUMERIC(12,2) NOT NULL,
  wage_unit           VARCHAR(20)   NOT NULL DEFAULT 'hourly',
  wage_type           VARCHAR(50)   NOT NULL,
  sex                 VARCHAR(1)    NOT NULL DEFAULT 'B',
  age_group           VARCHAR(50),
  age_group_name      VARCHAR(100),
  education_level     VARCHAR(50),
  statistics_type     VARCHAR(100),
  data_type           VARCHAR(100),
  ref_date            VARCHAR(20)   NOT NULL,
  survey_year         INTEGER       NOT NULL,
  source              VARCHAR(100)  NOT NULL DEFAULT 'Statistics Canada',
  data_quality_symbol VARCHAR(10),
  is_terminated       BOOLEAN DEFAULT FALSE,
  decimals            INTEGER DEFAULT 2,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_id             VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_wage_benchmarks_noc      ON wage_benchmarks (noc_code);
CREATE INDEX IF NOT EXISTS idx_wage_benchmarks_geography ON wage_benchmarks (geography_code);
CREATE INDEX IF NOT EXISTS idx_wage_benchmarks_noc_geo   ON wage_benchmarks (noc_code, geography_code);
CREATE INDEX IF NOT EXISTS idx_wage_benchmarks_ref_date  ON wage_benchmarks (ref_date);
CREATE INDEX IF NOT EXISTS idx_wage_benchmarks_sync      ON wage_benchmarks (sync_id);
CREATE INDEX IF NOT EXISTS idx_wage_benchmarks_composite ON wage_benchmarks (noc_code, geography_code, sex, ref_date);

-- ============================================================================
-- 5. UNION DENSITY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS union_density (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_code   VARCHAR(10)  NOT NULL,
  geography_name   VARCHAR(255) NOT NULL,
  naics_code       VARCHAR(10),
  naics_name       VARCHAR(255),
  noc_code         VARCHAR(10),
  noc_name         VARCHAR(255),
  sex              VARCHAR(1)   NOT NULL DEFAULT 'B',
  age_group        VARCHAR(50),
  age_group_name   VARCHAR(100),
  citizenship      VARCHAR(50),
  citizenship_name VARCHAR(100),
  union_status      VARCHAR(50)  NOT NULL,
  union_status_name VARCHAR(100) NOT NULL,
  density_value    NUMERIC(5,2) NOT NULL,
  ref_date         VARCHAR(20)  NOT NULL,
  survey_year      INTEGER      NOT NULL,
  source           VARCHAR(100) NOT NULL DEFAULT 'Statistics Canada',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sync_id          VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_union_density_noc   ON union_density (noc_code);
CREATE INDEX IF NOT EXISTS idx_union_density_naics ON union_density (naics_code);
CREATE INDEX IF NOT EXISTS idx_union_density_geo   ON union_density (geography_code);
CREATE INDEX IF NOT EXISTS idx_union_density_ref   ON union_density (ref_date);

-- ============================================================================
-- 6. COST OF LIVING DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_of_living_data (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_code VARCHAR(10)   NOT NULL,
  geography_name VARCHAR(255)  NOT NULL,
  cpi_value      NUMERIC(10,2) NOT NULL,
  cpi_vector     VARCHAR(50),
  inflation_rate NUMERIC(5,2)  NOT NULL,
  year           INTEGER       NOT NULL,
  ref_date       VARCHAR(20)   NOT NULL,
  source         VARCHAR(100)  NOT NULL DEFAULT 'Statistics Canada',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  sync_id        VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_col_data_geo  ON cost_of_living_data (geography_code);
CREATE INDEX IF NOT EXISTS idx_col_data_year ON cost_of_living_data (year);

-- ============================================================================
-- 7. CONTRIBUTION RATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS contribution_rates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type               VARCHAR(50)    NOT NULL,
  rate_type_name          VARCHAR(100),
  rate                    NUMERIC(5,4)   NOT NULL,
  max_insurable_earnings  NUMERIC(12,2),
  exemption_limit         NUMERIC(12,2),
  maximum_contribution    NUMERIC(12,2),
  year                    INTEGER        NOT NULL,
  effective_date          VARCHAR(20),
  source                  VARCHAR(100)   NOT NULL DEFAULT 'Canada Revenue Agency',
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  sync_id                 VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_contribution_rates_type ON contribution_rates (rate_type);
CREATE INDEX IF NOT EXISTS idx_contribution_rates_year ON contribution_rates (year);

-- ============================================================================
-- 8. EXTERNAL DATA SYNC LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_data_sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            VARCHAR(100) NOT NULL,
  source_type       VARCHAR(50)  NOT NULL,
  sync_id           VARCHAR(100) NOT NULL UNIQUE,
  started_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  status            VARCHAR(20)  NOT NULL DEFAULT 'running',
  records_processed INTEGER DEFAULT 0,
  records_inserted  INTEGER DEFAULT 0,
  records_updated   INTEGER DEFAULT 0,
  records_failed    INTEGER DEFAULT 0,
  error_message     TEXT,
  error_details     TEXT,
  initiated_by      VARCHAR(100),
  sync_type         VARCHAR(50) NOT NULL DEFAULT 'manual',
  parameters        TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_source  ON external_data_sync_log (source);
CREATE INDEX IF NOT EXISTS idx_sync_log_status  ON external_data_sync_log (status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON external_data_sync_log (started_at);

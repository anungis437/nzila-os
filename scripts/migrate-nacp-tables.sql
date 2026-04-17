-- Idempotent NACP schema migration (local recovery)
-- Source of truth: packages/db/src/schema/nacp.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enum guards
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE nacp_exam_session_status AS ENUM ('scheduled','opened','in_progress','sealed','exported','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nacp_candidate_status AS ENUM ('registered','verified','eligible','suspended','disqualified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nacp_submission_status AS ENUM ('pending','submitted','marked','moderated','finalized','appealed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nacp_subject_level AS ENUM ('primary','secondary','tertiary'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nacp_center_status AS ENUM ('active','inactive','suspended'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nacp_integrity_status AS ENUM ('pending','verified','tampered','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE nacp_gender AS ENUM ('male','female'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Core NACP tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nacp_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  name varchar(255) NOT NULL,
  code varchar(50) NOT NULL,
  level nacp_subject_level NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nacp_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  name varchar(255) NOT NULL,
  code varchar(50) NOT NULL,
  province varchar(255) NOT NULL,
  district varchar(255) NOT NULL,
  capacity integer NOT NULL,
  status nacp_center_status NOT NULL DEFAULT 'active',
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nacp_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  title varchar(255) NOT NULL,
  code varchar(50) NOT NULL,
  subject_id uuid NOT NULL REFERENCES nacp_subjects(id),
  level nacp_subject_level NOT NULL,
  year integer NOT NULL,
  duration_minutes integer NOT NULL,
  total_marks integer NOT NULL,
  pass_percentage numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nacp_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  exam_id uuid NOT NULL REFERENCES nacp_exams(id),
  center_id uuid NOT NULL REFERENCES nacp_centers(id),
  ref varchar(50) NOT NULL,
  status nacp_exam_session_status NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz NOT NULL,
  opened_at timestamptz,
  sealed_at timestamptz,
  exported_at timestamptz,
  closed_at timestamptz,
  integrity_hash text,
  supervisor_id uuid,
  candidate_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nacp_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  ref varchar(50) NOT NULL,
  first_name varchar(255) NOT NULL,
  last_name varchar(255) NOT NULL,
  date_of_birth text NOT NULL,
  gender nacp_gender NOT NULL,
  center_id uuid NOT NULL REFERENCES nacp_centers(id),
  status nacp_candidate_status NOT NULL DEFAULT 'registered',
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nacp_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  session_id uuid NOT NULL REFERENCES nacp_exam_sessions(id),
  candidate_id uuid NOT NULL REFERENCES nacp_candidates(id),
  exam_id uuid NOT NULL REFERENCES nacp_exams(id),
  status nacp_submission_status NOT NULL DEFAULT 'pending',
  raw_score numeric,
  moderated_score numeric,
  final_score numeric,
  grade varchar(10),
  submitted_at timestamptz,
  marked_at timestamptz,
  marked_by uuid,
  moderated_at timestamptz,
  moderated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nacp_integrity_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  session_id uuid NOT NULL REFERENCES nacp_exam_sessions(id),
  hash text NOT NULL,
  status nacp_integrity_status NOT NULL DEFAULT 'pending',
  candidate_count integer NOT NULL,
  submission_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Outbox may already exist in this database.
CREATE TABLE IF NOT EXISTS nacp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  event_type varchar(255) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz
);

CREATE TABLE IF NOT EXISTS nacp_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  entity_type varchar(100) NOT NULL,
  action varchar(20) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text
);

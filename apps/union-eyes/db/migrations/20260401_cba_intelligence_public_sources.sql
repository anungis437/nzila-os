-- ==========================================================================
-- CBA Intelligence: Public Source Registry, Ingestion, Extraction, Review
-- Migration: 20260401_cba_intelligence_public_sources.sql
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Enums
-- --------------------------------------------------------------------------

CREATE TYPE cba_intel_source_type AS ENUM (
  'federal_labour',
  'provincial_labour_board',
  'provincial_ministry',
  'quebec_labour',
  'legal_arbitration',
  'union_bulletin',
  'stats_benchmark',
  'academic',
  'news'
);

CREATE TYPE cba_intel_source_format AS ENUM (
  'html', 'pdf', 'feed', 'search_result', 'legal_decision', 'bulletin', 'csv', 'api'
);

CREATE TYPE cba_intel_collection_method AS ENUM (
  'manual_upload', 'scheduled_fetch', 'api_sync', 'rss_feed', 'email_ingest'
);

CREATE TYPE cba_intel_source_health AS ENUM (
  'healthy', 'degraded', 'unreachable', 'unknown'
);

CREATE TYPE cba_intel_trust_tier AS ENUM (
  'official', 'authoritative', 'curated', 'unverified'
);

CREATE TYPE cba_intel_ingestion_status AS ENUM (
  'queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'
);

CREATE TYPE cba_intel_failure_class AS ENUM (
  'network', 'auth', 'parse', 'rate_limit', 'schema_mismatch', 'timeout', 'unknown'
);

CREATE TYPE cba_intel_doc_type AS ENUM (
  'full_agreement', 'settlement_summary', 'wage_reopener',
  'memorandum_of_agreement', 'arbitration_decision', 'bulletin',
  'news_article', 'statistical_report', 'other'
);

CREATE TYPE cba_intel_doc_processing_status AS ENUM (
  'fetched', 'normalized', 'parsed', 'extracted', 'reviewed', 'failed'
);

CREATE TYPE cba_intel_extraction_method AS ENUM (
  'deterministic', 'llm_gpt4', 'llm_gpt4_vision', 'hybrid', 'manual'
);

CREATE TYPE cba_intel_extraction_status AS ENUM (
  'pending', 'running', 'completed', 'completed_with_errors', 'failed'
);

CREATE TYPE cba_intel_clause_family AS ENUM (
  'wages', 'premiums', 'hours_of_work', 'overtime', 'scheduling',
  'leave_general', 'vacation', 'sick_leave', 'health_benefits', 'pension',
  'mileage_travel', 'remote_hybrid', 'grievance', 'arbitration', 'seniority',
  'job_posting_bidding', 'health_safety', 'training', 'discipline_discharge',
  'contracting_out', 'union_rights', 'management_rights', 'layoffs_recall',
  'technological_change', 'equity_harassment', 'other'
);

CREATE TYPE cba_intel_review_status AS ENUM (
  'pending_review', 'approved', 'rejected', 'superseded', 'needs_followup'
);

CREATE TYPE cba_intel_review_target_type AS ENUM (
  'finding', 'agreement', 'wage_adjustment', 'clause'
);

CREATE TYPE cba_intel_comparability AS ENUM (
  'exact', 'approximate', 'insufficient_confidence'
);

CREATE TYPE cba_intel_freshness_status AS ENUM (
  'fresh', 'aging', 'stale', 'expired', 'unknown'
);

-- --------------------------------------------------------------------------
-- 2. Source Registry
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(120) NOT NULL UNIQUE,
  name          VARCHAR(300) NOT NULL,
  name_en       VARCHAR(300) NOT NULL,
  name_fr       VARCHAR(300),
  description   TEXT,

  source_type         cba_intel_source_type NOT NULL,
  format_types        JSONB NOT NULL DEFAULT '[]',
  collection_method   cba_intel_collection_method NOT NULL,
  trust_tier          cba_intel_trust_tier NOT NULL DEFAULT 'unverified',

  jurisdictions   JSONB NOT NULL DEFAULT '[]',
  sectors         JSONB DEFAULT '[]',

  base_url        TEXT NOT NULL,
  api_endpoint    TEXT,
  feed_url        TEXT,

  update_cadence       VARCHAR(60),
  expected_update_days INTEGER,

  health_status          cba_intel_source_health NOT NULL DEFAULT 'unknown',
  last_checked_at        TIMESTAMPTZ,
  last_success_at        TIMESTAMPTZ,
  consecutive_failures   INTEGER NOT NULL DEFAULT 0,

  robots_notes           TEXT,
  terms_url              TEXT,
  redistribution_notes   TEXT,
  provenance_rules       JSONB,

  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  adapter_key    VARCHAR(120),
  config         JSONB,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_sources_type   ON cba_intel_sources (source_type);
CREATE INDEX idx_cba_intel_sources_health ON cba_intel_sources (health_status);
CREATE INDEX idx_cba_intel_sources_active ON cba_intel_sources (is_active);

-- --------------------------------------------------------------------------
-- 3. Ingestion Jobs
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_ingestion_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES cba_intel_sources(id) ON DELETE CASCADE,

  status         cba_intel_ingestion_status NOT NULL DEFAULT 'queued',
  failure_class  cba_intel_failure_class,

  documents_found     INTEGER DEFAULT 0,
  documents_new       INTEGER DEFAULT 0,
  documents_updated   INTEGER DEFAULT 0,
  documents_unchanged INTEGER DEFAULT 0,
  documents_failed    INTEGER DEFAULT 0,

  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   INTEGER,

  trigger_type      VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  triggered_by      VARCHAR(255),
  adapter_version   VARCHAR(60),

  error_message   TEXT,
  error_details   JSONB,

  retry_count   INTEGER NOT NULL DEFAULT 0,
  max_retries   INTEGER NOT NULL DEFAULT 3,
  parent_job_id UUID,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_jobs_source  ON cba_intel_ingestion_jobs (source_id);
CREATE INDEX idx_cba_intel_jobs_status  ON cba_intel_ingestion_jobs (status);
CREATE INDEX idx_cba_intel_jobs_created ON cba_intel_ingestion_jobs (created_at);

-- --------------------------------------------------------------------------
-- 4. Source Documents
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES cba_intel_sources(id) ON DELETE CASCADE,

  source_url     TEXT NOT NULL,
  source_doc_id  VARCHAR(255),
  title          VARCHAR(500),

  document_type     cba_intel_doc_type NOT NULL,
  language          VARCHAR(10) NOT NULL DEFAULT 'en',

  raw_content       TEXT,
  normalized_text   TEXT,
  parsed_metadata   JSONB,
  content_hash      VARCHAR(64) NOT NULL,

  processing_status  cba_intel_doc_processing_status NOT NULL DEFAULT 'fetched',
  page_count         INTEGER,
  word_count         INTEGER,

  version             INTEGER NOT NULL DEFAULT 1,
  previous_version_id UUID,
  is_latest           BOOLEAN NOT NULL DEFAULT TRUE,

  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at      TIMESTAMPTZ,
  ingestion_job_id  UUID,

  jurisdiction  VARCHAR(40),
  sector        VARCHAR(200),

  is_summary_only  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_docs_source       ON cba_intel_documents (source_id);
CREATE INDEX idx_cba_intel_docs_hash         ON cba_intel_documents (content_hash);
CREATE INDEX idx_cba_intel_docs_status       ON cba_intel_documents (processing_status);
CREATE INDEX idx_cba_intel_docs_jurisdiction  ON cba_intel_documents (jurisdiction);
CREATE INDEX idx_cba_intel_docs_type         ON cba_intel_documents (document_type);
CREATE INDEX idx_cba_intel_docs_latest       ON cba_intel_documents (is_latest);

-- --------------------------------------------------------------------------
-- 5. Extraction Runs
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_extraction_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES cba_intel_documents(id) ON DELETE CASCADE,

  extraction_method  cba_intel_extraction_method NOT NULL,
  model_version      VARCHAR(60),
  prompt_version     VARCHAR(60),

  status          cba_intel_extraction_status NOT NULL DEFAULT 'pending',
  findings_count  INTEGER DEFAULT 0,
  error_count     INTEGER DEFAULT 0,
  errors          JSONB,

  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   INTEGER,

  triggered_by  VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_runs_doc    ON cba_intel_extraction_runs (document_id);
CREATE INDEX idx_cba_intel_runs_status ON cba_intel_extraction_runs (status);

-- --------------------------------------------------------------------------
-- 6. Extraction Findings
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id UUID NOT NULL REFERENCES cba_intel_extraction_runs(id) ON DELETE CASCADE,
  document_id       UUID NOT NULL REFERENCES cba_intel_documents(id) ON DELETE CASCADE,

  finding_type    VARCHAR(60) NOT NULL,
  clause_family   cba_intel_clause_family,

  label              VARCHAR(300) NOT NULL,
  value              TEXT,
  value_structured   JSONB,

  source_span_start  INTEGER,
  source_span_end    INTEGER,
  source_section     VARCHAR(200),
  source_page_number INTEGER,
  citation_text      TEXT,

  confidence         NUMERIC(4,3) NOT NULL,
  is_inferred        BOOLEAN NOT NULL DEFAULT FALSE,
  extraction_method  cba_intel_extraction_method NOT NULL,

  content_hash    VARCHAR(64) NOT NULL,
  review_status   VARCHAR(30) DEFAULT 'pending_review',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_findings_run    ON cba_intel_findings (extraction_run_id);
CREATE INDEX idx_cba_intel_findings_doc    ON cba_intel_findings (document_id);
CREATE INDEX idx_cba_intel_findings_type   ON cba_intel_findings (finding_type);
CREATE INDEX idx_cba_intel_findings_family ON cba_intel_findings (clause_family);
CREATE INDEX idx_cba_intel_findings_hash   ON cba_intel_findings (content_hash);
CREATE INDEX idx_cba_intel_findings_review ON cba_intel_findings (review_status);

-- --------------------------------------------------------------------------
-- 7. Extracted Agreements
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_agreements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES cba_intel_documents(id) ON DELETE CASCADE,
  extraction_run_id   UUID REFERENCES cba_intel_extraction_runs(id),

  title                       VARCHAR(500) NOT NULL,
  employer_normalized         VARCHAR(300) NOT NULL,
  union_normalized            VARCHAR(300) NOT NULL,
  local_entity                VARCHAR(200),
  bargaining_unit_description TEXT,

  jurisdiction        VARCHAR(40) NOT NULL,
  sector              VARCHAR(200),

  effective_date      TIMESTAMPTZ,
  expiry_date         TIMESTAMPTZ,
  ratification_date   TIMESTAMPTZ,
  term_months         INTEGER,

  employee_coverage   INTEGER,

  is_summary_only  BOOLEAN NOT NULL DEFAULT FALSE,
  has_full_text    BOOLEAN NOT NULL DEFAULT FALSE,

  extraction_status   VARCHAR(30) NOT NULL DEFAULT 'extracted',
  review_status       VARCHAR(30) NOT NULL DEFAULT 'pending_review',

  overall_confidence  NUMERIC(4,3) NOT NULL,

  source_id      UUID REFERENCES cba_intel_sources(id),
  source_url     TEXT,
  content_hash   VARCHAR(64),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_agreements_doc          ON cba_intel_agreements (document_id);
CREATE INDEX idx_cba_intel_agreements_jurisdiction ON cba_intel_agreements (jurisdiction);
CREATE INDEX idx_cba_intel_agreements_employer     ON cba_intel_agreements (employer_normalized);
CREATE INDEX idx_cba_intel_agreements_union        ON cba_intel_agreements (union_normalized);
CREATE INDEX idx_cba_intel_agreements_expiry       ON cba_intel_agreements (expiry_date);
CREATE INDEX idx_cba_intel_agreements_review       ON cba_intel_agreements (review_status);

-- --------------------------------------------------------------------------
-- 8. Extracted Wage Adjustments
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_wage_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id  UUID NOT NULL REFERENCES cba_intel_agreements(id) ON DELETE CASCADE,
  finding_id    UUID REFERENCES cba_intel_findings(id),

  effective_date     TIMESTAMPTZ,
  year               INTEGER,
  adjustment_type    VARCHAR(60) NOT NULL,
  adjustment_percent NUMERIC(6,3),
  adjustment_flat    NUMERIC(12,2),
  description        TEXT,

  classification  VARCHAR(200),
  step            INTEGER,

  confidence      NUMERIC(4,3) NOT NULL,
  is_inferred     BOOLEAN NOT NULL DEFAULT FALSE,
  citation_text   TEXT,
  review_status   VARCHAR(30) DEFAULT 'pending_review',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_wages_agreement ON cba_intel_wage_adjustments (agreement_id);
CREATE INDEX idx_cba_intel_wages_year      ON cba_intel_wage_adjustments (year);
CREATE INDEX idx_cba_intel_wages_type      ON cba_intel_wage_adjustments (adjustment_type);

-- --------------------------------------------------------------------------
-- 9. Extracted Clauses
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_clauses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id  UUID NOT NULL REFERENCES cba_intel_agreements(id) ON DELETE CASCADE,
  finding_id    UUID REFERENCES cba_intel_findings(id),

  clause_family   cba_intel_clause_family NOT NULL,
  clause_number   VARCHAR(50),
  title           VARCHAR(500),
  summary         TEXT,
  raw_text        TEXT,

  confidence      NUMERIC(4,3) NOT NULL,
  is_inferred     BOOLEAN NOT NULL DEFAULT FALSE,
  content_hash    VARCHAR(64),
  review_status   VARCHAR(30) DEFAULT 'pending_review',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_clauses_agreement ON cba_intel_clauses (agreement_id);
CREATE INDEX idx_cba_intel_clauses_family    ON cba_intel_clauses (clause_family);
CREATE INDEX idx_cba_intel_clauses_review    ON cba_intel_clauses (review_status);

-- --------------------------------------------------------------------------
-- 10. Review Decisions
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_review_decisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  target_type cba_intel_review_target_type NOT NULL,
  target_id   UUID NOT NULL,

  decision         cba_intel_review_status NOT NULL,
  reason           TEXT,
  comment          TEXT,

  reviewer_id    VARCHAR(255) NOT NULL,
  reviewer_role  VARCHAR(60) NOT NULL,

  previous_status VARCHAR(30),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_reviews_target   ON cba_intel_review_decisions (target_type, target_id);
CREATE INDEX idx_cba_intel_reviews_decision ON cba_intel_review_decisions (decision);
CREATE INDEX idx_cba_intel_reviews_reviewer ON cba_intel_review_decisions (reviewer_id);
CREATE INDEX idx_cba_intel_reviews_created  ON cba_intel_review_decisions (created_at);

-- --------------------------------------------------------------------------
-- 11. Benchmark Snapshots
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_benchmark_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_agreement_id   UUID NOT NULL REFERENCES cba_intel_agreements(id) ON DELETE CASCADE,

  filter_jurisdiction   VARCHAR(40),
  filter_sector         VARCHAR(200),
  filter_union          VARCHAR(300),
  filter_employer_class VARCHAR(200),

  comparable_count      INTEGER NOT NULL,
  comparables           JSONB NOT NULL,

  median_wage_increase    NUMERIC(6,3),
  avg_term_months         NUMERIC(6,1),
  clause_family_coverage  JSONB,

  target_wage_increase  NUMERIC(6,3),
  target_term_months    INTEGER,
  wage_percentile       NUMERIC(5,2),

  snapshot_version  INTEGER NOT NULL DEFAULT 1,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_by       VARCHAR(255),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cba_intel_bench_target       ON cba_intel_benchmark_snapshots (target_agreement_id);
CREATE INDEX idx_cba_intel_bench_computed     ON cba_intel_benchmark_snapshots (computed_at);
CREATE INDEX idx_cba_intel_bench_jurisdiction ON cba_intel_benchmark_snapshots (filter_jurisdiction);

-- --------------------------------------------------------------------------
-- 12. Freshness Log
-- --------------------------------------------------------------------------

CREATE TABLE cba_intel_freshness_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES cba_intel_sources(id) ON DELETE CASCADE,

  checked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  freshness_status        cba_intel_freshness_status NOT NULL,
  days_since_last_success INTEGER,
  document_count          INTEGER,
  stale_document_count    INTEGER,
  notes                   TEXT
);

CREATE INDEX idx_cba_intel_freshness_source  ON cba_intel_freshness_log (source_id);
CREATE INDEX idx_cba_intel_freshness_checked ON cba_intel_freshness_log (checked_at);

-- --------------------------------------------------------------------------
-- 13. Fix CBA number unique constraint to be tenant-scoped
-- --------------------------------------------------------------------------

ALTER TABLE collective_agreements
  DROP CONSTRAINT IF EXISTS collective_agreements_cba_number_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cba_number_per_org
  ON collective_agreements (cba_number, organization_id);

COMMIT;

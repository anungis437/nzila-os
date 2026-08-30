-- Gate 13: Background job execution + cancellation governance tables
-- Regression correction for issue #713 (financial-service typecheck failure).
--
-- JobCancellationService (src/services/job-cancellation-service.ts) has always
-- assumed these three persistence objects existed; they were never created.
-- This migration adds them to match the service's actual read/write contract.

BEGIN;

-- ── 1. Enums ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE job_execution_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_audit_event_type AS ENUM (
    'job_started',
    'job_completed',
    'job_failed',
    'cancellation_requested',
    'cancellation_acknowledged',
    'job_cancelled',
    'reconciliation_event'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Job execution state ──────────────────────────────────────────────
-- One row per (organization, job type, job run). Records lifecycle status
-- and cancellation-request state for financial-service background jobs.
CREATE TABLE IF NOT EXISTS public.ue_governance_job_execution_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type VARCHAR(100) NOT NULL,
  job_run_id VARCHAR(100) NOT NULL,
  job_batch_id VARCHAR(100),
  status job_execution_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_requested BOOLEAN NOT NULL DEFAULT false,
  cancellation_idempotency_key VARCHAR(255),
  cancellation_requested_at TIMESTAMP WITH TIME ZONE,
  cancellation_acknowledged_at TIMESTAMP WITH TIME ZONE,
  cancelled_by VARCHAR(255),
  cancellation_reason TEXT,
  context JSONB,
  result JSONB,
  error JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_ue_gov_job_execution_run UNIQUE (organization_id, job_type, job_run_id)
);

CREATE INDEX IF NOT EXISTS idx_ue_gov_job_exec_state_org ON public.ue_governance_job_execution_state(organization_id);
CREATE INDEX IF NOT EXISTS idx_ue_gov_job_exec_state_status ON public.ue_governance_job_execution_state(status);
CREATE INDEX IF NOT EXISTS idx_ue_gov_job_exec_state_cancel_key ON public.ue_governance_job_execution_state(organization_id, cancellation_idempotency_key);

-- ── 3. Cancellation requests ─────────────────────────────────────────────
-- Idempotent cancellation intent. Application layer inserts with
-- ON CONFLICT DO NOTHING keyed on (organization_id, idempotency_key).
CREATE TABLE IF NOT EXISTS public.ue_governance_job_cancellation_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_execution_state_id UUID NOT NULL REFERENCES public.ue_governance_job_execution_state(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(255) NOT NULL,
  requested_by VARCHAR(255) NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_ue_gov_job_cancellation_idempotency_key UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ue_gov_job_cancel_req_org ON public.ue_governance_job_cancellation_request(organization_id);
CREATE INDEX IF NOT EXISTS idx_ue_gov_job_cancel_req_exec_state ON public.ue_governance_job_cancellation_request(job_execution_state_id);

-- ── 4. Audit events (append-only) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ue_governance_job_cancellation_audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_execution_state_id UUID NOT NULL REFERENCES public.ue_governance_job_execution_state(id) ON DELETE CASCADE,
  event_type job_audit_event_type NOT NULL,
  event_sequence VARCHAR(255) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL,
  message TEXT,
  details JSONB,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ue_gov_job_audit_event_org ON public.ue_governance_job_cancellation_audit_event(organization_id);
CREATE INDEX IF NOT EXISTS idx_ue_gov_job_audit_event_exec_state ON public.ue_governance_job_cancellation_audit_event(job_execution_state_id);

-- ── 5. Immutability: audit events are append-only, no UPDATE/DELETE ──────
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable — % on % is not permitted',
    TG_OP, TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ue_gov_job_cancellation_audit_event_immutable
  ON public.ue_governance_job_cancellation_audit_event;

CREATE TRIGGER trg_ue_gov_job_cancellation_audit_event_immutable
  BEFORE DELETE OR UPDATE ON public.ue_governance_job_cancellation_audit_event
  FOR EACH ROW
  EXECUTE FUNCTION deny_audit_mutation();

COMMIT;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_ue_gov_job_cancellation_audit_event_immutable ON public.ue_governance_job_cancellation_audit_event;
-- DROP TABLE IF EXISTS public.ue_governance_job_cancellation_audit_event;
-- DROP TABLE IF EXISTS public.ue_governance_job_cancellation_request;
-- DROP TABLE IF EXISTS public.ue_governance_job_execution_state;
-- DROP TYPE IF EXISTS job_audit_event_type;
-- DROP TYPE IF EXISTS job_execution_status;
-- -- NOTE: deny_audit_mutation() is left in place (may be reused by other
-- -- immutable-audit tables); drop only if confirmed unused elsewhere.
-- COMMIT;

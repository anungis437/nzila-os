-- PLATFORM_SQL 0047_ml_prediction_feedback
--
-- The SLA feedback route recorded each outcome by rewriting model_metadata.parameters (a feedback queue, a list of scored predictions and
-- running statistics). The runtime role may only SELECT and INSERT model_metadata, so under canonical bootstrap every feedback
-- submission was refused with a permission error and the whole transaction, audit record included, rolled back. The outcome is now
-- its own append-only row: one per prediction (unique prediction_id, so a second submission is a conflict and cannot count a case twice),
-- the statistics are computed from these rows when read, and model_metadata is never updated by the route.
--
-- Tenant data: organization_id uuid NOT NULL with a foreign key to organizations and to ml_predictions. Rows are never updated or
-- deleted by the application (cache migration 0037 gives the runtime role SELECT and INSERT only). Fail closed: the parent tables must
-- exist. Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.ml_predictions') IS NULL THEN
    RAISE EXCEPTION 'ml_prediction_feedback fail-closed: public.ml_predictions does not exist.';
  END IF;
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'ml_prediction_feedback fail-closed: public.organizations does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ml_prediction_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prediction_id uuid NOT NULL REFERENCES public.ml_predictions(id) ON DELETE CASCADE,
  model_version varchar(20),
  predicted_value numeric NOT NULL,
  actual_breach boolean NOT NULL,
  abs_error numeric NOT NULL,
  resolution_hours numeric,
  comment varchar(1000),
  submitted_by varchar(255),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ml_prediction_feedback_abs_error_check CHECK (abs_error >= 0 AND abs_error <= 1),
  CONSTRAINT ml_prediction_feedback_resolution_check CHECK (resolution_hours IS NULL OR resolution_hours >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ml_prediction_feedback_prediction_uq ON public.ml_prediction_feedback (prediction_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ml_prediction_feedback_org_version_idx ON public.ml_prediction_feedback (organization_id, model_version, submitted_at DESC);

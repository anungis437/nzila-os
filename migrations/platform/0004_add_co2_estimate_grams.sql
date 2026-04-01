-- NZ-RISK-027: Add CO₂ estimate column to ai_usage_budgets
-- Tracks accumulated carbon emissions per org/app/profile/month
-- alongside monetary spend.

ALTER TABLE ai_usage_budgets
  ADD COLUMN IF NOT EXISTS co2_estimate_grams NUMERIC(12,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN ai_usage_budgets.co2_estimate_grams
  IS 'Accumulated CO₂ estimate in grams for the billing period (NZ-RISK-027)';

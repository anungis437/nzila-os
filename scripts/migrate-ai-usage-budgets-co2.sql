-- Idempotent hotfix for AI overview schema drift.
-- Ensures ai_usage_budgets has the co2_estimate_grams column expected by Drizzle schema.

ALTER TABLE ai_usage_budgets
  ADD COLUMN IF NOT EXISTS co2_estimate_grams numeric(12,4) NOT NULL DEFAULT 0;

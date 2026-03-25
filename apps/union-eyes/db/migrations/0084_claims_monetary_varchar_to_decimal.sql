-- Migration: Convert claim monetary fields from varchar to decimal(14,2)
-- Ensures proper arithmetic, comparison, and prevents truncation/rounding bugs.
-- Backfills any NULL values to 0 before applying NOT NULL constraint.

BEGIN;

-- Backfill NULLs to '0' before type conversion
UPDATE claims SET claim_amount = '0' WHERE claim_amount IS NULL;
UPDATE claims SET settlement_amount = '0' WHERE settlement_amount IS NULL;
UPDATE claims SET legal_costs = '0' WHERE legal_costs IS NULL;
UPDATE claims SET court_costs = '0' WHERE court_costs IS NULL;

-- Convert varchar → decimal(14,2) NOT NULL DEFAULT 0
ALTER TABLE claims
  ALTER COLUMN claim_amount TYPE decimal(14,2) USING claim_amount::decimal(14,2),
  ALTER COLUMN claim_amount SET NOT NULL,
  ALTER COLUMN claim_amount SET DEFAULT 0;

ALTER TABLE claims
  ALTER COLUMN settlement_amount TYPE decimal(14,2) USING settlement_amount::decimal(14,2),
  ALTER COLUMN settlement_amount SET NOT NULL,
  ALTER COLUMN settlement_amount SET DEFAULT 0;

ALTER TABLE claims
  ALTER COLUMN legal_costs TYPE decimal(14,2) USING legal_costs::decimal(14,2),
  ALTER COLUMN legal_costs SET NOT NULL,
  ALTER COLUMN legal_costs SET DEFAULT 0;

ALTER TABLE claims
  ALTER COLUMN court_costs TYPE decimal(14,2) USING court_costs::decimal(14,2),
  ALTER COLUMN court_costs SET NOT NULL,
  ALTER COLUMN court_costs SET DEFAULT 0;

COMMIT;

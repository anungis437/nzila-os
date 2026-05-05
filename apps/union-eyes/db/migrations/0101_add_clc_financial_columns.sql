-- Migration 0101: Add missing CLC financial columns to organizations
-- These columns are defined in Drizzle schema but were never created in CI database
-- Used for CLC affiliation financial tracking

BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clc_affiliate_code varchar(20);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS per_capita_rate numeric(10, 2);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS remittance_day integer DEFAULT 15;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_remittance_date timestamp with time zone;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiscal_year_end date DEFAULT '2024-12-31';

COMMIT;

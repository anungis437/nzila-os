-- 0025_trustcore_privacy_programs_org_name.sql
--
-- Add a denormalised display name to trustcore_privacy_programs so the
-- public Trust Center page can render the org name without joining
-- the full orgs table (which is gated behind tenancy guards).
--
-- This is the org's chosen public display name for trust artefacts;
-- it MAY differ from `orgs.name` (e.g. legal name vs. brand).
--
-- Backfill: NULL is allowed; the page falls back to `orgId` when null.

ALTER TABLE trustcore_privacy_programs
  ADD COLUMN IF NOT EXISTS org_name TEXT;

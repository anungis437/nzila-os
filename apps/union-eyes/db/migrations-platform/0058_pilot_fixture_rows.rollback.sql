-- Rollback for 0058_pilot_fixture_rows. The origin ledger is discarded: no row is then known to be fixture data, so a later reset refuses until
-- the rows are adopted again. The seeded organizations, members and grievances themselves are untouched.
DROP TABLE IF EXISTS public.pilot_fixture_rows;

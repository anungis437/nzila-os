-- Rollback for 0053_email_address_suppressions. The platform-wide address suppressions are discarded, so every suppressed address is
-- emailable again from every organization; export them first. Organization-scoped consent records are untouched.
DROP TABLE IF EXISTS public.email_address_suppressions;
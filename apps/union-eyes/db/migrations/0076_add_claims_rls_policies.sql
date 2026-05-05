-- Legacy migration intentionally no-op for fresh-DB baseline.
-- Referenced objects (claims/claim_deadlines) were not yet created at this migration point.
-- These operations were consolidated into later schema migrations (0083+).
DO $$
BEGIN
  NULL;
END $$;
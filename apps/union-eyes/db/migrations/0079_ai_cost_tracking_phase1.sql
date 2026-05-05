-- Legacy migration intentionally no-op for fresh-DB baseline.
-- Referenced objects may not exist at this migration point.
-- These operations were consolidated into later schema migrations (0083+).
DO $$
BEGIN
  NULL;
END $$;
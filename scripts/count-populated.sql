-- Count tables with actual data using dynamic SQL
DO $$
DECLARE
  tbl RECORD;
  row_count BIGINT;
  populated INT := 0;
  total INT := 0;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  LOOP
    total := total + 1;
    EXECUTE format('SELECT count(*) FROM public.%I', tbl.tablename) INTO row_count;
    IF row_count > 0 THEN
      populated := populated + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Total: %, Populated: %, Empty: %', total, populated, total - populated;
END $$;

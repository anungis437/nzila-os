-- Get all NOT NULL columns (without defaults) for empty tables
-- This tells us exactly which columns we MUST provide values for
SELECT t.table_name,
       string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position) as required_cols
FROM information_schema.tables t
JOIN information_schema.columns c 
  ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND c.is_nullable = 'NO'
  AND c.column_default IS NULL
  AND t.table_name NOT LIKE 'stripe_%'
  AND t.table_name NOT LIKE 'qbo_%'
  AND t.table_name NOT LIKE 'external_%'
  AND t.table_name NOT LIKE 'django_%'
  AND t.table_name NOT LIKE 'auth_%'
  AND t.table_name NOT LIKE 'celery_%'
  AND t.table_name NOT LIKE 'sync_%'
  AND t.table_name NOT LIKE 'audit_%'
  AND t.table_name NOT LIKE 'webhook_%'
  AND t.table_name NOT LIKE 'ml_%'
  AND t.table_name NOT LIKE 'ai_%'
GROUP BY t.table_name
ORDER BY t.table_name;

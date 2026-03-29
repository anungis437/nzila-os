-- Check which staging tables are missing created_at/updated_at (BaseModel columns)
-- These are the tables we seeded — they must all have id PK + created_at + updated_at
SELECT t.table_name,
       EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='id') AS has_id,
       EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='created_at') AS has_created_at,
       EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name='updated_at') AS has_updated_at,
       (SELECT a.attname FROM pg_constraint pc JOIN pg_attribute a ON a.attrelid = pc.conrelid AND a.attnum = ANY(pc.conkey) WHERE pc.conrelid = (quote_ident('public') || '.' || quote_ident(t.table_name))::regclass AND pc.contype = 'p' LIMIT 1) AS pk_col
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
AND t.table_name IN (
  'claims','claim_deadlines','deadline_rules','claim_updates',
  'grievances','grievance_workflows','grievance_stages',
  'grievance_transitions','grievance_assignments','grievance_documents',
  'grievance_deadlines','arbitrations','arbitration_decisions',
  'organizations','organization_members','users',
  'in_app_notifications','audit_logs','documents',
  'dues_transactions','pension_plans','pension_contributions',
  'benefit_plans','deadline_extensions','deadline_alerts'
)
ORDER BY t.table_name;

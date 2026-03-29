-- Schema parity audit: get PK + column count for key tables
SELECT t.table_name,
       (SELECT a.attname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.conrelid = (quote_ident('public') || '.' || quote_ident(t.table_name))::regclass AND c.contype = 'p' LIMIT 1) AS pk_column,
       (SELECT count(*) FROM information_schema.columns c2 WHERE c2.table_schema = 'public' AND c2.table_name = t.table_name) AS col_count
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

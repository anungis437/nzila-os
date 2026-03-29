-- Final verification: PK + column count + BaseModel for all key tables
-- Run on BOTH local and staging and compare
SELECT
  t.table_name,
  (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count,
  EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.column_name = 'id' AND c.table_schema = 'public') AS has_id,
  EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.column_name = 'created_at' AND c.table_schema = 'public') AS has_created,
  EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.column_name = 'updated_at' AND c.table_schema = 'public') AS has_updated
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
AND t.table_name IN (
  'claims', 'claim_updates', 'claim_deadlines', 'deadline_rules',
  'grievances', 'grievance_transitions', 'grievance_deadlines',
  'grievance_workflows', 'grievance_stages', 'grievance_assignments',
  'grievance_responses', 'arbitrations', 'arbitration_decisions',
  'organizations', 'organization_members',
  'activities', 'documents', 'notifications', 'calendars', 'calendar_events',
  'pension_plans', 'contributions', 'benefit_entitlements'
)
ORDER BY t.table_name;

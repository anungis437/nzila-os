-- seed-staging-external.sql  (External integration tables, QBO, MV refresh)
-- All external_* tables follow: id, created_at, updated_at, organization_id, external_id, external_provider, ...

-- ============================================================
-- EXTERNAL HR TABLES
-- ============================================================

INSERT INTO external_employees (id, created_at, updated_at, organization_id, external_id, external_provider, first_name, last_name, email, department, position_title) VALUES
  ('ex000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'EMP-001', 'workday', 'Marie', 'Dupont', 'marie.dupont@cape.org', 'Finance', 'Controller'),
  ('ex000001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'EMP-002', 'bamboohr', 'Jean', 'Martin', 'jean.martin@clc.org', 'Operations', 'Director')
ON CONFLICT DO NOTHING;

INSERT INTO external_departments (id, created_at, updated_at, organization_id, external_id, external_provider, name, code) VALUES
  ('ex000002-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'DEPT-FIN', 'workday', 'Finance', 'FIN'),
  ('ex000002-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'DEPT-OPS', 'bamboohr', 'Operations', 'OPS')
ON CONFLICT DO NOTHING;

INSERT INTO external_positions (id, created_at, updated_at, organization_id, external_id, external_provider, title, department) VALUES
  ('ex000003-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'POS-001', 'workday', 'Financial Controller', 'Finance'),
  ('ex000003-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'POS-002', 'bamboohr', 'Operations Director', 'Operations')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL FINANCIAL TABLES
-- ============================================================

INSERT INTO external_accounts (id, created_at, updated_at, organization_id, external_id, external_provider, account_name, account_type, current_balance) VALUES
  ('ex000004-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'ACC-1000', 'quickbooks', 'General Fund', 'Bank', 50000.00),
  ('ex000004-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'ACC-2000', 'xero', 'Operating Account', 'Bank', 35000.00)
ON CONFLICT DO NOTHING;

INSERT INTO external_customers (id, created_at, updated_at, organization_id, external_id, external_provider, name, email, balance) VALUES
  ('ex000005-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CUST-001', 'quickbooks', 'Local 123 Branch', 'local123@cape.org', 0.00),
  ('ex000005-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CUST-002', 'xero', 'Regional Office', 'regional@clc.org', 150.00)
ON CONFLICT DO NOTHING;

INSERT INTO external_invoices (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000006-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INV-EXT-001', 'quickbooks'),
  ('ex000006-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'INV-EXT-002', 'xero')
ON CONFLICT DO NOTHING;

INSERT INTO external_payments (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000007-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PAY-EXT-001', 'quickbooks'),
  ('ex000007-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PAY-EXT-002', 'xero')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL BENEFIT TABLES
-- ============================================================

INSERT INTO external_benefit_plans (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000008-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'BPL-001', 'sunlife'),
  ('ex000008-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'BPL-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_enrollments (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000009-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'BEN-001', 'sunlife'),
  ('ex000009-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'BEN-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_dependents (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00000a-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'DEP-001', 'sunlife'),
  ('ex00000a-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'DEP-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_coverage (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00000b-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'COV-001', 'sunlife'),
  ('ex00000b-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'COV-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_utilization (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00000c-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'UTL-001', 'sunlife'),
  ('ex00000c-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'UTL-002', 'manulife')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL INSURANCE TABLES
-- ============================================================

INSERT INTO external_insurance_policies (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00000d-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'POL-001', 'blue_cross'),
  ('ex00000d-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'POL-002', 'green_shield')
ON CONFLICT DO NOTHING;

INSERT INTO external_insurance_claims (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00000e-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CLM-001', 'blue_cross'),
  ('ex00000e-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CLM-002', 'green_shield')
ON CONFLICT DO NOTHING;

INSERT INTO external_insurance_beneficiaries (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00000f-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'BNF-001', 'blue_cross'),
  ('ex00000f-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'BNF-002', 'green_shield')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL PENSION TABLES
-- ============================================================

INSERT INTO external_pension_plans (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000010-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PEN-001', 'otpp'),
  ('ex000010-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PEN-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_members (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000011-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PMB-001', 'otpp'),
  ('ex000011-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PMB-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_contributions (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000012-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PCN-001', 'otpp'),
  ('ex000012-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PCN-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_estimates (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000013-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PES-001', 'otpp'),
  ('ex000013-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PES-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_beneficiaries (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000014-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PBN-001', 'otpp'),
  ('ex000014-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PBN-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_service_credits (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000015-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PSC-001', 'otpp'),
  ('ex000015-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PSC-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL CALENDAR TABLES
-- ============================================================

INSERT INTO external_calendars (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000016-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAL-001', 'sharepoint'),
  ('ex000016-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CAL-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_calendar_events (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000017-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CEV-001', 'sharepoint'),
  ('ex000017-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CEV-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_calendar_attendees (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000018-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'ATT-001', 'sharepoint'),
  ('ex000018-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'ATT-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_calendar_recurring_patterns (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000019-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'REC-001', 'sharepoint'),
  ('ex000019-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'REC-002', 'google_drive')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL COMMUNICATION TABLES
-- ============================================================

INSERT INTO external_communication_channels (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00001a-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CH-001', 'slack'),
  ('ex00001a-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CH-002', 'microsoft_teams')
ON CONFLICT DO NOTHING;

INSERT INTO external_communication_messages (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00001b-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'MSG-001', 'slack'),
  ('ex00001b-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'MSG-002', 'microsoft_teams')
ON CONFLICT DO NOTHING;

INSERT INTO external_communication_users (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00001c-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CU-001', 'slack'),
  ('ex00001c-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CU-002', 'microsoft_teams')
ON CONFLICT DO NOTHING;

INSERT INTO external_communication_files (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00001d-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CF-001', 'slack'),
  ('ex00001d-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CF-002', 'microsoft_teams')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL DOCUMENT TABLES
-- ============================================================

INSERT INTO external_document_sites (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00001e-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SITE-001', 'sharepoint'),
  ('ex00001e-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'SITE-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_document_libraries (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex00001f-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'LIB-001', 'sharepoint'),
  ('ex00001f-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'LIB-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_document_files (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000020-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'DOC-001', 'sharepoint'),
  ('ex000020-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'DOC-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_document_permissions (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000021-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PERM-001', 'sharepoint'),
  ('ex000021-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PERM-002', 'google_drive')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL LMS TABLES
-- ============================================================

INSERT INTO external_lms_courses (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000022-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CRS-001', 'linkedin_learning'),
  ('ex000022-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CRS-002', 'coursera')
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_learners (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000023-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'LRN-001', 'linkedin_learning'),
  ('ex000023-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'LRN-002', 'coursera')
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_enrollments (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000024-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'ENR-001', 'linkedin_learning'),
  ('ex000024-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'ENR-002', 'coursera')
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_progress (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000025-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PRG-001', 'linkedin_learning'),
  ('ex000025-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PRG-002', 'coursera')
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_completions (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000026-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CMP-001', 'linkedin_learning'),
  ('ex000026-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CMP-002', 'coursera')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL SYNC LOG
-- ============================================================

INSERT INTO external_data_sync_log (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('ex000027-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SYNC-001', 'workday'),
  ('ex000027-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'SYNC-002', 'bamboohr')
ON CONFLICT DO NOTHING;

-- ============================================================
-- QBO TABLES
-- ============================================================

INSERT INTO qbo_connections (id, entity_id, realm_id, connected_by) VALUES
  ('qb000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'realm_cape_001', 'admin'),
  ('qb000001-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'realm_clc_001', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO qbo_tokens (id, created_at, updated_at, organization_id) VALUES
  ('qb000002-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('qb000002-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO qbo_sync_runs (id, created_at, updated_at, organization_id) VALUES
  ('qb000003-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('qb000003-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO qbo_reports (id, created_at, updated_at, organization_id) VALUES
  ('qb000004-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('qb000004-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- REFRESH MATERIALIZED VIEWS (may fail if underlying data is insufficient)
-- ============================================================
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_claims_daily_summary;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_deadline_compliance_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_financial_summary_daily;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_trends;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_steward_performance;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_activity;

-- Done.

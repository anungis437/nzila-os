-- seed-staging-external-fix.sql  (Fixed UUIDs + correct column names)

-- ============================================================
-- EXTERNAL HR TABLES (organization_id, valid UUIDs)
-- ============================================================

INSERT INTO external_employees (id, created_at, updated_at, organization_id, external_id, external_provider, first_name, last_name, email, department, position_title) VALUES
  ('e0000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'EMP-001', 'workday', 'Marie', 'Dupont', 'marie.dupont@cape.org', 'Finance', 'Controller'),
  ('e0000001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'EMP-002', 'bamboohr', 'Jean', 'Martin', 'jean.martin@clc.org', 'Operations', 'Director')
ON CONFLICT DO NOTHING;

INSERT INTO external_departments (id, created_at, updated_at, organization_id, external_id, external_provider, name, code) VALUES
  ('e0000002-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'DEPT-FIN', 'workday', 'Finance', 'FIN'),
  ('e0000002-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'DEPT-OPS', 'bamboohr', 'Operations', 'OPS')
ON CONFLICT DO NOTHING;

INSERT INTO external_positions (id, created_at, updated_at, organization_id, external_id, external_provider, title, department) VALUES
  ('e0000003-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'POS-001', 'workday', 'Financial Controller', 'Finance'),
  ('e0000003-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'POS-002', 'bamboohr', 'Operations Director', 'Operations')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL FINANCIAL TABLES (organization_id)
-- ============================================================

INSERT INTO external_accounts (id, created_at, updated_at, organization_id, external_id, external_provider, account_name, account_type, current_balance) VALUES
  ('e0000004-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'ACC-1000', 'quickbooks', 'General Fund', 'Bank', 50000.00),
  ('e0000004-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'ACC-2000', 'xero', 'Operating Account', 'Bank', 35000.00)
ON CONFLICT DO NOTHING;

INSERT INTO external_customers (id, created_at, updated_at, organization_id, external_id, external_provider, name, email, balance) VALUES
  ('e0000005-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CUST-001', 'quickbooks', 'Local 123 Branch', 'local123@cape.org', 0.00),
  ('e0000005-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CUST-002', 'xero', 'Regional Office', 'regional@clc.org', 150.00)
ON CONFLICT DO NOTHING;

INSERT INTO external_invoices (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000006-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INV-EXT-001', 'quickbooks'),
  ('e0000006-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'INV-EXT-002', 'xero')
ON CONFLICT DO NOTHING;

INSERT INTO external_payments (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000007-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PAY-EXT-001', 'quickbooks'),
  ('e0000007-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PAY-EXT-002', 'xero')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL BENEFIT TABLES (organization_id)
-- ============================================================

INSERT INTO external_benefit_plans (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000008-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'BPL-001', 'sunlife'),
  ('e0000008-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'BPL-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_enrollments (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000009-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'BEN-001', 'sunlife'),
  ('e0000009-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'BEN-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_dependents (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e000000a-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'DEP-001', 'sunlife'),
  ('e000000a-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'DEP-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_coverage (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e000000b-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'COV-001', 'sunlife'),
  ('e000000b-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'COV-002', 'manulife')
ON CONFLICT DO NOTHING;

INSERT INTO external_benefit_utilization (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e000000c-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'UTL-001', 'sunlife'),
  ('e000000c-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'UTL-002', 'manulife')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL INSURANCE TABLES (organization_id)
-- ============================================================

INSERT INTO external_insurance_policies (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e000000d-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'POL-001', 'blue_cross'),
  ('e000000d-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'POL-002', 'green_shield')
ON CONFLICT DO NOTHING;

INSERT INTO external_insurance_claims (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e000000e-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CLM-001', 'blue_cross'),
  ('e000000e-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CLM-002', 'green_shield')
ON CONFLICT DO NOTHING;

INSERT INTO external_insurance_beneficiaries (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e000000f-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'BNF-001', 'blue_cross'),
  ('e000000f-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'BNF-002', 'green_shield')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL PENSION TABLES (organization_id)
-- ============================================================

INSERT INTO external_pension_plans (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000010-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PEN-001', 'otpp'),
  ('e0000010-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PEN-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_members (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000011-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PMB-001', 'otpp'),
  ('e0000011-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PMB-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_contributions (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000012-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PCN-001', 'otpp'),
  ('e0000012-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PCN-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_estimates (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000013-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PES-001', 'otpp'),
  ('e0000013-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PES-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_beneficiaries (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000014-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PBN-001', 'otpp'),
  ('e0000014-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PBN-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

INSERT INTO external_pension_service_credits (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000015-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PSC-001', 'otpp'),
  ('e0000015-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PSC-002', 'cpp_qpp')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL CALENDAR TABLES (organization_id)
-- ============================================================

INSERT INTO external_calendars (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000016-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAL-001', 'sharepoint'),
  ('e0000016-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CAL-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_calendar_events (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000017-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CEV-001', 'sharepoint'),
  ('e0000017-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CEV-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_calendar_attendees (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000018-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'ATT-001', 'sharepoint'),
  ('e0000018-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'ATT-002', 'google_drive')
ON CONFLICT DO NOTHING;

INSERT INTO external_calendar_recurring_patterns (id, created_at, updated_at, organization_id, external_id, external_provider) VALUES
  ('e0000019-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'REC-001', 'sharepoint'),
  ('e0000019-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'REC-002', 'google_drive')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL COMMUNICATION TABLES (org_id — NOT organization_id!)
-- ============================================================

INSERT INTO external_communication_channels (id, created_at, updated_at, org_id, external_id, external_provider, channel_name, channel_type) VALUES
  ('e000001a-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CH-001', 'slack', 'general', 'public_channel'),
  ('e000001a-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CH-002', 'microsoft_teams', 'announcements', 'public_channel')
ON CONFLICT DO NOTHING;

INSERT INTO external_communication_messages (id, created_at, updated_at, org_id, external_id, external_provider, message_text, message_type) VALUES
  ('e000001b-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'MSG-001', 'slack', 'Welcome to the general channel', 'message'),
  ('e000001b-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'MSG-002', 'microsoft_teams', 'Team announcement', 'message')
ON CONFLICT DO NOTHING;

INSERT INTO external_communication_users (id, created_at, updated_at, org_id, external_id, external_provider, username, display_name, email) VALUES
  ('e000001c-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CU-001', 'slack', 'mdupont', 'Marie Dupont', 'marie.dupont@cape.org'),
  ('e000001c-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CU-002', 'microsoft_teams', 'jmartin', 'Jean Martin', 'jean.martin@clc.org')
ON CONFLICT DO NOTHING;

INSERT INTO external_communication_files (id, created_at, updated_at, org_id, external_id, external_provider, file_name, file_type, mime_type) VALUES
  ('e000001d-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CF-001', 'slack', 'report.pdf', 'pdf', 'application/pdf'),
  ('e000001d-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CF-002', 'microsoft_teams', 'minutes.docx', 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL DOCUMENT TABLES (org_id — NOT organization_id!)
-- ============================================================

INSERT INTO external_document_sites (id, created_at, updated_at, org_id, external_id, external_provider, site_name, site_url) VALUES
  ('e000001e-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SITE-001', 'sharepoint', 'CAPE Hub', 'https://cape.sharepoint.com'),
  ('e000001e-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'SITE-002', 'google_drive', 'CLC Drive', 'https://drive.google.com/clc')
ON CONFLICT DO NOTHING;

INSERT INTO external_document_libraries (id, created_at, updated_at, org_id, external_id, external_provider, library_name, library_url) VALUES
  ('e000001f-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'LIB-001', 'sharepoint', 'Shared Documents', 'https://cape.sharepoint.com/shared'),
  ('e000001f-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'LIB-002', 'google_drive', 'Team Files', 'https://drive.google.com/clc/team')
ON CONFLICT DO NOTHING;

INSERT INTO external_document_files (id, created_at, updated_at, org_id, external_id, external_provider, file_name, mime_type) VALUES
  ('e0000020-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'DOC-001', 'sharepoint', 'Budget 2025.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  ('e0000020-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'DOC-002', 'google_drive', 'Minutes Q1.pdf', 'application/pdf')
ON CONFLICT DO NOTHING;

INSERT INTO external_document_permissions (id, created_at, updated_at, org_id, external_id, external_provider, permission_type) VALUES
  ('e0000021-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PERM-001', 'sharepoint', 'read'),
  ('e0000021-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PERM-002', 'google_drive', 'write')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL LMS TABLES (org_id — NOT organization_id!)
-- ============================================================

INSERT INTO external_lms_courses (id, created_at, updated_at, org_id, external_id, external_provider, course_name) VALUES
  ('e0000022-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CRS-001', 'linkedin_learning', 'Labor Relations Fundamentals'),
  ('e0000022-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CRS-002', 'coursera', 'Collective Bargaining')
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_learners (id, created_at, updated_at, org_id, external_id, external_provider, first_name, last_name, email) VALUES
  ('e0000023-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'LRN-001', 'linkedin_learning', 'Marie', 'Dupont', 'marie.dupont@cape.org'),
  ('e0000023-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'LRN-002', 'coursera', 'Jean', 'Martin', 'jean.martin@clc.org')
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_enrollments (id, created_at, updated_at, org_id, external_id, external_provider, status) VALUES
  ('e0000024-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'ENR-001', 'linkedin_learning', 'active'),
  ('e0000024-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'ENR-002', 'coursera', 'completed')
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_progress (id, created_at, updated_at, org_id, external_id, external_provider, progress_percentage) VALUES
  ('e0000025-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PRG-001', 'linkedin_learning', 75),
  ('e0000025-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PRG-002', 'coursera', 100)
ON CONFLICT DO NOTHING;

INSERT INTO external_lms_completions (id, created_at, updated_at, org_id, external_id, external_provider, completed_at) VALUES
  ('e0000026-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CMP-001', 'linkedin_learning', now() - interval '30 days'),
  ('e0000026-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CMP-002', 'coursera', now() - interval '15 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EXTERNAL SYNC LOG (no org column — uses source/status)
-- ============================================================

INSERT INTO external_data_sync_log (id, created_at, updated_at, source, status, started_at) VALUES
  ('e0000027-0001-4000-8000-000000000001', now(), now(), 'workday', 'completed', now() - interval '1 hour'),
  ('e0000027-0001-4000-8000-000000000002', now(), now(), 'bamboohr', 'completed', now() - interval '2 hours')
ON CONFLICT DO NOTHING;

-- ============================================================
-- QBO TABLES (correct columns, valid UUIDs via gen_random_uuid())
-- ============================================================

-- qbo_connections: entity_id, realm_id, connected_by (id/created_at/updated_at have defaults)
INSERT INTO qbo_connections (entity_id, realm_id, company_name, connected_by) VALUES
  ('885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'realm_cape_001', 'CAPE QBO', 'admin'),
  ('5ecb17ab-b5de-442e-a46f-93778ee496aa', 'realm_clc_001', 'CLC QBO', 'admin')
ON CONFLICT DO NOTHING;

-- qbo_tokens: connection_id FK → qbo_connections
INSERT INTO qbo_tokens (connection_id, access_token, refresh_token, access_token_expires_at, refresh_token_expires_at) VALUES
  ((SELECT id FROM qbo_connections WHERE realm_id = 'realm_cape_001' LIMIT 1), 'access_token_cape_placeholder', 'refresh_token_cape_placeholder', now() + interval '1 hour', now() + interval '100 days'),
  ((SELECT id FROM qbo_connections WHERE realm_id = 'realm_clc_001' LIMIT 1), 'access_token_clc_placeholder', 'refresh_token_clc_placeholder', now() + interval '1 hour', now() + interval '100 days')
ON CONFLICT DO NOTHING;

-- qbo_sync_runs: entity_id, connection_id FK, report_type enum, no updated_at
INSERT INTO qbo_sync_runs (entity_id, connection_id, report_type, period_start, period_end) VALUES
  ('885aa4e0-5dc1-45bf-ad32-86477868e8ea', (SELECT id FROM qbo_connections WHERE realm_id = 'realm_cape_001' LIMIT 1), 'trial_balance', '2025-01-01', '2025-03-31'),
  ('5ecb17ab-b5de-442e-a46f-93778ee496aa', (SELECT id FROM qbo_connections WHERE realm_id = 'realm_clc_001' LIMIT 1), 'profit_and_loss', '2025-01-01', '2025-03-31')
ON CONFLICT DO NOTHING;

-- qbo_reports: entity_id, sync_run_id FK, report_type enum, document_id FK, sha256, no updated_at
INSERT INTO qbo_reports (entity_id, sync_run_id, report_type, period_start, period_end, document_id, sha256) VALUES
  ('885aa4e0-5dc1-45bf-ad32-86477868e8ea', (SELECT id FROM qbo_sync_runs WHERE entity_id = '885aa4e0-5dc1-45bf-ad32-86477868e8ea' LIMIT 1), 'trial_balance', '2025-01-01', '2025-03-31', 'd2100001-0001-4000-8000-000000000001', 'abc123def456'),
  ('5ecb17ab-b5de-442e-a46f-93778ee496aa', (SELECT id FROM qbo_sync_runs WHERE entity_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa' LIMIT 1), 'profit_and_loss', '2025-01-01', '2025-03-31', 'd2100001-0001-4000-8000-000000000002', 'fed654cba321')
ON CONFLICT DO NOTHING;

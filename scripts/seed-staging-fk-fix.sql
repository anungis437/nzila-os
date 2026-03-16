-- Targeted seed for 89 tables that failed FK/varchar constraints in auto-seeder
-- Uses real parent IDs from already-populated tables
-- Organized by dependency order: parents first, then children

SET CONSTRAINTS ALL IMMEDIATE;
BEGIN;

-- ============================================================
-- LEVEL 0: Parent tables that need seeding first
-- ============================================================

-- close_periods (period_label varchar(20), period_type varchar(10))
INSERT INTO close_periods (id, entity_id, period_label, period_type, start_date, end_date, opened_by)
VALUES
  ('cc000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2024-Q1', 'quarterly', '2024-01-01', '2024-03-31', 'user_cape_01'),
  ('cc000001-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '2024-Q2', 'quarterly', '2024-04-01', '2024-06-30', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- tax_years (fiscal_year_label varchar(10))
INSERT INTO tax_years (id, entity_id, fiscal_year_label, start_date, end_date, federal_filing_deadline, federal_payment_deadline)
VALUES
  ('cc000002-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'FY2024', '2024-01-01', '2024-12-31', '2025-06-30', '2025-03-31'),
  ('cc000002-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'FY2023', '2023-01-01', '2023-12-31', '2024-06-30', '2024-03-31')
ON CONFLICT DO NOTHING;

-- commerce_orders (customer_id → commerce_customers, currency varchar(3))
INSERT INTO commerce_orders (id, entity_id, customer_id, ref, status, currency, subtotal, tax_total, total, created_by)
VALUES
  ('cc000003-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5360b048-9a28-4edf-827f-1e7d59bba958', 'ORD-CAPE-001', 'confirmed', 'CAD', 500.00, 65.00, 565.00, 'user_cape_01'),
  ('cc000003-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'd5fc028a-419c-4772-9901-0a698a3c4bbd', 'ORD-CLC-001', 'completed', 'CAD', 750.00, 97.50, 847.50, 'user_clc_01')
ON CONFLICT DO NOTHING;

-- nacp_exams (subject_id → nacp_subjects)
INSERT INTO nacp_exams (id, entity_id, title, code, subject_id, level, year, duration_minutes, total_marks, pass_percentage)
VALUES
  ('cc000004-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Mathematics Final', 'MATH-2024', 'be331d6b-cc58-41e7-8405-f579dcff9b76', 'primary', 2024, 120, 100, 50.00),
  ('cc000004-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'English Composition', 'ENG-2024', 'c44b239f-ef91-4206-8dae-a849f4b7f230', 'secondary', 2024, 90, 80, 60.00)
ON CONFLICT DO NOTHING;

-- deals (partner_id → partners)
INSERT INTO deals (id, partner_id, account_name, contact_name, contact_email, vertical, estimated_arr)
VALUES
  ('cc000005-0001-4000-8000-000000000001', '39dbdd6f-95a2-4096-9e59-dfab5ce99550', 'CAPE Union Deal', 'Jane Smith', 'jane@cape-union.ca', 'public-sector', 25000.00),
  ('cc000005-0001-4000-8000-000000000002', '64af44a3-da48-43e2-bf02-c1ba965fe383', 'CLC Congress Deal', 'Bob Jones', 'bob@clc-congress.ca', 'private-sector', 35000.00)
ON CONFLICT DO NOTHING;

-- shareholders (holder_person_id → people)
INSERT INTO shareholders (id, org_id, holder_person_id, holder_type)
VALUES
  ('cc000006-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'a0000001-0001-4000-8000-000000000001', 'individual'),
  ('cc000006-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'a0000001-0001-4000-8000-000000000004', 'individual')
ON CONFLICT DO NOTHING;

-- evidence_packs (blob_container varchar(30), pack_id varchar(120))
INSERT INTO evidence_packs (id, pack_id, entity_id, control_family, event_type, event_id, run_id, blob_container, base_path, controls_covered, artifact_count, all_hashes_verified, chain_integrity, status, created_by)
VALUES
  ('cc000007-0001-4000-8000-000000000001', 'PACK-CAPE-2024-001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'access', 'incident', 'EVT-001', 'cc000007-0001-4000-8000-000000000001', 'evidence', '/cape/2024/pack-001', '["AC-1","AC-2"]', 3, true, 'VERIFIED', 'sealed', 'user_cape_01'),
  ('cc000007-0001-4000-8000-000000000002', 'PACK-CLC-2024-001', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'change-mgmt', 'access-review', 'EVT-002', 'cc000007-0001-4000-8000-000000000002', 'evidence', '/clc/2024/pack-001', '["CM-1"]', 2, true, 'VERIFIED', 'draft', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- nacp_exam_sessions (exam_id → nacp_exams, center_id → nacp_centers)
INSERT INTO nacp_exam_sessions (id, entity_id, exam_id, center_id, ref, scheduled_at)
VALUES
  ('cc000008-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000004-0001-4000-8000-000000000001', 'b217ef5a-b664-4846-8914-1d438e40e814', 'SESS-CAPE-001', now()),
  ('cc000008-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000004-0001-4000-8000-000000000002', '7d930446-a7bb-4ca6-be75-d3882555e9e8', 'SESS-CLC-001', now())
ON CONFLICT DO NOTHING;

-- nacp_candidates (center_id → nacp_centers)
INSERT INTO nacp_candidates (id, entity_id, ref, first_name, last_name, date_of_birth, gender, center_id)
VALUES
  ('cc000009-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAND-001', 'Alice', 'Martin', '1998-05-15', 'female', 'b217ef5a-b664-4846-8914-1d438e40e814'),
  ('cc000009-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CAND-002', 'David', 'Chen', '1997-08-22', 'male', '7d930446-a7bb-4ca6-be75-d3882555e9e8')
ON CONFLICT DO NOTHING;

-- commerce_quotes (customer_id → commerce_customers)
INSERT INTO commerce_quotes (id, entity_id, customer_id, ref, created_by)
VALUES
  ('cc00000a-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5360b048-9a28-4edf-827f-1e7d59bba958', 'QUO-CAPE-001', 'user_cape_01'),
  ('cc00000a-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'd5fc028a-419c-4772-9901-0a698a3c4bbd', 'QUO-CLC-001', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- board_packet_sections (packet_id → board_packets)
INSERT INTO board_packet_sections (id, packet_id, title, position)
VALUES
  ('cc00000b-0001-4000-8000-000000000001', '092ef7ad-e211-4778-8086-0d81b56bbc3e', 'Financial Report', 1),
  ('cc00000b-0001-4000-8000-000000000002', '88c69699-c85c-46ba-b93d-8bb2fccc222f', 'Minutes Approval', 1)
ON CONFLICT DO NOTHING;

-- commerce_invoices (order_id → commerce_orders, customer_id → commerce_customers)
INSERT INTO commerce_invoices (id, entity_id, order_id, customer_id, ref, status, currency, subtotal, tax_total, total, amount_paid, amount_due, created_by)
VALUES
  ('cc00000c-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000003-0001-4000-8000-000000000001', '5360b048-9a28-4edf-827f-1e7d59bba958', 'INV-CAPE-001', 'confirmed', 'CAD', 500.00, 65.00, 565.00, 0.00, 565.00, 'user_cape_01'),
  ('cc00000c-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000003-0001-4000-8000-000000000002', 'd5fc028a-419c-4772-9901-0a698a3c4bbd', 'INV-CLC-001', 'completed', 'CAD', 750.00, 97.50, 847.50, 847.50, 0.00, 'user_clc_01')
ON CONFLICT DO NOTHING;

-- zonga_releases (creator_id → zonga_creators)
INSERT INTO zonga_releases (id, entity_id, creator_id, title)
VALUES
  ('cc00000d-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '7dc6f6a3-f2f8-44a8-8b6a-1faf693d2e12', 'Summer Collection'),
  ('cc00000d-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'fa318d03-3219-4b6c-9657-67e7ed949ef5', 'Winter Mix')
ON CONFLICT DO NOTHING;

-- indirect_tax_periods (account_id → indirect_tax_accounts)
INSERT INTO indirect_tax_periods (id, entity_id, account_id, tax_type, start_date, end_date, filing_due, payment_due)
VALUES
  ('cc00000e-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'a45f0076-0ef9-4f04-b883-147659734d54', 'GST', '2024-01-01', '2024-03-31', '2024-04-30', '2024-04-30'),
  ('cc00000e-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '2cfecc18-bc0f-4afc-a2bc-3c4f11bcff80', 'HST', '2024-01-01', '2024-03-31', '2024-04-30', '2024-04-30')
ON CONFLICT DO NOTHING;

-- ============================================================
-- LEVEL 1: Direct children of existing or level-0 parents
-- ============================================================

-- api_credentials (partner_id → partners, key_prefix varchar(12))
INSERT INTO api_credentials (id, partner_id, env, key_prefix, key_hash)
VALUES
  ('cc100001-0001-4000-8000-000000000001', '39dbdd6f-95a2-4096-9e59-dfab5ce99550', 'sandbox', 'pk_cape_01', 'e3b0c44298fc1c149afbf4c8996fb924'),
  ('cc100001-0001-4000-8000-000000000002', '64af44a3-da48-43e2-bf02-c1ba965fe383', 'production', 'pk_clc_01', 'a3b0c44298fc1c149afbf4c8996fb924')
ON CONFLICT DO NOTHING;

-- certifications (partner_id → partners)
INSERT INTO certifications (id, partner_id, clerk_user_id, track_id)
VALUES
  ('cc100002-0001-4000-8000-000000000001', '39dbdd6f-95a2-4096-9e59-dfab5ce99550', 'user_cape_01', 'track_cape_01'),
  ('cc100002-0001-4000-8000-000000000002', '64af44a3-da48-43e2-bf02-c1ba965fe383', 'user_clc_01', 'track_clc_01')
ON CONFLICT DO NOTHING;

-- gtm_requests (partner_id → partners)
INSERT INTO gtm_requests (id, partner_id, type, subject)
VALUES
  ('cc100003-0001-4000-8000-000000000001', '39dbdd6f-95a2-4096-9e59-dfab5ce99550', 'general', 'CAPE Market Expansion'),
  ('cc100003-0001-4000-8000-000000000002', '64af44a3-da48-43e2-bf02-c1ba965fe383', 'general', 'CLC Partner Onboarding')
ON CONFLICT DO NOTHING;

-- partner_entities (partner_id → partners)
INSERT INTO partner_entities (id, partner_id, entity_id)
VALUES
  ('cc100004-0001-4000-8000-000000000001', '39dbdd6f-95a2-4096-9e59-dfab5ce99550', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cc100004-0001-4000-8000-000000000002', '64af44a3-da48-43e2-bf02-c1ba965fe383', '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- partner_users (partner_id → partners)
INSERT INTO partner_users (id, partner_id, clerk_user_id, role)
VALUES
  ('cc100005-0001-4000-8000-000000000001', '39dbdd6f-95a2-4096-9e59-dfab5ce99550', 'user_cape_01', 'channel:admin'),
  ('cc100005-0001-4000-8000-000000000002', '64af44a3-da48-43e2-bf02-c1ba965fe383', 'user_clc_01', 'channel:admin')
ON CONFLICT DO NOTHING;

-- commissions (deal_id → deals, partner_id → partners)
INSERT INTO commissions (id, deal_id, partner_id, amount)
VALUES
  ('cc100006-0001-4000-8000-000000000001', 'cc000005-0001-4000-8000-000000000001', '39dbdd6f-95a2-4096-9e59-dfab5ce99550', 2500.00),
  ('cc100006-0001-4000-8000-000000000002', 'cc000005-0001-4000-8000-000000000002', '64af44a3-da48-43e2-bf02-c1ba965fe383', 3500.00)
ON CONFLICT DO NOTHING;

-- automation_events (command_id → automation_commands)
INSERT INTO automation_events (id, command_id, correlation_id, event, actor, hash)
VALUES
  ('cc100007-0001-4000-8000-000000000001', 'df9ab83b-136a-4178-82fb-ceaf5d896adf', 'cc100007-0001-4000-8000-000000000001', 'command.executed', 'system', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
  ('cc100007-0001-4000-8000-000000000002', 'a778ff38-841e-4d1d-b4d4-609d58adb309', 'cc100007-0001-4000-8000-000000000002', 'command.completed', 'system', 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
ON CONFLICT DO NOTHING;

-- entity_roles (entity_id = org, person_id → people)
INSERT INTO entity_roles (id, entity_id, person_id, role, start_date)
VALUES
  ('cc100008-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'a0000001-0001-4000-8000-000000000001', 'director', '2024-01-01'),
  ('cc100008-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'a0000001-0001-4000-8000-000000000004', 'treasurer', '2024-01-01')
ON CONFLICT DO NOTHING;

-- org_members (org_id → orgs)
INSERT INTO org_members (id, org_id, clerk_user_id, role)
VALUES
  ('cc100009-0001-4000-8000-000000000001', 'e350bef1-4b17-42e6-ae61-c4c7ee446ff8', 'user_cape_01', 'org_admin'),
  ('cc100009-0001-4000-8000-000000000002', 'b80155c2-20c4-44ab-9d61-3d3c3060b887', 'user_clc_01', 'org_admin')
ON CONFLICT DO NOTHING;

-- org_roles (org_id → orgs, person_id → people)
INSERT INTO org_roles (id, org_id, person_id, role, start_date)
VALUES
  ('cc10000a-0001-4000-8000-000000000001', 'e350bef1-4b17-42e6-ae61-c4c7ee446ff8', 'a0000001-0001-4000-8000-000000000002', 'director', '2024-01-01'),
  ('cc10000a-0001-4000-8000-000000000002', 'b80155c2-20c4-44ab-9d61-3d3c3060b887', 'a0000001-0001-4000-8000-000000000005', 'secretary', '2024-01-01')
ON CONFLICT DO NOTHING;

-- claim_updates (claim_id → claims PK=claim_id)
INSERT INTO claim_updates (claim_id, update_type, message, created_by)
VALUES
  ('b7133e06-6709-4bdd-9eb4-3e5183845629', 'general', 'Initial review completed', 'user_cape_01'),
  ('e8106a4f-67e1-4d93-a9f5-c2fdd4381e71', 'general', 'Documents received', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- grievance_transitions (claim_id → claims)
INSERT INTO grievance_transitions (id, organization_id, claim_id, to_stage_id, trigger_type, transitioned_by)
VALUES
  ('cc10000b-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b7133e06-6709-4bdd-9eb4-3e5183845629', 'cc10000b-0001-4000-8000-000000000001', 'manual', 'user_cape_01'),
  ('cc10000b-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'e8106a4f-67e1-4d93-a9f5-c2fdd4381e71', 'cc10000b-0001-4000-8000-000000000002', 'manual', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- journal_entry_lines (journal_entry_id → journal_entries)
INSERT INTO journal_entry_lines (id, journal_entry_id, account_code, description, debit, credit)
VALUES
  ('cc10000c-0001-4000-8000-000000000001', 'a497e932-2c39-469c-b23f-b193eb1b2321', '1000', 'Cash debit', 1000.00, 0.00),
  ('cc10000c-0001-4000-8000-000000000002', 'dcccbfbe-9609-4761-876d-c337dd24960e', '2000', 'Revenue credit', 0.00, 1500.00)
ON CONFLICT DO NOTHING;

-- message_notifications (message_id → messages)
INSERT INTO message_notifications (id, message_id, user_id, channel)
VALUES
  ('cc10000d-0001-4000-8000-000000000001', '5e733b6e-3502-4a21-a5ff-40680efbbd57', 'user_cape_01', 'email'),
  ('cc10000d-0001-4000-8000-000000000002', 'b7d240bf-5e08-474c-9a03-fe8e69ddd226', 'user_clc_01', 'push')
ON CONFLICT DO NOTHING;

-- message_participants (message_id → messages)
INSERT INTO message_participants (id, message_id, user_id, role)
VALUES
  ('cc10000e-0001-4000-8000-000000000001', '5e733b6e-3502-4a21-a5ff-40680efbbd57', 'user_cape_01', 'sender'),
  ('cc10000e-0001-4000-8000-000000000002', 'b7d240bf-5e08-474c-9a03-fe8e69ddd226', 'user_clc_01', 'recipient')
ON CONFLICT DO NOTHING;

-- message_read_receipts (message_id → messages)
INSERT INTO message_read_receipts (id, message_id, user_id, read_at)
VALUES
  ('cc10000f-0001-4000-8000-000000000001', '5e733b6e-3502-4a21-a5ff-40680efbbd57', 'user_cape_01', now()),
  ('cc10000f-0001-4000-8000-000000000002', 'b7d240bf-5e08-474c-9a03-fe8e69ddd226', 'user_clc_01', now())
ON CONFLICT DO NOTHING;

-- share_ledger_entries (class_id → share_classes)
INSERT INTO share_ledger_entries (id, org_id, entry_type, class_id, quantity, effective_date, hash)
VALUES
  ('cc100010-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'issuance', '8ee64251-cee4-4413-b7c2-f75ebf579407', 100, '2024-01-15', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
  ('cc100010-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'issuance', '460952bd-cf8e-4173-bc04-456eb974d628', 200, '2024-02-01', 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
ON CONFLICT DO NOTHING;

-- share_certificates (shareholder_id → shareholders, class_id → share_classes)
INSERT INTO share_certificates (id, entity_id, shareholder_id, class_id, certificate_number, issued_date, quantity)
VALUES
  ('cc100011-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000006-0001-4000-8000-000000000001', '8ee64251-cee4-4413-b7c2-f75ebf579407', 'CERT-CAPE-001', '2024-01-15', 100),
  ('cc100011-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000006-0001-4000-8000-000000000002', '460952bd-cf8e-4173-bc04-456eb974d628', 'CERT-CLC-001', '2024-02-01', 200)
ON CONFLICT DO NOTHING;

-- voting_audit_log (session_id → voting_sessions)
INSERT INTO voting_audit_log (id, organization_id, session_id, action, actor_id, details)
VALUES
  ('cc100012-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '69000001-0001-4000-8000-000000000001', 'vote_cast', 'user_cape_01', '{"method":"electronic"}'),
  ('cc100012-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '69000001-0001-4000-8000-000000000003', 'session_opened', 'user_clc_01', '{"method":"in-person"}')
ON CONFLICT DO NOTHING;

-- voting_notifications (session_id → voting_sessions)
INSERT INTO voting_notifications (id, organization_id, session_id, type, recipient_id)
VALUES
  ('cc100013-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '69000001-0001-4000-8000-000000000001', 'reminder', 'user_cape_01'),
  ('cc100013-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '69000001-0001-4000-8000-000000000003', 'result', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- event_reminders (event_id → calendar_events)
INSERT INTO event_reminders (id, event_id, remind_at, method)
VALUES
  ('cc100014-0001-4000-8000-000000000001', 'ca810001-0001-4000-8000-000000000001', now() + interval '1 day', 'email'),
  ('cc100014-0001-4000-8000-000000000002', 'ca810001-0001-4000-8000-000000000002', now() + interval '2 days', 'push')
ON CONFLICT DO NOTHING;

-- calendar_sharing (calendar_id or event_id → calendar_events)
INSERT INTO calendar_sharing (id, calendar_id, shared_with, permission)
VALUES
  ('cc100015-0001-4000-8000-000000000001', 'ca810001-0001-4000-8000-000000000001', 'user_cape_01', 'read'),
  ('cc100015-0001-4000-8000-000000000002', 'ca810001-0001-4000-8000-000000000002', 'user_clc_01', 'write')
ON CONFLICT DO NOTHING;

-- integration_sync_logs (connection_id → integration_connections)
INSERT INTO integration_sync_logs (id, connection_id, direction, record_count, status)
VALUES
  ('cc100016-0001-4000-8000-000000000001', '7f6bb2d2-0ba1-4712-ba00-141855dde355', 'inbound', 50, 'completed'),
  ('cc100016-0001-4000-8000-000000000002', '728688de-121d-4abc-a3b6-46089ce94df7', 'outbound', 30, 'completed')
ON CONFLICT DO NOTHING;

-- dsr_activity_log (request_id → dsr_requests)
INSERT INTO dsr_activity_log (id, request_id, action, performed_by)
VALUES
  ('cc100017-0001-4000-8000-000000000001', 'e83d370d-b23a-4486-8b3c-1c39d4fa0818', 'acknowledged', 'user_cape_01'),
  ('cc100017-0001-4000-8000-000000000002', 'cc7c04d8-16ee-42a6-b607-8cf441be29fe', 'completed', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- bank_transactions (account_id → bank_accounts)
INSERT INTO bank_transactions (id, entity_id, account_id, date, description, amount, balance)
VALUES
  ('cc100018-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '1aa06337-fe09-44b8-a4b8-4759e82b5deb', '2024-03-15', 'Dues deposit', 5000.00, 25000.00),
  ('cc100018-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '733b8dd8-9834-412b-aeeb-39b743fe588f', '2024-03-15', 'Operating expense', -1200.00, 18000.00)
ON CONFLICT DO NOTHING;

-- policy_evaluations (rule_id → policy_rules)
INSERT INTO policy_evaluations (id, rule_id, entity_id, result, evidence)
VALUES
  ('cc100019-0001-4000-8000-000000000001', '9b29218f-2a69-40ec-a653-638df8b5eb01', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'pass', '{"check":"encryption"}'),
  ('cc100019-0001-4000-8000-000000000002', '4598ee35-256e-4db9-9ac7-5186eac236f1', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'fail', '{"check":"mfa"}')
ON CONFLICT DO NOTHING;

-- policy_exceptions (rule_id → policy_rules)
INSERT INTO policy_exceptions (id, rule_id, entity_id, reason, approved_by)
VALUES
  ('cc10001a-0001-4000-8000-000000000001', '9b29218f-2a69-40ec-a653-638df8b5eb01', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Legacy system migration', 'user_cape_01'),
  ('cc10001a-0001-4000-8000-000000000002', '4598ee35-256e-4db9-9ac7-5186eac236f1', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'Vendor limitation', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- commerce_sync_receipts (sync_job_id → commerce_sync_jobs)
INSERT INTO commerce_sync_receipts (id, entity_id, sync_job_id, provider)
VALUES
  ('cc10001b-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '48c5bab8-ec32-419e-aa18-e7bdefbef846', 'stripe'),
  ('cc10001b-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '4e4dcd6c-02aa-40e2-adc1-1568adcb778d', 'quickbooks')
ON CONFLICT DO NOTHING;

-- cba_footnotes (source_clause_id → cba_clauses)
INSERT INTO cba_footnotes (id, source_clause_id, footnote_number, footnote_text, link_type, created_by)
VALUES
  ('cc10001c-0001-4000-8000-000000000001', '5b449d0d-5b4f-47f6-8e5a-a452436c303c', 1, 'Reference to Article 5 provisions', 'general', 'user_cape_01'),
  ('cc10001c-0001-4000-8000-000000000002', '5f978e76-bff1-404a-96c6-f6b5a2d2d61d', 2, 'See supplementary agreement', 'general', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- clause_embeddings (clause_id → cba_clauses)
INSERT INTO clause_embeddings (id, clause_id, embedding_vector)
VALUES
  ('cc10001d-0001-4000-8000-000000000001', '5b449d0d-5b4f-47f6-8e5a-a452436c303c', '[0.1,0.2,0.3,0.4,0.5]'),
  ('cc10001d-0001-4000-8000-000000000002', '5f978e76-bff1-404a-96c6-f6b5a2d2d61d', '[0.6,0.7,0.8,0.9,1.0]')
ON CONFLICT DO NOTHING;

-- clause_library_tags (clause_id → cba_clauses)
INSERT INTO clause_library_tags (id, clause_id, tag_name, created_by)
VALUES
  ('cc10001e-0001-4000-8000-000000000001', '5b449d0d-5b4f-47f6-8e5a-a452436c303c', 'wages', 'user_cape_01'),
  ('cc10001e-0001-4000-8000-000000000002', '5f978e76-bff1-404a-96c6-f6b5a2d2d61d', 'benefits', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- zonga_content_assets (creator_id → zonga_creators)
INSERT INTO zonga_content_assets (id, entity_id, creator_id, title, type)
VALUES
  ('cc10001f-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '7dc6f6a3-f2f8-44a8-8b6a-1faf693d2e12', 'Summer Beat', 'track'),
  ('cc10001f-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'fa318d03-3219-4b6c-9657-67e7ed949ef5', 'Winter Chill', 'track')
ON CONFLICT DO NOTHING;

-- zonga_payouts (creator_id → zonga_creators)
INSERT INTO zonga_payouts (id, entity_id, creator_id, amount, period_start, period_end)
VALUES
  ('cc100020-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '7dc6f6a3-f2f8-44a8-8b6a-1faf693d2e12', 500.00, '2024-01-01', '2024-03-31'),
  ('cc100020-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'fa318d03-3219-4b6c-9657-67e7ed949ef5', 750.00, '2024-01-01', '2024-03-31')
ON CONFLICT DO NOTHING;

-- zonga_revenue_events (creator_id → zonga_creators)
INSERT INTO zonga_revenue_events (id, entity_id, creator_id, type, amount)
VALUES
  ('cc100021-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '7dc6f6a3-f2f8-44a8-8b6a-1faf693d2e12', 'stream', 25.00),
  ('cc100021-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'fa318d03-3219-4b6c-9657-67e7ed949ef5', 'download', 10.00)
ON CONFLICT DO NOTHING;

-- zonga_wallet_ledger (creator_id → zonga_creators)
INSERT INTO zonga_wallet_ledger (id, entity_id, creator_id, entry_type, amount, balance_after)
VALUES
  ('cc100022-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '7dc6f6a3-f2f8-44a8-8b6a-1faf693d2e12', 'credit', 500.00, 500.00),
  ('cc100022-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'fa318d03-3219-4b6c-9657-67e7ed949ef5', 'credit', 750.00, 750.00)
ON CONFLICT DO NOTHING;

-- zonga_royalty_splits (release_id → zonga_releases, creator_id → zonga_creators)
INSERT INTO zonga_royalty_splits (id, entity_id, release_id, creator_id, share_percent)
VALUES
  ('cc100023-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000d-0001-4000-8000-000000000001', '7dc6f6a3-f2f8-44a8-8b6a-1faf693d2e12', 100.00),
  ('cc100023-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000d-0001-4000-8000-000000000002', 'fa318d03-3219-4b6c-9657-67e7ed949ef5', 100.00)
ON CONFLICT DO NOTHING;

-- close_approvals (period_id → close_periods)
INSERT INTO close_approvals (id, entity_id, period_id, approver_clerk_user_id, approver_role)
VALUES
  ('cc100024-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000001-0001-4000-8000-000000000001', 'user_cape_01', 'admin'),
  ('cc100024-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000001-0001-4000-8000-000000000002', 'user_clc_01', 'admin')
ON CONFLICT DO NOTHING;

-- close_exceptions (period_id → close_periods)
INSERT INTO close_exceptions (id, entity_id, period_id, title, raised_by)
VALUES
  ('cc100025-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000001-0001-4000-8000-000000000001', 'Missing bank reconciliation', 'user_cape_01'),
  ('cc100025-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000001-0001-4000-8000-000000000002', 'Pending vendor invoice', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- close_tasks (period_id → close_periods)
INSERT INTO close_tasks (id, entity_id, period_id, task_name)
VALUES
  ('cc100026-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000001-0001-4000-8000-000000000001', 'Bank reconciliation'),
  ('cc100026-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000001-0001-4000-8000-000000000002', 'Payroll posting')
ON CONFLICT DO NOTHING;

-- tax_filings (tax_year_id → tax_years)
INSERT INTO tax_filings (id, entity_id, tax_year_id, filing_type, prepared_by)
VALUES
  ('cc100027-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000002-0001-4000-8000-000000000001', 'T2', 'user_cape_01'),
  ('cc100027-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000002-0001-4000-8000-000000000002', 'T2', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- tax_installments (tax_year_id → tax_years)
INSERT INTO tax_installments (id, entity_id, tax_year_id, due_date, required_amount)
VALUES
  ('cc100028-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000002-0001-4000-8000-000000000001', '2024-03-15', 5000.00),
  ('cc100028-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000002-0001-4000-8000-000000000002', '2023-03-15', 3500.00)
ON CONFLICT DO NOTHING;

-- tax_notices (tax_year_id → tax_years)
INSERT INTO tax_notices (id, entity_id, tax_year_id, authority, notice_type, received_date)
VALUES
  ('cc100029-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000002-0001-4000-8000-000000000001', 'CRA', 'NOA', '2025-04-15'),
  ('cc100029-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000002-0001-4000-8000-000000000002', 'CRA', 'T2S1', '2024-05-01')
ON CONFLICT DO NOTHING;

-- commerce_order_lines (order_id → commerce_orders)
INSERT INTO commerce_order_lines (id, entity_id, order_id, description, quantity, unit_price, line_total)
VALUES
  ('cc10002a-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000003-0001-4000-8000-000000000001', 'Union dues management license', 1, 500.00, 500.00),
  ('cc10002a-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000003-0001-4000-8000-000000000002', 'Grievance module add-on', 1, 750.00, 750.00)
ON CONFLICT DO NOTHING;

-- commerce_invoice_lines (invoice_id → commerce_invoices)
INSERT INTO commerce_invoice_lines (id, entity_id, invoice_id, description, quantity, unit_price, line_total)
VALUES
  ('cc10002b-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 'Dues management - monthly', 1, 500.00, 500.00),
  ('cc10002b-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 'Full platform suite', 1, 750.00, 750.00)
ON CONFLICT DO NOTHING;

-- commerce_credit_notes (invoice_id → commerce_invoices)
INSERT INTO commerce_credit_notes (id, entity_id, invoice_id, ref, amount, reason)
VALUES
  ('cc10002c-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 'CN-CAPE-001', 50.00, 'Billing adjustment'),
  ('cc10002c-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 'CN-CLC-001', 75.00, 'Early payment discount')
ON CONFLICT DO NOTHING;

-- commerce_disputes (invoice_id → commerce_invoices)
INSERT INTO commerce_disputes (id, entity_id, invoice_id, reason, description)
VALUES
  ('cc10002d-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 'Overcharge', 'Billed for premium features not used'),
  ('cc10002d-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 'Duplicate', 'Same invoice issued twice')
ON CONFLICT DO NOTHING;

-- commerce_payments (invoice_id → commerce_invoices)
INSERT INTO commerce_payments (id, entity_id, invoice_id, amount, method, paid_at)
VALUES
  ('cc10002e-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000c-0001-4000-8000-000000000001', 565.00, 'bank_transfer', now()),
  ('cc10002e-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000c-0001-4000-8000-000000000002', 847.50, 'credit_card', now())
ON CONFLICT DO NOTHING;

-- commerce_fulfillment_tasks (order_id → commerce_orders)
INSERT INTO commerce_fulfillment_tasks (id, entity_id, order_id, ref)
VALUES
  ('cc10002f-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000003-0001-4000-8000-000000000001', 'FULFILL-CAPE-001'),
  ('cc10002f-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000003-0001-4000-8000-000000000002', 'FULFILL-CLC-001')
ON CONFLICT DO NOTHING;

-- commerce_opportunities (customer_id → commerce_customers)
INSERT INTO commerce_opportunities (id, entity_id, customer_id, title)
VALUES
  ('cc100030-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5360b048-9a28-4edf-827f-1e7d59bba958', 'Platform upsell - analytics'),
  ('cc100030-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'd5fc028a-419c-4772-9901-0a698a3c4bbd', 'Multi-region expansion')
ON CONFLICT DO NOTHING;

-- commerce_quote_lines (quote_id → commerce_quotes)
INSERT INTO commerce_quote_lines (id, entity_id, quote_id, description, unit_price, line_total)
VALUES
  ('cc100031-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000a-0001-4000-8000-000000000001', 'Analytics module', 200.00, 200.00),
  ('cc100031-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000a-0001-4000-8000-000000000002', 'Multi-region license', 350.00, 350.00)
ON CONFLICT DO NOTHING;

-- commerce_quote_versions (quote_id → commerce_quotes)
INSERT INTO commerce_quote_versions (id, entity_id, quote_id, version, snapshot, author_id)
VALUES
  ('cc100032-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc00000a-0001-4000-8000-000000000001', 1, '{"items":1}', 'user_cape_01'),
  ('cc100032-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc00000a-0001-4000-8000-000000000002', 1, '{"items":2}', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- nacp_submissions (session_id → nacp_exam_sessions, candidate_id → nacp_candidates, exam_id → nacp_exams)
INSERT INTO nacp_submissions (id, entity_id, session_id, candidate_id, exam_id)
VALUES
  ('cc100033-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000008-0001-4000-8000-000000000001', 'cc000009-0001-4000-8000-000000000001', 'cc000004-0001-4000-8000-000000000001'),
  ('cc100033-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000008-0001-4000-8000-000000000002', 'cc000009-0001-4000-8000-000000000002', 'cc000004-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- nacp_integrity_artifacts (session_id → nacp_exam_sessions)
INSERT INTO nacp_integrity_artifacts (id, entity_id, session_id, hash, candidate_count)
VALUES
  ('cc100034-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000008-0001-4000-8000-000000000001', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 25),
  ('cc100034-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc000008-0001-4000-8000-000000000002', 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 30)
ON CONFLICT DO NOTHING;

-- indirect_tax_summary (period_id → indirect_tax_periods)
INSERT INTO indirect_tax_summary (id, period_id)
VALUES
  ('cc100035-0001-4000-8000-000000000001', 'cc00000e-0001-4000-8000-000000000001'),
  ('cc100035-0001-4000-8000-000000000002', 'cc00000e-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- board_packet_distributions (section_id → board_packet_sections)
INSERT INTO board_packet_distributions (id, packet_id, recipient_id, distributed_at)
VALUES
  ('cc100036-0001-4000-8000-000000000001', '092ef7ad-e211-4778-8086-0d81b56bbc3e', 'user_cape_01', now()),
  ('cc100036-0001-4000-8000-000000000002', '88c69699-c85c-46ba-b93d-8bb2fccc222f', 'user_clc_01', now())
ON CONFLICT DO NOTHING;

-- evidence_pack_artifacts (pack_id → evidence_packs)
INSERT INTO evidence_pack_artifacts (id, pack_id, document_id, artifact_id, artifact_type, retention_class)
VALUES
  ('cc100037-0001-4000-8000-000000000001', 'cc000007-0001-4000-8000-000000000001', 'cc100037-0001-4000-8000-000000000001', 'ART-CAPE-001', 'general', 'PERMANENT'),
  ('cc100037-0001-4000-8000-000000000002', 'cc000007-0001-4000-8000-000000000002', 'cc100037-0001-4000-8000-000000000002', 'ART-CLC-001', 'general', 'PERMANENT')
ON CONFLICT DO NOTHING;

-- close_task_evidence (task_id → close_tasks)
INSERT INTO close_task_evidence (id, task_id, document_id, sha256, uploaded_by)
VALUES
  ('cc100038-0001-4000-8000-000000000001', 'cc100026-0001-4000-8000-000000000001', 'cc100038-0001-4000-8000-000000000001', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'user_cape_01'),
  ('cc100038-0001-4000-8000-000000000002', 'cc100026-0001-4000-8000-000000000002', 'cc100038-0001-4000-8000-000000000002', 'a3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- commerce_refunds (payment_id → commerce_payments, invoice_id → commerce_invoices)
INSERT INTO commerce_refunds (id, entity_id, payment_id, invoice_id, amount, reason)
VALUES
  ('cc100039-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc10002e-0001-4000-8000-000000000001', 'cc00000c-0001-4000-8000-000000000001', 50.00, 'Partial refund for adjustment'),
  ('cc100039-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cc10002e-0001-4000-8000-000000000002', 'cc00000c-0001-4000-8000-000000000002', 75.00, 'Credit note refund')
ON CONFLICT DO NOTHING;

COMMIT;

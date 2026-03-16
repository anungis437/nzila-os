-- =============================================================================
-- FULL STAGING SEED — March 16, 2026
-- Seeds all empty app-domain tables across 9 feature domains
-- Org IDs:
--   CAPE  = 885aa4e0-5dc1-45bf-ad32-86477868e8ea  (union)
--   CLC   = 5ecb17ab-b5de-442e-a46f-93778ee496aa  (congress)
--   NZILA = 458a56cb-251a-4c91-a0b5-81bb8ac39087  (platform)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PARENT / LOOKUP TABLES (required as FK targets)
-- ─────────────────────────────────────────────────────────────────────────────

-- entities (FK target for documents, votes)
INSERT INTO entities (id, legal_name, jurisdiction, status, created_at, updated_at) VALUES
  ('885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAPE – Canadian Association of Professional Employees', 'CA-ON', 'active', now(), now()),
  ('5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CLC – Canadian Labour Congress', 'CA-ON', 'active', now(), now()),
  ('458a56cb-251a-4c91-a0b5-81bb8ac39087', 'NZILA Ventures Inc.', 'CA-ON', 'active', now(), now());

-- people (FK target for votes)
INSERT INTO people (id, type, legal_name, email, created_at, updated_at) VALUES
  ('a0000001-0001-4000-8000-000000000001', 'individual', 'Marie Tremblay', 'marie.tremblay@example.com', now(), now()),
  ('a0000001-0001-4000-8000-000000000002', 'individual', 'Jean-Pierre Duval', 'jp.duval@example.com', now(), now()),
  ('a0000001-0001-4000-8000-000000000003', 'individual', 'Sarah Blackwood', 'sarah.blackwood@example.com', now(), now()),
  ('a0000001-0001-4000-8000-000000000004', 'individual', 'Michael Chen', 'michael.chen@example.com', now(), now()),
  ('a0000001-0001-4000-8000-000000000005', 'individual', 'Fatima Hassan', 'fatima.hassan@example.com', now(), now()),
  ('a0000001-0001-4000-8000-000000000006', 'individual', 'David Ogundimu', 'david.ogundimu@example.com', now(), now());

-- approvals (FK target for votes)
INSERT INTO approvals (id, org_id, subject_type, subject_id, approval_type, threshold, status, created_at, updated_at) VALUES
  ('b0000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'resolution', 'b0000001-0001-4000-8000-000000000010', 'board', 0.5, 'approved', now(), now()),
  ('b0000001-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'governance_action', 'b0000001-0001-4000-8000-000000000011', 'shareholder', 0.67, 'approved', now(), now()),
  ('b0000001-0001-4000-8000-000000000003', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'resolution', 'b0000001-0001-4000-8000-000000000012', 'board', 0.5, 'pending', now(), now()),
  ('b0000001-0001-4000-8000-000000000004', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'governance_action', 'b0000001-0001-4000-8000-000000000013', 'shareholder', 0.67, 'approved', now(), now());

-- employers
INSERT INTO employers (id, created_at, updated_at, organization_id) VALUES
  ('e0000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('e0000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('e0000001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('e0000001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

-- bargaining_units
INSERT INTO bargaining_units (id, created_at, updated_at, organization_id) VALUES
  ('b6000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('b6000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('b6000001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('b6000001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

-- worksites
INSERT INTO worksites (id, created_at, updated_at, organization_id) VALUES
  ('a5000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('a5000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('a5000001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('a5000001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COMMUNICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO sms_templates (id, created_at, updated_at, organization_id) VALUES
  ('c1000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1000001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1000001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO sms_campaigns (id, created_at, updated_at, organization_id) VALUES
  ('c1100001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1100001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1100001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO sms_campaign_recipients (id, created_at, updated_at, campaign_id) VALUES
  ('c1200001-0001-4000-8000-000000000001', now(), now(), 'c1100001-0001-4000-8000-000000000001'),
  ('c1200001-0001-4000-8000-000000000002', now(), now(), 'c1100001-0001-4000-8000-000000000001'),
  ('c1200001-0001-4000-8000-000000000003', now(), now(), 'c1100001-0001-4000-8000-000000000003');

INSERT INTO sms_messages (id, created_at, updated_at, organization_id) VALUES
  ('c1300001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1300001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1300001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1300001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO sms_conversations (id, created_at, updated_at, organization_id) VALUES
  ('c1400001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1400001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO sms_opt_outs (id, created_at, updated_at, organization_id) VALUES
  ('c1500001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1500001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO communication_preferences (id, created_at, updated_at, organization_id) VALUES
  ('c1600001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1600001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1600001-0001-4000-8000-000000000003', now(), now(), '458a56cb-251a-4c91-a0b5-81bb8ac39087');

INSERT INTO notification_templates (id, created_at, updated_at, organization_id) VALUES
  ('c1700001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1700001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1700001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1700001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1700001-0001-4000-8000-000000000005', now(), now(), '458a56cb-251a-4c91-a0b5-81bb8ac39087');

INSERT INTO notifications (id, created_at, updated_at, organization_id) VALUES
  ('c1800001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1800001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1800001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1800001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1800001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1800001-0001-4000-8000-000000000006', now(), now(), '458a56cb-251a-4c91-a0b5-81bb8ac39087');

INSERT INTO in_app_notifications (id, created_at, updated_at, user_id, organization_id) VALUES
  ('c1900001-0001-4000-8000-000000000001', now(), now(), 'cape-user-001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1900001-0001-4000-8000-000000000002', now(), now(), 'cape-user-002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1900001-0001-4000-8000-000000000003', now(), now(), 'cape-user-003', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1900001-0001-4000-8000-000000000004', now(), now(), 'clc-user-001', '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1900001-0001-4000-8000-000000000005', now(), now(), 'clc-user-002', '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO user_notification_preferences (id, created_at, updated_at, user_id, organization_id) VALUES
  ('c1a00001-0001-4000-8000-000000000001', now(), now(), 'cape-user-001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1a00001-0001-4000-8000-000000000002', now(), now(), 'cape-user-002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1a00001-0001-4000-8000-000000000003', now(), now(), 'clc-user-001', '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('c1a00001-0001-4000-8000-000000000004', now(), now(), 'clc-user-002', '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO message_templates (id, created_at, updated_at, organization_id) VALUES
  ('c1b00001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1b00001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1b00001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO newsletter_templates (id, created_at, updated_at, organization_id) VALUES
  ('c1c00001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1c00001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO newsletter_campaigns (id, created_at, updated_at, organization_id) VALUES
  ('c1d00001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1d00001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('c1d00001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DOCUMENTS & E-SIGNATURES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO document_folders (id, created_at, updated_at, organization_id) VALUES
  ('d2000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('d2000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('d2000001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('d2000001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO documents (id, org_id, category, title, blob_container, blob_path, content_type, size_bytes, sha256, uploaded_by, uploaded_at, classification, created_at, updated_at) VALUES
  ('d2100001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'minutes', 'Board Meeting Minutes – January 2026', 'documents', 'cape/minutes/2026-01.pdf', 'application/pdf', 245000, 'sha256-placeholder-001', 'cape-user-001', now(), 'internal', now(), now()),
  ('d2100001-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'resolution', 'Resolution 2026-001 Strike Fund', 'documents', 'cape/resolutions/2026-001.pdf', 'application/pdf', 120000, 'sha256-placeholder-002', 'cape-user-001', now(), 'confidential', now(), now()),
  ('d2100001-0001-4000-8000-000000000003', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'certificate', 'Certificate of Incorporation', 'documents', 'cape/certificates/incorporation.pdf', 'application/pdf', 89000, 'sha256-placeholder-003', 'cape-user-002', now(), 'public', now(), now()),
  ('d2100001-0001-4000-8000-000000000004', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'filing', 'Annual Return 2025', 'documents', 'cape/filings/annual-2025.pdf', 'application/pdf', 310000, 'sha256-placeholder-004', 'cape-user-001', now(), 'internal', now(), now()),
  ('d2100001-0001-4000-8000-000000000005', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'minute_book', 'CAPE Minute Book 2025', 'documents', 'cape/minute-book/2025.pdf', 'application/pdf', 1500000, 'sha256-placeholder-005', 'cape-user-003', now(), 'confidential', now(), now()),
  ('d2100001-0001-4000-8000-000000000006', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'minutes', 'CLC Executive Meeting – February 2026', 'documents', 'clc/minutes/2026-02.pdf', 'application/pdf', 198000, 'sha256-placeholder-006', 'clc-user-001', now(), 'internal', now(), now()),
  ('d2100001-0001-4000-8000-000000000007', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'resolution', 'CLC Resolution 2026-001 Per Capita', 'documents', 'clc/resolutions/2026-001.pdf', 'application/pdf', 95000, 'sha256-placeholder-007', 'clc-user-001', now(), 'internal', now(), now()),
  ('d2100001-0001-4000-8000-000000000008', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'year_end', 'CLC Year-End Financial Report 2025', 'documents', 'clc/year-end/2025.pdf', 'application/pdf', 780000, 'sha256-placeholder-008', 'clc-user-002', now(), 'confidential', now(), now()),
  ('d2100001-0001-4000-8000-000000000009', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'filing', 'CLC Quarterly Filing Q4 2025', 'documents', 'clc/filings/q4-2025.pdf', 'application/pdf', 210000, 'sha256-placeholder-009', 'clc-user-001', now(), 'internal', now(), now());

INSERT INTO member_documents (id, created_at, user_id, file_name, file_url, file_size, file_type, category, uploaded_at, updated_at) VALUES
  ('d2200001-0001-4000-8000-000000000001', now(), 'cape-user-001', 'employment-letter.pdf', '/docs/cape-user-001/employment-letter.pdf', 85000, 'application/pdf', 'employment', now(), now()),
  ('d2200001-0001-4000-8000-000000000002', now(), 'cape-user-002', 'union-card.pdf', '/docs/cape-user-002/union-card.pdf', 42000, 'application/pdf', 'membership', now(), now()),
  ('d2200001-0001-4000-8000-000000000003', now(), 'cape-user-003', 'tax-receipt-2025.pdf', '/docs/cape-user-003/tax-receipt-2025.pdf', 67000, 'application/pdf', 'tax', now(), now()),
  ('d2200001-0001-4000-8000-000000000004', now(), 'clc-user-001', 'employment-letter.pdf', '/docs/clc-user-001/employment-letter.pdf', 79000, 'application/pdf', 'employment', now(), now()),
  ('d2200001-0001-4000-8000-000000000005', now(), 'clc-user-002', 'certification.pdf', '/docs/clc-user-002/certification.pdf', 55000, 'application/pdf', 'certification', now(), now());


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HEALTH & SAFETY
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO workplace_incidents (id, created_at, updated_at, organization_id, incident_number) VALUES
  ('43000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INC-2026-001'),
  ('43000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INC-2026-002'),
  ('43000001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INC-2026-003'),
  ('43000001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'INC-2026-004'),
  ('43000001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'INC-2026-005');

INSERT INTO safety_inspections (id, created_at, updated_at, organization_id, inspection_number) VALUES
  ('43100001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INSP-2026-001'),
  ('43100001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INSP-2026-002'),
  ('43100001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'INSP-2026-003'),
  ('43100001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'INSP-2026-004');

INSERT INTO hazard_reports (id, created_at, updated_at, organization_id, report_number) VALUES
  ('43200001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'HAZ-2026-001'),
  ('43200001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'HAZ-2026-002'),
  ('43200001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'HAZ-2026-003');

INSERT INTO safety_policies (id, created_at, updated_at, organization_id, policy_number) VALUES
  ('43300001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SP-001'),
  ('43300001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SP-002'),
  ('43300001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'SP-003'),
  ('43300001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'SP-004');

INSERT INTO safety_committee_meetings (id, created_at, updated_at, organization_id, meeting_number) VALUES
  ('43400001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SCM-2026-001'),
  ('43400001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SCM-2026-002'),
  ('43400001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'SCM-2026-003');

INSERT INTO injury_logs (id, created_at, updated_at, organization_id, log_number) VALUES
  ('43500001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INJ-2026-001'),
  ('43500001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'INJ-2026-002'),
  ('43500001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'INJ-2026-003');

INSERT INTO ppe_equipment (id, created_at, updated_at, organization_id, item_number) VALUES
  ('43600001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PPE-001'),
  ('43600001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'PPE-002'),
  ('43600001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PPE-003'),
  ('43600001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PPE-004');

INSERT INTO corrective_actions (id, created_at, updated_at, organization_id, action_number) VALUES
  ('43700001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CA-2026-001'),
  ('43700001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CA-2026-002'),
  ('43700001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CA-2026-003');


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FEDERATION & CLC
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO federations (id, created_at, updated_at, organization_id, name) VALUES
  ('f4000001-0001-4000-8000-000000000001', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'Canadian Labour Congress'),
  ('f4000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'National Union of Public and General Employees');

INSERT INTO federation_memberships (id, created_at, updated_at, federation_id, union_organization_id, status, membership_number) VALUES
  ('f4100001-0001-4000-8000-000000000001', now(), now(), 'f4000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'active', 'CLC-CAPE-001'),
  ('f4100001-0001-4000-8000-000000000002', now(), now(), 'f4000001-0001-4000-8000-000000000001', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'active', 'CLC-CLC-001'),
  ('f4100001-0001-4000-8000-000000000003', now(), now(), 'f4000001-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'active', 'NUPGE-CAPE-001');

INSERT INTO federation_executives (id, created_at, updated_at, federation_id, profile_user_id) VALUES
  ('f4200001-0001-4000-8000-000000000001', now(), now(), 'f4000001-0001-4000-8000-000000000001', 'clc-user-001'),
  ('f4200001-0001-4000-8000-000000000002', now(), now(), 'f4000001-0001-4000-8000-000000000001', 'clc-user-002'),
  ('f4200001-0001-4000-8000-000000000003', now(), now(), 'f4000001-0001-4000-8000-000000000002', 'cape-user-001');

INSERT INTO federation_meetings (id, created_at, updated_at, federation_id, title) VALUES
  ('f4300001-0001-4000-8000-000000000001', now(), now(), 'f4000001-0001-4000-8000-000000000001', 'CLC Quarterly Meeting Q1 2026'),
  ('f4300001-0001-4000-8000-000000000002', now(), now(), 'f4000001-0001-4000-8000-000000000001', 'CLC Annual Convention Planning'),
  ('f4300001-0001-4000-8000-000000000003', now(), now(), 'f4000001-0001-4000-8000-000000000002', 'NUPGE Semi-Annual Meeting');

INSERT INTO federation_campaigns (id, created_at, updated_at, federation_id, name) VALUES
  ('f4400001-0001-4000-8000-000000000001', now(), now(), 'f4000001-0001-4000-8000-000000000001', 'Anti-Scab Legislation Campaign'),
  ('f4400001-0001-4000-8000-000000000002', now(), now(), 'f4000001-0001-4000-8000-000000000001', 'Living Wage Campaign 2026'),
  ('f4400001-0001-4000-8000-000000000003', now(), now(), 'f4000001-0001-4000-8000-000000000002', 'Public Sector Solidarity Week');

INSERT INTO federation_remittances (id, created_at, updated_at, federation_id, from_organization_id, to_organization_id, remittance_month, remittance_year, due_date, total_members, remittable_members, per_capita_rate) VALUES
  ('f4500001-0001-4000-8000-000000000001', now(), now(), 'f4000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 1, 2026, '2026-02-15', 14, 14, 2.50),
  ('f4500001-0001-4000-8000-000000000002', now(), now(), 'f4000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 2, 2026, '2026-03-15', 14, 14, 2.50),
  ('f4500001-0001-4000-8000-000000000003', now(), now(), 'f4000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 3, 2026, '2026-04-15', 14, 14, 2.50);

INSERT INTO congress_memberships (id, created_at, updated_at, organization_id) VALUES
  ('f4600001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('f4600001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ORGANIZING
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO organizing_campaigns (id, created_at, updated_at, organization_id) VALUES
  ('05000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05000001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO organizing_contacts (id, created_at, updated_at, organization_id) VALUES
  ('05100001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05100001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05100001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05100001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('05100001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO field_organizer_activities (id, created_at, updated_at, organization_id) VALUES
  ('05200001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05200001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05200001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO organizer_tasks (id, created_at, updated_at, organization_id) VALUES
  ('05300001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05300001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05300001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('05300001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO organizer_impacts (id, created_at, updated_at, user_id, organization_id) VALUES
  ('05400001-0001-4000-8000-000000000001', now(), now(), 'c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05400001-0001-4000-8000-000000000002', now(), now(), '2aa1a915-7778-4a00-84a3-05f04ea336c7', '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('05400001-0001-4000-8000-000000000003', now(), now(), '5707857c-8d20-495d-bf7b-d64df44076b6', '5ecb17ab-b5de-442e-a46f-93778ee496aa');


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SURVEYS & REPORTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO surveys (id, created_at, updated_at, organization_id) VALUES
  ('56000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56000001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO survey_questions (id, created_at, updated_at, organization_id) VALUES
  ('56100001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56100001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56100001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56100001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('56100001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO survey_responses (id, created_at, updated_at, organization_id) VALUES
  ('56200001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56200001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56200001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56200001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('56200001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO survey_answers (id, created_at, updated_at, organization_id) VALUES
  ('56300001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56300001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56300001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56300001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('56300001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('56300001-0001-4000-8000-000000000006', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO polls (id, created_at, updated_at, organization_id) VALUES
  ('56400001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56400001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56400001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO poll_votes (id, created_at, updated_at, organization_id) VALUES
  ('56500001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56500001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56500001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('56500001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('56500001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO scheduled_reports (id, created_at, updated_at, report_id, organization_id, name, frequency, time_of_day, timezone, format, recipients, is_active, created_by) VALUES
  ('56600001-0001-4000-8000-000000000001', now(), now(), '56600001-0001-4000-8000-000000000010', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Weekly Grievance Summary', 'weekly', '08:00', 'America/Toronto', 'pdf', '["cape-user-001"]'::jsonb, true, 'cape-user-001'),
  ('56600001-0001-4000-8000-000000000002', now(), now(), '56600001-0001-4000-8000-000000000011', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Monthly Financial Report', 'monthly', '09:00', 'America/Toronto', 'xlsx', '["cape-user-001","cape-user-002"]'::jsonb, true, 'cape-user-001'),
  ('56600001-0001-4000-8000-000000000003', now(), now(), '56600001-0001-4000-8000-000000000012', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'Weekly Membership Status', 'weekly', '07:30', 'America/Toronto', 'pdf', '["clc-user-001"]'::jsonb, true, 'clc-user-001'),
  ('56600001-0001-4000-8000-000000000004', now(), now(), '56600001-0001-4000-8000-000000000013', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'Quarterly Per Capita Report', 'monthly', '10:00', 'America/Toronto', 'pdf', '["clc-user-001","clc-user-002"]'::jsonb, true, 'clc-user-001');


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. DUES / FINANCE DETAIL
-- ─────────────────────────────────────────────────────────────────────────────

-- Use real member IDs from organization_members
-- CAPE members: c66bf357... through cape-user-012
-- CLC members: 5707857c... through clc-user-006

INSERT INTO dues_transactions (id, created_at, updated_at, organization_id, member_id, amount, period_start, period_end, due_date, status, dues_amount) VALUES
  ('d7000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'c66bf357-4ea0-4e9c-93df-bff77a408fe8', 85.50, '2026-01-01', '2026-01-31', '2026-01-15', 'paid', 85.50),
  ('d7000001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2aa1a915-7778-4a00-84a3-05f04ea336c7', 85.50, '2026-01-01', '2026-01-31', '2026-01-15', 'paid', 85.50),
  ('d7000001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'f77497e7-a6ee-4d63-bfee-5db5fca94c3b', 85.50, '2026-01-01', '2026-01-31', '2026-01-15', 'paid', 85.50),
  ('d7000001-0001-4000-8000-000000000004', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b9250f0e-1dbb-45df-bb3d-b20bfe885ba9', 85.50, '2026-01-01', '2026-01-31', '2026-01-15', 'overdue', 85.50),
  ('d7000001-0001-4000-8000-000000000005', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'c66bf357-4ea0-4e9c-93df-bff77a408fe8', 85.50, '2026-02-01', '2026-02-28', '2026-02-15', 'paid', 85.50),
  ('d7000001-0001-4000-8000-000000000006', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2aa1a915-7778-4a00-84a3-05f04ea336c7', 85.50, '2026-02-01', '2026-02-28', '2026-02-15', 'paid', 85.50),
  ('d7000001-0001-4000-8000-000000000007', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', '5707857c-8d20-495d-bf7b-d64df44076b6', 72.00, '2026-01-01', '2026-01-31', '2026-01-15', 'paid', 72.00),
  ('d7000001-0001-4000-8000-000000000008', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', '6bab3d9b-2e08-4ce1-84c0-d2d27579ffd3', 72.00, '2026-01-01', '2026-01-31', '2026-01-15', 'paid', 72.00),
  ('d7000001-0001-4000-8000-000000000009', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'e0520533-4ae7-4f37-9a8f-849d8de866f9', 72.00, '2026-01-01', '2026-01-31', '2026-01-15', 'overdue', 72.00),
  ('d7000001-0001-4000-8000-000000000010', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', '5707857c-8d20-495d-bf7b-d64df44076b6', 72.00, '2026-02-01', '2026-02-28', '2026-02-15', 'paid', 72.00);

INSERT INTO employer_remittances (id, created_at, updated_at, employer_id, organization_id, period_start, period_end, fiscal_year, fiscal_month, remittance_date, remittance_number, total_amount) VALUES
  ('d7100001-0001-4000-8000-000000000001', now(), now(), 'e0000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2026-01-01', '2026-01-31', 2026, 1, '2026-02-10', 'REM-CAPE-2026-01', 1197.00),
  ('d7100001-0001-4000-8000-000000000002', now(), now(), 'e0000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2026-02-01', '2026-02-28', 2026, 2, '2026-03-10', 'REM-CAPE-2026-02', 1197.00),
  ('d7100001-0001-4000-8000-000000000003', now(), now(), 'e0000001-0001-4000-8000-000000000003', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '2026-01-01', '2026-01-31', 2026, 1, '2026-02-10', 'REM-CLC-2026-01', 864.00),
  ('d7100001-0001-4000-8000-000000000004', now(), now(), 'e0000001-0001-4000-8000-000000000003', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '2026-02-01', '2026-02-28', 2026, 2, '2026-03-10', 'REM-CLC-2026-02', 864.00);

INSERT INTO arrears (id, tenant_id, member_id, total_owed, oldest_debt_date, months_overdue, arrears_status, created_at, updated_at) VALUES
  ('d7200001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b9250f0e-1dbb-45df-bb3d-b20bfe885ba9', 85.50, '2026-01-15', 2, 'active', now(), now()),
  ('d7200001-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '79e2ac31-729a-4ede-a133-5e8de1f620b1', 171.00, '2025-12-15', 3, 'payment_plan', now(), now()),
  ('d7200001-0001-4000-8000-000000000003', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'e0520533-4ae7-4f37-9a8f-849d8de866f9', 72.00, '2026-01-15', 2, 'active', now(), now());

INSERT INTO payment_methods (id, created_at, updated_at, organization_id) VALUES
  ('d7300001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('d7300001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('d7300001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO payment_cycles (id, created_at, updated_at, organization_id) VALUES
  ('d7400001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('d7400001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('d7400001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO member_dues_ledger (id, created_at, updated_at, user_id, organization_id, transaction_type, transaction_date, effective_date, amount) VALUES
  ('d7500001-0001-4000-8000-000000000001', now(), now(), 'c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-01-15', '2026-01-15', 85.50),
  ('d7500001-0001-4000-8000-000000000002', now(), now(), '2aa1a915-7778-4a00-84a3-05f04ea336c7', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-01-15', '2026-01-15', 85.50),
  ('d7500001-0001-4000-8000-000000000003', now(), now(), 'f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-01-15', '2026-01-15', 85.50),
  ('d7500001-0001-4000-8000-000000000004', now(), now(), 'c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-02-15', '2026-02-15', 85.50),
  ('d7500001-0001-4000-8000-000000000005', now(), now(), '5707857c-8d20-495d-bf7b-d64df44076b6', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-01-15', '2026-01-15', 72.00),
  ('d7500001-0001-4000-8000-000000000006', now(), now(), '6bab3d9b-2e08-4ce1-84c0-d2d27579ffd3', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-01-15', '2026-01-15', 72.00);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CALENDAR & EVENTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO calendars (id, created_at, updated_at, organization_id) VALUES
  ('ca800001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca800001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('ca800001-0001-4000-8000-000000000003', now(), now(), '458a56cb-251a-4c91-a0b5-81bb8ac39087');

INSERT INTO calendar_events (id, created_at, updated_at, calendar_id) VALUES
  ('ca810001-0001-4000-8000-000000000001', now(), now(), 'ca800001-0001-4000-8000-000000000001'),
  ('ca810001-0001-4000-8000-000000000002', now(), now(), 'ca800001-0001-4000-8000-000000000001'),
  ('ca810001-0001-4000-8000-000000000003', now(), now(), 'ca800001-0001-4000-8000-000000000001'),
  ('ca810001-0001-4000-8000-000000000004', now(), now(), 'ca800001-0001-4000-8000-000000000001'),
  ('ca810001-0001-4000-8000-000000000005', now(), now(), 'ca800001-0001-4000-8000-000000000002'),
  ('ca810001-0001-4000-8000-000000000006', now(), now(), 'ca800001-0001-4000-8000-000000000002'),
  ('ca810001-0001-4000-8000-000000000007', now(), now(), 'ca800001-0001-4000-8000-000000000002'),
  ('ca810001-0001-4000-8000-000000000008', now(), now(), 'ca800001-0001-4000-8000-000000000003');

INSERT INTO event_attendees (id, created_at, updated_at, event_id) VALUES
  ('ca820001-0001-4000-8000-000000000001', now(), now(), 'ca810001-0001-4000-8000-000000000001'),
  ('ca820001-0001-4000-8000-000000000002', now(), now(), 'ca810001-0001-4000-8000-000000000002'),
  ('ca820001-0001-4000-8000-000000000003', now(), now(), 'ca810001-0001-4000-8000-000000000005'),
  ('ca820001-0001-4000-8000-000000000004', now(), now(), 'ca810001-0001-4000-8000-000000000006');

INSERT INTO meeting_rooms (id, created_at, updated_at, organization_id) VALUES
  ('ca830001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca830001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca830001-0001-4000-8000-000000000003', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO room_bookings (id, created_at, updated_at, room_id) VALUES
  ('ca840001-0001-4000-8000-000000000001', now(), now(), 'ca830001-0001-4000-8000-000000000001'),
  ('ca840001-0001-4000-8000-000000000002', now(), now(), 'ca830001-0001-4000-8000-000000000002'),
  ('ca840001-0001-4000-8000-000000000003', now(), now(), 'ca830001-0001-4000-8000-000000000003');

INSERT INTO holidays (id, created_at, updated_at, organization_id) VALUES
  ('ca850001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca850001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca850001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca850001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('ca850001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. GOVERNANCE DETAIL
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO voting_sessions (id, created_at, updated_at, title) VALUES
  ('69000001-0001-4000-8000-000000000001', now(), now(), 'CAPE Board Election 2024'),
  ('69000001-0001-4000-8000-000000000002', now(), now(), 'CAPE Strike Vote 2026'),
  ('69000001-0001-4000-8000-000000000003', now(), now(), 'CLC Convention Delegates 2026'),
  ('69000001-0001-4000-8000-000000000004', now(), now(), 'CLC Policy Resolution Vote');

INSERT INTO voting_options (id, created_at, updated_at, session_id) VALUES
  ('69100001-0001-4000-8000-000000000001', now(), now(), '69000001-0001-4000-8000-000000000001'),
  ('69100001-0001-4000-8000-000000000002', now(), now(), '69000001-0001-4000-8000-000000000001'),
  ('69100001-0001-4000-8000-000000000003', now(), now(), '69000001-0001-4000-8000-000000000002'),
  ('69100001-0001-4000-8000-000000000004', now(), now(), '69000001-0001-4000-8000-000000000003'),
  ('69100001-0001-4000-8000-000000000005', now(), now(), '69000001-0001-4000-8000-000000000004');

INSERT INTO voter_eligibility (id, created_at, updated_at, session_id) VALUES
  ('69200001-0001-4000-8000-000000000001', now(), now(), '69000001-0001-4000-8000-000000000001'),
  ('69200001-0001-4000-8000-000000000002', now(), now(), '69000001-0001-4000-8000-000000000002'),
  ('69200001-0001-4000-8000-000000000003', now(), now(), '69000001-0001-4000-8000-000000000003'),
  ('69200001-0001-4000-8000-000000000004', now(), now(), '69000001-0001-4000-8000-000000000004');

INSERT INTO votes (id, org_id, approval_id, voter_person_id, choice, cast_at) VALUES
  ('69300001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b0000001-0001-4000-8000-000000000001', 'a0000001-0001-4000-8000-000000000001', 'yes', now()),
  ('69300001-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b0000001-0001-4000-8000-000000000001', 'a0000001-0001-4000-8000-000000000002', 'yes', now()),
  ('69300001-0001-4000-8000-000000000003', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b0000001-0001-4000-8000-000000000001', 'a0000001-0001-4000-8000-000000000003', 'no', now()),
  ('69300001-0001-4000-8000-000000000004', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b0000001-0001-4000-8000-000000000002', 'a0000001-0001-4000-8000-000000000001', 'yes', now()),
  ('69300001-0001-4000-8000-000000000005', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b0000001-0001-4000-8000-000000000002', 'a0000001-0001-4000-8000-000000000004', 'abstain', now()),
  ('69300001-0001-4000-8000-000000000006', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'b0000001-0001-4000-8000-000000000003', 'a0000001-0001-4000-8000-000000000005', 'yes', now()),
  ('69300001-0001-4000-8000-000000000007', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'b0000001-0001-4000-8000-000000000004', 'a0000001-0001-4000-8000-000000000006', 'yes', now()),
  ('69300001-0001-4000-8000-000000000008', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'b0000001-0001-4000-8000-000000000004', 'a0000001-0001-4000-8000-000000000005', 'no', now());

INSERT INTO committees (id, created_at, updated_at, organization_id) VALUES
  ('69400001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('69400001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('69400001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('69400001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('69400001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

INSERT INTO committee_memberships (id, created_at, updated_at, committee_id) VALUES
  ('69500001-0001-4000-8000-000000000001', now(), now(), '69400001-0001-4000-8000-000000000001'),
  ('69500001-0001-4000-8000-000000000002', now(), now(), '69400001-0001-4000-8000-000000000001'),
  ('69500001-0001-4000-8000-000000000003', now(), now(), '69400001-0001-4000-8000-000000000002'),
  ('69500001-0001-4000-8000-000000000004', now(), now(), '69400001-0001-4000-8000-000000000004'),
  ('69500001-0001-4000-8000-000000000005', now(), now(), '69400001-0001-4000-8000-000000000004'),
  ('69500001-0001-4000-8000-000000000006', now(), now(), '69400001-0001-4000-8000-000000000005');


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. MEMBER DETAIL
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO member_employment (id, created_at, updated_at, employment_status, employment_type, hire_date, seniority_date, member_id, organization_id, employer_id, bargaining_unit_id, worksite_id) VALUES
  ('01000001-0001-4000-8000-000000000001', now(), now(), 'active', 'full_time', '2020-03-15', '2020-03-15', 'c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'e0000001-0001-4000-8000-000000000001', 'b6000001-0001-4000-8000-000000000001', 'a5000001-0001-4000-8000-000000000001'),
  ('01000001-0001-4000-8000-000000000002', now(), now(), 'active', 'full_time', '2019-06-01', '2019-06-01', '2aa1a915-7778-4a00-84a3-05f04ea336c7', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'e0000001-0001-4000-8000-000000000001', 'b6000001-0001-4000-8000-000000000001', 'a5000001-0001-4000-8000-000000000001'),
  ('01000001-0001-4000-8000-000000000003', now(), now(), 'active', 'part_time', '2022-01-10', '2022-01-10', 'f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'e0000001-0001-4000-8000-000000000002', 'b6000001-0001-4000-8000-000000000002', 'a5000001-0001-4000-8000-000000000002'),
  ('01000001-0001-4000-8000-000000000004', now(), now(), 'active', 'full_time', '2018-09-01', '2018-09-01', 'b9250f0e-1dbb-45df-bb3d-b20bfe885ba9', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'e0000001-0001-4000-8000-000000000002', 'b6000001-0001-4000-8000-000000000002', 'a5000001-0001-4000-8000-000000000002'),
  ('01000001-0001-4000-8000-000000000005', now(), now(), 'on_leave', 'full_time', '2021-04-15', '2021-04-15', '79e2ac31-729a-4ede-a133-5e8de1f620b1', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'e0000001-0001-4000-8000-000000000001', 'b6000001-0001-4000-8000-000000000001', 'a5000001-0001-4000-8000-000000000001'),
  ('01000001-0001-4000-8000-000000000006', now(), now(), 'active', 'full_time', '2023-02-01', '2023-02-01', '5707857c-8d20-495d-bf7b-d64df44076b6', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'e0000001-0001-4000-8000-000000000003', 'b6000001-0001-4000-8000-000000000003', 'a5000001-0001-4000-8000-000000000003'),
  ('01000001-0001-4000-8000-000000000007', now(), now(), 'active', 'full_time', '2020-07-15', '2020-07-15', '6bab3d9b-2e08-4ce1-84c0-d2d27579ffd3', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'e0000001-0001-4000-8000-000000000003', 'b6000001-0001-4000-8000-000000000003', 'a5000001-0001-4000-8000-000000000003'),
  ('01000001-0001-4000-8000-000000000008', now(), now(), 'active', 'part_time', '2024-01-10', '2024-01-10', 'e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'e0000001-0001-4000-8000-000000000004', 'b6000001-0001-4000-8000-000000000004', 'a5000001-0001-4000-8000-000000000004'),
  ('01000001-0001-4000-8000-000000000009', now(), now(), 'active', 'full_time', '2019-11-01', '2019-11-01', '77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'e0000001-0001-4000-8000-000000000004', 'b6000001-0001-4000-8000-000000000004', 'a5000001-0001-4000-8000-000000000004');

INSERT INTO member_addresses (id, created_at, updated_at, user_id) VALUES
  ('01100001-0001-4000-8000-000000000001', now(), now(), 'cape-user-001'),
  ('01100001-0001-4000-8000-000000000002', now(), now(), 'cape-user-002'),
  ('01100001-0001-4000-8000-000000000003', now(), now(), 'cape-user-003'),
  ('01100001-0001-4000-8000-000000000004', now(), now(), 'clc-user-001'),
  ('01100001-0001-4000-8000-000000000005', now(), now(), 'clc-user-002'),
  ('01100001-0001-4000-8000-000000000006', now(), now(), 'clc-user-003');

INSERT INTO member_leaves (id, created_at, updated_at, leave_type, start_date, is_approved, member_id, organization_id, member_employment_id) VALUES
  ('01200001-0001-4000-8000-000000000001', now(), now(), 'sick', '2026-01-10', true, '79e2ac31-729a-4ede-a133-5e8de1f620b1', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '01000001-0001-4000-8000-000000000005'),
  ('01200001-0001-4000-8000-000000000002', now(), now(), 'maternity', '2025-11-01', true, 'f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '01000001-0001-4000-8000-000000000003'),
  ('01200001-0001-4000-8000-000000000003', now(), now(), 'vacation', '2026-03-01', true, '5707857c-8d20-495d-bf7b-d64df44076b6', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '01000001-0001-4000-8000-000000000006'),
  ('01200001-0001-4000-8000-000000000004', now(), now(), 'personal', '2026-02-15', true, 'e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '01000001-0001-4000-8000-000000000008');

INSERT INTO member_certifications (id, created_at, updated_at, organization_id, member_id) VALUES
  ('01300001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cape-user-001'),
  ('01300001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cape-user-002'),
  ('01300001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cape-user-003'),
  ('01300001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'clc-user-001'),
  ('01300001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'clc-user-002');

INSERT INTO member_roles (id, member_id, organization_id, role_code, scope_type, start_date, assignment_type, status, is_acting_role, requires_approval, created_at, updated_at) VALUES
  ('01400001-0001-4000-8000-000000000001', 'c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'president', 'organization', '2024-06-01', 'elected', 'active', false, false, now(), now()),
  ('01400001-0001-4000-8000-000000000002', '2aa1a915-7778-4a00-84a3-05f04ea336c7', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'vice_president', 'organization', '2024-06-01', 'elected', 'active', false, false, now(), now()),
  ('01400001-0001-4000-8000-000000000003', 'f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'treasurer', 'organization', '2024-06-01', 'elected', 'active', false, false, now(), now()),
  ('01400001-0001-4000-8000-000000000004', 'b9250f0e-1dbb-45df-bb3d-b20bfe885ba9', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'steward', 'unit', '2024-09-01', 'appointed', 'active', false, true, now(), now()),
  ('01400001-0001-4000-8000-000000000005', '79e2ac31-729a-4ede-a133-5e8de1f620b1', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'steward', 'unit', '2025-01-15', 'appointed', 'active', false, true, now(), now()),
  ('01400001-0001-4000-8000-000000000006', '68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'secretary', 'organization', '2024-06-01', 'elected', 'active', false, false, now(), now()),
  ('01400001-0001-4000-8000-000000000007', '5707857c-8d20-495d-bf7b-d64df44076b6', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'president', 'organization', '2025-01-01', 'elected', 'active', false, false, now(), now()),
  ('01400001-0001-4000-8000-000000000008', '6bab3d9b-2e08-4ce1-84c0-d2d27579ffd3', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'vice_president', 'organization', '2025-01-01', 'elected', 'active', false, false, now(), now()),
  ('01400001-0001-4000-8000-000000000009', 'e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'steward', 'unit', '2025-03-01', 'appointed', 'active', false, true, now(), now()),
  ('01400001-0001-4000-8000-000000000010', '77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'treasurer', 'organization', '2025-01-01', 'elected', 'active', false, false, now(), now());

INSERT INTO steward_assignments (id, created_at, updated_at, organization_id) VALUES
  ('01500001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('01500001-0001-4000-8000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('01500001-0001-4000-8000-000000000003', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('01500001-0001-4000-8000-000000000004', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('01500001-0001-4000-8000-000000000005', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa');

COMMIT;

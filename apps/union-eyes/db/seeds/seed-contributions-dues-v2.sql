-- ============================================================================
-- Seed: Pension Contributions + Dues Rates + Dues Ledger (LOCAL DB)
-- ============================================================================
-- Org IDs (local):
--   CLC:       873cf59b-cef5-4d51-9a62-151512810449
--   CAPE:      c09173ad-5ba4-498e-a483-b371fb5e248e
--   Local 123: 4a20966a-2f17-46b5-9b84-b3efea57b50a

-- ============================================================================
-- 1. PENSION CONTRIBUTIONS — Local 123 (CLC + CAPE already seeded)
-- ============================================================================
INSERT INTO pension_contributions (organization_id, member_id, member_name, period, amount, payment_status, payment_date)
VALUES
  -- Alice Johnson — $68k → ~$566.67/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2025-10', 566.67, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2025-11', 566.67, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2025-12', 566.67, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2026-01', 566.67, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2026-02', 566.67, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2026-03', 566.67, 'pending', NULL),
  -- Bob Smith — $72k → ~$600/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2025-10', 600.00, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2025-11', 600.00, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2025-12', 600.00, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2026-01', 600.00, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2026-02', 600.00, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2026-03', 600.00, 'pending', NULL),
  -- Grace Lee — $58k → ~$483.33/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2025-10', 483.33, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2025-11', 483.33, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2025-12', 483.33, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2026-01', 483.33, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2026-02', 483.33, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2026-03', 483.33, 'pending', NULL),
  -- Marie-Claire Dubois — $74k → ~$616.67/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2025-10', 616.67, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2025-11', 616.67, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2025-12', 616.67, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2026-01', 616.67, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2026-02', 616.67, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2026-03', 616.67, 'pending', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. DUES RATES — All 3 orgs (only cols: id, organization_id, rate_name, rate_type, amount)
-- ============================================================================
INSERT INTO dues_rates (id, organization_id, rate_name, rate_type, amount, created_at, updated_at)
VALUES
  ('d1000001-0001-4000-a000-000000000001', '873cf59b-cef5-4d51-9a62-151512810449', 'Standard Monthly Dues', 'monthly', 72.00, now(), now()),
  ('d1000001-0001-4000-a000-000000000002', '873cf59b-cef5-4d51-9a62-151512810449', 'Initiation Fee', 'initiation', 150.00, now(), now()),
  ('d1000002-0001-4000-a000-000000000001', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Standard Monthly Dues', 'monthly', 85.50, now(), now()),
  ('d1000002-0001-4000-a000-000000000002', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Initiation Fee', 'initiation', 200.00, now(), now()),
  ('d1000003-0001-4000-a000-000000000001', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Standard Monthly Dues', 'monthly', 65.00, now(), now()),
  ('d1000003-0001-4000-a000-000000000002', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Initiation Fee', 'initiation', 125.00, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. MEMBER DUES LEDGER — uses organization_members.id (UUID) as user_id
-- ============================================================================
-- Org member UUIDs (local):
--   CLC:  Hassan=0aa3f40e  Marie Clarke=532da6d3  Denis=5d6fee6d
--   CAPE: Greg=b45b99ed    Brian=e7d6137b          Nadia=662fad22
--   L123: Bob=2f5bdfe0     Alice=beb4a1d7          Grace=0c00e070  MC=8653b21c

-- Fix: ensure member_dues_ledger.id has a default
ALTER TABLE member_dues_ledger ALTER COLUMN id SET DEFAULT gen_random_uuid();

INSERT INTO member_dues_ledger (user_id, organization_id, transaction_type, transaction_date, effective_date, amount, created_at, updated_at)
VALUES
  -- ── CLC: Hassan Yussuff — paid through Feb, March pending ──────────────
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-10-01', '2025-10-01',  72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-11-01', '2025-11-01',  72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-12-01', '2025-12-01',  72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-01-01', '2026-01-01',  72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-02-01', '2026-02-01',  72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
  ('0aa3f40e-e13b-4076-862f-eb1977f86b67', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-03-01', '2026-03-01',  72.00, now(), now()),

  -- ── CLC: Marie Clarke Walker — fully paid ──────────────────────────────
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-10-01', '2025-10-01',  72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-11-01', '2025-11-01',  72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-12-01', '2025-12-01',  72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-01-01', '2026-01-01',  72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-02-01', '2026-02-01',  72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-03-01', '2026-03-01',  72.00, now(), now()),
  ('532da6d3-3963-406f-876c-92f1853ab34f', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2026-03-15', '2026-03-15', -72.00, now(), now()),

  -- ── CLC: Denis Bolduc — paid through Feb, March pending ────────────────
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-10-01', '2025-10-01',  72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-11-01', '2025-11-01',  72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2025-12-01', '2025-12-01',  72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-01-01', '2026-01-01',  72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-02-01', '2026-02-01',  72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
  ('5d6fee6d-2edc-4ed2-8668-fb0c976f7293', '873cf59b-cef5-4d51-9a62-151512810449', 'charge',  '2026-03-01', '2026-03-01',  72.00, now(), now()),

  -- ── CAPE: Greg Phillips — paid through Feb, March pending ──────────────
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-10-01', '2025-10-01',  85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-11-01', '2025-11-01',  85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-12-01', '2025-12-01',  85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-01-01', '2026-01-01',  85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-02-01', '2026-02-01',  85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2026-02-15', '2026-02-15', -85.50, now(), now()),
  ('b45b99ed-fe83-4166-8b98-e4a3246e0131', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-03-01', '2026-03-01',  85.50, now(), now()),

  -- ── CAPE: Brian Faulkner — arrears Feb-Mar ─────────────────────────────
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-10-01', '2025-10-01',  85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-11-01', '2025-11-01',  85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-12-01', '2025-12-01',  85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-01-01', '2026-01-01',  85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-02-01', '2026-02-01',  85.50, now(), now()),
  ('e7d6137b-0b4a-4558-9a85-c61ad5c865ab', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-03-01', '2026-03-01',  85.50, now(), now()),

  -- ── CAPE: Nadia Ouellet — fully paid through March ─────────────────────
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-10-01', '2025-10-01',  85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-11-01', '2025-11-01',  85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2025-12-01', '2025-12-01',  85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-01-01', '2026-01-01',  85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-02-01', '2026-02-01',  85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2026-02-15', '2026-02-15', -85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'charge',  '2026-03-01', '2026-03-01',  85.50, now(), now()),
  ('662fad22-5341-4c5b-913e-1b55cdadf268', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'payment', '2026-03-15', '2026-03-15', -85.50, now(), now()),

  -- ── Local 123: Bob Smith — paid through Feb, March pending ─────────────
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-10-01', '2025-10-01',  65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-11-01', '2025-11-01',  65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-12-01', '2025-12-01',  65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-01-01', '2026-01-01',  65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2026-01-15', '2026-01-15', -65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-02-01', '2026-02-01',  65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2026-02-15', '2026-02-15', -65.00, now(), now()),
  ('2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-03-01', '2026-03-01',  65.00, now(), now()),

  -- ── Local 123: Alice Johnson — fully paid through March ────────────────
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-10-01', '2025-10-01',  65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-11-01', '2025-11-01',  65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-12-01', '2025-12-01',  65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-01-01', '2026-01-01',  65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2026-01-15', '2026-01-15', -65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-02-01', '2026-02-01',  65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2026-02-15', '2026-02-15', -65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-03-01', '2026-03-01',  65.00, now(), now()),
  ('beb4a1d7-fa51-4622-b118-2eff94decb45', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2026-03-15', '2026-03-15', -65.00, now(), now()),

  -- ── Local 123: Grace Lee — arrears Jan-Mar (paid through Dec) ──────────
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-10-01', '2025-10-01',  65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-11-01', '2025-11-01',  65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-12-01', '2025-12-01',  65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-01-01', '2026-01-01',  65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-02-01', '2026-02-01',  65.00, now(), now()),
  ('0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-03-01', '2026-03-01',  65.00, now(), now()),

  -- ── Local 123: Marie-Claire Dubois — paid through Feb, March pending ───
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-10-01', '2025-10-01',  65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-11-01', '2025-11-01',  65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2025-12-01', '2025-12-01',  65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-01-01', '2026-01-01',  65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2026-01-15', '2026-01-15', -65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-02-01', '2026-02-01',  65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'payment', '2026-02-15', '2026-02-15', -65.00, now(), now()),
  ('8653b21c-9692-49b9-b519-128a7dc52558', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'charge',  '2026-03-01', '2026-03-01',  65.00, now(), now());

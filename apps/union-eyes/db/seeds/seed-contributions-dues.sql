-- ============================================================================
-- Seed: Pension Contributions + Dues Rates + Dues Ledger
-- For LOCAL DB (use staging-contributions-dues.sql for staging)
-- ============================================================================

-- ── Org IDs (local) ──────────────────────────────────────────────────────────
-- CLC:       9588c826-a543-4d43-9c22-2e477e532649
-- CAPE:      063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6
-- Local 123: 9210418f-6a4f-4dab-a7d2-4450d581dc81

-- ============================================================================
-- 1. PENSION CONTRIBUTIONS — Local 123 (missing; CLC + CAPE already seeded)
-- ============================================================================
-- Pension member IDs (local):
--   Alice Johnson:        ea4ffa82-6243-46df-92bd-39b7e9f96b43
--   Bob Smith:            bbfaa433-5c3a-4f51-8627-86bf36680274
--   Grace Lee:            1a0c4cf0-12b9-4815-91c5-59f3fc984f25
--   Marie-Claire Dubois:  86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c

INSERT INTO pension_contributions (organization_id, member_id, member_name, period, amount, payment_status, payment_date)
VALUES
  -- Alice Johnson — $68k salary → ~$566.67/mo contribution
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2025-10', 566.67, 'received', '2025-10-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2025-11', 566.67, 'received', '2025-11-30'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2025-12', 566.67, 'received', '2025-12-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2026-01', 566.67, 'received', '2026-01-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2026-02', 566.67, 'received', '2026-02-28'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'ea4ffa82-6243-46df-92bd-39b7e9f96b43', 'Alice Johnson', '2026-03', 566.67, 'pending', NULL),

  -- Bob Smith — $72k salary → ~$600/mo contribution
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2025-10', 600.00, 'received', '2025-10-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2025-11', 600.00, 'received', '2025-11-30'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2025-12', 600.00, 'received', '2025-12-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2026-01', 600.00, 'received', '2026-01-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2026-02', 600.00, 'received', '2026-02-28'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'bbfaa433-5c3a-4f51-8627-86bf36680274', 'Bob Smith', '2026-03', 600.00, 'pending', NULL),

  -- Grace Lee — $58k salary → ~$483.33/mo contribution
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2025-10', 483.33, 'received', '2025-10-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2025-11', 483.33, 'received', '2025-11-30'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2025-12', 483.33, 'received', '2025-12-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2026-01', 483.33, 'received', '2026-01-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2026-02', 483.33, 'received', '2026-02-28'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '1a0c4cf0-12b9-4815-91c5-59f3fc984f25', 'Grace Lee', '2026-03', 483.33, 'pending', NULL),

  -- Marie-Claire Dubois — $74k salary → ~$616.67/mo contribution
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2025-10', 616.67, 'received', '2025-10-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2025-11', 616.67, 'received', '2025-11-30'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2025-12', 616.67, 'received', '2025-12-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2026-01', 616.67, 'received', '2026-01-31'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2026-02', 616.67, 'received', '2026-02-28'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', '86e5563f-c2d5-4fc6-a62f-7e37e2ecec8c', 'Marie-Claire Dubois', '2026-03', 616.67, 'pending', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. DUES RATES — All 3 organizations
-- ============================================================================

INSERT INTO dues_rates (id, organization_id, rate_name, rate_type, amount, effective_from, status, created_at, updated_at)
VALUES
  -- CLC rates
  ('d1000001-0001-4000-a000-000000000001', '9588c826-a543-4d43-9c22-2e477e532649', 'Standard Monthly Dues', 'monthly', 72.00, '2025-01-01', 'active', now(), now()),
  ('d1000001-0001-4000-a000-000000000002', '9588c826-a543-4d43-9c22-2e477e532649', 'Initiation Fee', 'initiation', 150.00, '2025-01-01', 'active', now(), now()),

  -- CAPE rates
  ('d2000002-0001-4000-a000-000000000001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'Standard Monthly Dues', 'monthly', 85.50, '2025-01-01', 'active', now(), now()),
  ('d2000002-0001-4000-a000-000000000002', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'Initiation Fee', 'initiation', 200.00, '2025-01-01', 'active', now(), now()),

  -- Local 123 rates
  ('d3000003-0001-4000-a000-000000000001', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Standard Monthly Dues', 'monthly', 65.00, '2025-01-01', 'active', now(), now()),
  ('d3000003-0001-4000-a000-000000000002', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Initiation Fee', 'initiation', 125.00, '2025-01-01', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. MEMBER DUES LEDGER — SKIPPED
-- ============================================================================
-- NOTE: The member_dues_ledger table does not exist in the current schema.
-- The actual table is dues_transactions which has a different column structure.
-- This section is disabled until the ledger table is added or data is remapped
-- to dues_transactions.
-- ============================================================================
--   -- Hassan Yussuff (clc-user-001) — Oct 2025 to Mar 2026
--   ('dl-clc-001-2025-10', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-10-01', '2025-10-01', 72.00, now(), now()),
--   ('dl-clc-001-2025-10p', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
--   ('dl-clc-001-2025-11', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-11-01', '2025-11-01', 72.00, now(), now()),
--   ('dl-clc-001-2025-11p', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
--   ('dl-clc-001-2025-12', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-12-01', '2025-12-01', 72.00, now(), now()),
--   ('dl-clc-001-2025-12p', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
--   ('dl-clc-001-2026-01', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-01-01', '2026-01-01', 72.00, now(), now()),
--   ('dl-clc-001-2026-01p', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
--   ('dl-clc-001-2026-02', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-02-01', '2026-02-01', 72.00, now(), now()),
--   ('dl-clc-001-2026-02p', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
--   ('dl-clc-001-2026-03', 'clc-user-001', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-03-01', '2026-03-01', 72.00, now(), now()),

--   -- Marie Clarke Walker (clc-user-002) — Oct 2025 to Mar 2026
--   ('dl-clc-002-2025-10', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-10-01', '2025-10-01', 72.00, now(), now()),
--   ('dl-clc-002-2025-10p', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
--   ('dl-clc-002-2025-11', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-11-01', '2025-11-01', 72.00, now(), now()),
--   ('dl-clc-002-2025-11p', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
--   ('dl-clc-002-2025-12', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-12-01', '2025-12-01', 72.00, now(), now()),
--   ('dl-clc-002-2025-12p', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
--   ('dl-clc-002-2026-01', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-01-01', '2026-01-01', 72.00, now(), now()),
--   ('dl-clc-002-2026-01p', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
--   ('dl-clc-002-2026-02', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-02-01', '2026-02-01', 72.00, now(), now()),
--   ('dl-clc-002-2026-02p', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
--   ('dl-clc-002-2026-03', 'clc-user-002', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-03-01', '2026-03-01', 72.00, now(), now()),

--   -- Denis Bolduc (clc-user-003) — paid through Feb, March charge outstanding
--   ('dl-clc-003-2025-10', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-10-01', '2025-10-01', 72.00, now(), now()),
--   ('dl-clc-003-2025-10p', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
--   ('dl-clc-003-2025-11', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-11-01', '2025-11-01', 72.00, now(), now()),
--   ('dl-clc-003-2025-11p', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
--   ('dl-clc-003-2025-12', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2025-12-01', '2025-12-01', 72.00, now(), now()),
--   ('dl-clc-003-2025-12p', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
--   ('dl-clc-003-2026-01', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-01-01', '2026-01-01', 72.00, now(), now()),
--   ('dl-clc-003-2026-01p', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
--   ('dl-clc-003-2026-02', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-02-01', '2026-02-01', 72.00, now(), now()),
--   ('dl-clc-003-2026-02p', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
--   ('dl-clc-003-2026-03', 'clc-user-003', '9588c826-a543-4d43-9c22-2e477e532649', 'charge', '2026-03-01', '2026-03-01', 72.00, now(), now()),

-- ── CAPE members ─────────────────────────────────────────────────────────────
--   -- Jane Doe (cape-user-001) — paid through Feb, March pending
--   ('dl-cape-001-2025-10', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-10-01', '2025-10-01', 85.50, now(), now()),
--   ('dl-cape-001-2025-10p', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
--   ('dl-cape-001-2025-11', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-11-01', '2025-11-01', 85.50, now(), now()),
--   ('dl-cape-001-2025-11p', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
--   ('dl-cape-001-2025-12', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-12-01', '2025-12-01', 85.50, now(), now()),
--   ('dl-cape-001-2025-12p', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
--   ('dl-cape-001-2026-01', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-01-01', '2026-01-01', 85.50, now(), now()),
--   ('dl-cape-001-2026-01p', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
--   ('dl-cape-001-2026-02', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-02-01', '2026-02-01', 85.50, now(), now()),
--   ('dl-cape-001-2026-02p', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2026-02-15', '2026-02-15', -85.50, now(), now()),
--   ('dl-cape-001-2026-03', 'cape-user-001', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-03-01', '2026-03-01', 85.50, now(), now()),

--   -- Brian Faulkner (cape-user-003) — paid through Jan, Feb-Mar outstanding (arrears)
--   ('dl-cape-003-2025-10', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-10-01', '2025-10-01', 85.50, now(), now()),
--   ('dl-cape-003-2025-10p', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
--   ('dl-cape-003-2025-11', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-11-01', '2025-11-01', 85.50, now(), now()),
--   ('dl-cape-003-2025-11p', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
--   ('dl-cape-003-2025-12', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-12-01', '2025-12-01', 85.50, now(), now()),
--   ('dl-cape-003-2025-12p', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
--   ('dl-cape-003-2026-01', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-01-01', '2026-01-01', 85.50, now(), now()),
--   ('dl-cape-003-2026-01p', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
--   ('dl-cape-003-2026-02', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-02-01', '2026-02-01', 85.50, now(), now()),
--   ('dl-cape-003-2026-03', 'cape-user-003', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-03-01', '2026-03-01', 85.50, now(), now()),

--   -- Nadia Ouellet (cape-user-006) — fully paid through March
--   ('dl-cape-006-2025-10', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-10-01', '2025-10-01', 85.50, now(), now()),
--   ('dl-cape-006-2025-10p', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
--   ('dl-cape-006-2025-11', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-11-01', '2025-11-01', 85.50, now(), now()),
--   ('dl-cape-006-2025-11p', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
--   ('dl-cape-006-2025-12', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2025-12-01', '2025-12-01', 85.50, now(), now()),
--   ('dl-cape-006-2025-12p', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
--   ('dl-cape-006-2026-01', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-01-01', '2026-01-01', 85.50, now(), now()),
--   ('dl-cape-006-2026-01p', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
--   ('dl-cape-006-2026-02', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-02-01', '2026-02-01', 85.50, now(), now()),
--   ('dl-cape-006-2026-02p', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2026-02-15', '2026-02-15', -85.50, now(), now()),
--   ('dl-cape-006-2026-03', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'charge', '2026-03-01', '2026-03-01', 85.50, now(), now()),
--   ('dl-cape-006-2026-03p', 'cape-user-006', '063aa6d5-8b1f-4c6c-bef7-9b74f6d03bc6', 'payment', '2026-03-15', '2026-03-15', -85.50, now(), now()),

-- ── Local 123 members ────────────────────────────────────────────────────────
--   -- Bob Smith (user_3BP6IlC0zg9MwHJDDNn7KCcR0MV) — paid through Feb, March pending
--   ('dl-l123-bob-2025-10', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-10-01', '2025-10-01', 65.00, now(), now()),
--   ('dl-l123-bob-2025-10p', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
--   ('dl-l123-bob-2025-11', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-11-01', '2025-11-01', 65.00, now(), now()),
--   ('dl-l123-bob-2025-11p', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
--   ('dl-l123-bob-2025-12', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-12-01', '2025-12-01', 65.00, now(), now()),
--   ('dl-l123-bob-2025-12p', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
--   ('dl-l123-bob-2026-01', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-01-01', '2026-01-01', 65.00, now(), now()),
--   ('dl-l123-bob-2026-01p', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2026-01-15', '2026-01-15', -65.00, now(), now()),
--   ('dl-l123-bob-2026-02', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-02-01', '2026-02-01', 65.00, now(), now()),
--   ('dl-l123-bob-2026-02p', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2026-02-15', '2026-02-15', -65.00, now(), now()),
--   ('dl-l123-bob-2026-03', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-03-01', '2026-03-01', 65.00, now(), now()),

--   -- Alice Johnson (user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8) — fully paid through March
--   ('dl-l123-alice-2025-10', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-10-01', '2025-10-01', 65.00, now(), now()),
--   ('dl-l123-alice-2025-10p', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
--   ('dl-l123-alice-2025-11', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-11-01', '2025-11-01', 65.00, now(), now()),
--   ('dl-l123-alice-2025-11p', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
--   ('dl-l123-alice-2025-12', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-12-01', '2025-12-01', 65.00, now(), now()),
--   ('dl-l123-alice-2025-12p', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
--   ('dl-l123-alice-2026-01', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-01-01', '2026-01-01', 65.00, now(), now()),
--   ('dl-l123-alice-2026-01p', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2026-01-15', '2026-01-15', -65.00, now(), now()),
--   ('dl-l123-alice-2026-02', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-02-01', '2026-02-01', 65.00, now(), now()),
--   ('dl-l123-alice-2026-02p', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2026-02-15', '2026-02-15', -65.00, now(), now()),
--   ('dl-l123-alice-2026-03', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-03-01', '2026-03-01', 65.00, now(), now()),
--   ('dl-l123-alice-2026-03p', 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2026-03-15', '2026-03-15', -65.00, now(), now()),

--   -- Grace Lee (user_3BP6IkK6vgBW4XjSTqfd3CsBjjv) — paid through Dec 2025, Jan-Mar outstanding (arrears)
--   ('dl-l123-grace-2025-10', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-10-01', '2025-10-01', 65.00, now(), now()),
--   ('dl-l123-grace-2025-10p', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
--   ('dl-l123-grace-2025-11', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-11-01', '2025-11-01', 65.00, now(), now()),
--   ('dl-l123-grace-2025-11p', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
--   ('dl-l123-grace-2025-12', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-12-01', '2025-12-01', 65.00, now(), now()),
--   ('dl-l123-grace-2025-12p', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
--   ('dl-l123-grace-2026-01', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-01-01', '2026-01-01', 65.00, now(), now()),
--   ('dl-l123-grace-2026-02', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-02-01', '2026-02-01', 65.00, now(), now()),
--   ('dl-l123-grace-2026-03', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-03-01', '2026-03-01', 65.00, now(), now()),

--   -- Marie-Claire Dubois (user_3BSzhd4q6moCIlT3PhkWbdiAhtA) — paid through Feb, March pending
--   ('dl-l123-mc-2025-10', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-10-01', '2025-10-01', 65.00, now(), now()),
--   ('dl-l123-mc-2025-10p', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-10-15', '2025-10-15', -65.00, now(), now()),
--   ('dl-l123-mc-2025-11', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-11-01', '2025-11-01', 65.00, now(), now()),
--   ('dl-l123-mc-2025-11p', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-11-15', '2025-11-15', -65.00, now(), now()),
--   ('dl-l123-mc-2025-12', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2025-12-01', '2025-12-01', 65.00, now(), now()),
--   ('dl-l123-mc-2025-12p', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2025-12-15', '2025-12-15', -65.00, now(), now()),
--   ('dl-l123-mc-2026-01', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-01-01', '2026-01-01', 65.00, now(), now()),
--   ('dl-l123-mc-2026-01p', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2026-01-15', '2026-01-15', -65.00, now(), now()),
--   ('dl-l123-mc-2026-02', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-02-01', '2026-02-01', 65.00, now(), now()),
--   ('dl-l123-mc-2026-02p', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'payment', '2026-02-15', '2026-02-15', -65.00, now(), now()),
--   ('dl-l123-mc-2026-03', 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'charge', '2026-03-01', '2026-03-01', 65.00, now(), now())
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Seed: Pension Contributions + Dues Rates + Dues Ledger (STAGING DB)
-- ============================================================================
-- Org IDs (staging):
--   CLC:       5ecb17ab-b5de-442e-a46f-93778ee496aa
--   CAPE:      885aa4e0-5dc1-45bf-ad32-86477868e8ea
--   Local 123: 4a20966a-2f17-46b5-9b84-b3efea57b50a

-- ============================================================================
-- 1. PENSION CONTRIBUTIONS — Local 123 (CLC + CAPE already seeded on staging)
-- ============================================================================
INSERT INTO pension_contributions (organization_id, member_id, member_name, period, amount, payment_status, payment_date)
VALUES
  -- Alice Johnson — $68k → ~$566.67/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '438aa7df-943f-4e4f-b5a3-e599f68076d9', 'Alice Johnson', '2025-10', 566.67, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '438aa7df-943f-4e4f-b5a3-e599f68076d9', 'Alice Johnson', '2025-11', 566.67, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '438aa7df-943f-4e4f-b5a3-e599f68076d9', 'Alice Johnson', '2025-12', 566.67, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '438aa7df-943f-4e4f-b5a3-e599f68076d9', 'Alice Johnson', '2026-01', 566.67, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '438aa7df-943f-4e4f-b5a3-e599f68076d9', 'Alice Johnson', '2026-02', 566.67, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '438aa7df-943f-4e4f-b5a3-e599f68076d9', 'Alice Johnson', '2026-03', 566.67, 'pending', NULL),
  -- Bob Smith — $72k → ~$600/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'afbd6f41-867a-4ba7-93f3-467064509f50', 'Bob Smith', '2025-10', 600.00, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'afbd6f41-867a-4ba7-93f3-467064509f50', 'Bob Smith', '2025-11', 600.00, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'afbd6f41-867a-4ba7-93f3-467064509f50', 'Bob Smith', '2025-12', 600.00, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'afbd6f41-867a-4ba7-93f3-467064509f50', 'Bob Smith', '2026-01', 600.00, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'afbd6f41-867a-4ba7-93f3-467064509f50', 'Bob Smith', '2026-02', 600.00, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'afbd6f41-867a-4ba7-93f3-467064509f50', 'Bob Smith', '2026-03', 600.00, 'pending', NULL),
  -- Grace Lee — $58k → ~$483.33/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '90114b64-7e4d-4ca7-a554-f4f16e5d36be', 'Grace Lee', '2025-10', 483.33, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '90114b64-7e4d-4ca7-a554-f4f16e5d36be', 'Grace Lee', '2025-11', 483.33, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '90114b64-7e4d-4ca7-a554-f4f16e5d36be', 'Grace Lee', '2025-12', 483.33, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '90114b64-7e4d-4ca7-a554-f4f16e5d36be', 'Grace Lee', '2026-01', 483.33, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '90114b64-7e4d-4ca7-a554-f4f16e5d36be', 'Grace Lee', '2026-02', 483.33, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '90114b64-7e4d-4ca7-a554-f4f16e5d36be', 'Grace Lee', '2026-03', 483.33, 'pending', NULL),
  -- Marie-Claire Dubois — $74k → ~$616.67/mo
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cd04ce90-60f6-45dc-b132-949a7a4ce8ee', 'Marie-Claire Dubois', '2025-10', 616.67, 'received', '2025-10-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cd04ce90-60f6-45dc-b132-949a7a4ce8ee', 'Marie-Claire Dubois', '2025-11', 616.67, 'received', '2025-11-30'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cd04ce90-60f6-45dc-b132-949a7a4ce8ee', 'Marie-Claire Dubois', '2025-12', 616.67, 'received', '2025-12-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cd04ce90-60f6-45dc-b132-949a7a4ce8ee', 'Marie-Claire Dubois', '2026-01', 616.67, 'received', '2026-01-31'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cd04ce90-60f6-45dc-b132-949a7a4ce8ee', 'Marie-Claire Dubois', '2026-02', 616.67, 'received', '2026-02-28'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cd04ce90-60f6-45dc-b132-949a7a4ce8ee', 'Marie-Claire Dubois', '2026-03', 616.67, 'pending', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. DUES RATES — Fix 2 existing placeholder rows + add 4 new
-- ============================================================================
-- Fix existing malformed CLC row
UPDATE dues_rates
  SET rate_name = 'Standard Monthly Dues', rate_type = 'monthly', amount = 72.00, updated_at = now()
  WHERE id = '8b5e819c-7681-492c-a69f-7e92d046ab94';

-- Fix existing malformed CAPE row
UPDATE dues_rates
  SET rate_name = 'Standard Monthly Dues', rate_type = 'monthly', amount = 85.50, updated_at = now()
  WHERE id = 'f5e29bec-4603-4037-82e2-a75da2b97e49';

-- Add initiation fees for CLC + CAPE, plus both rates for Local 123
INSERT INTO dues_rates (id, organization_id, rate_name, rate_type, amount, created_at, updated_at)
VALUES
  ('d2000001-0001-4000-a000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'Initiation Fee', 'initiation', 150.00, now(), now()),
  ('d2000002-0001-4000-a000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Initiation Fee', 'initiation', 200.00, now(), now()),
  ('d2000003-0001-4000-a000-000000000001', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Standard Monthly Dues', 'monthly', 65.00, now(), now()),
  ('d2000003-0001-4000-a000-000000000002', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Initiation Fee', 'initiation', 125.00, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. MEMBER DUES LEDGER — uses organization_members.id (UUID) as user_id
-- ============================================================================
-- Staging org member UUIDs:
--   CLC:  Hassan=e0520533  Marie Clarke=77e9fc8c  Denis=1cfbe144
--   CAPE: Greg=c66bf357    Brian=f77497e7          Nadia=68b21cde
--   L123: Bob=2f5bdfe0     Alice=beb4a1d7          Grace=0c00e070  MC=8653b21c

-- Fix: ensure member_dues_ledger.id has a default
ALTER TABLE member_dues_ledger ALTER COLUMN id SET DEFAULT gen_random_uuid();

INSERT INTO member_dues_ledger (user_id, organization_id, transaction_type, transaction_date, effective_date, amount, created_at, updated_at)
VALUES
  -- ── CLC: Hassan Yussuff — paid through Feb, March pending ──────────────
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-10-01', '2025-10-01',  72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-11-01', '2025-11-01',  72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-12-01', '2025-12-01',  72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-01-01', '2026-01-01',  72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-02-01', '2026-02-01',  72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
  ('e0520533-4ae7-4f37-9a8f-849d8de866f9', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-03-01', '2026-03-01',  72.00, now(), now()),

  -- ── CLC: Marie Clarke Walker — fully paid ──────────────────────────────
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-10-01', '2025-10-01',  72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-11-01', '2025-11-01',  72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-12-01', '2025-12-01',  72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-01-01', '2026-01-01',  72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-02-01', '2026-02-01',  72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-03-01', '2026-03-01',  72.00, now(), now()),
  ('77e9fc8c-e15c-45f5-8359-583878979e38', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-03-15', '2026-03-15', -72.00, now(), now()),

  -- ── CLC: Denis Bolduc — paid through Feb, March pending ────────────────
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-10-01', '2025-10-01',  72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-10-15', '2025-10-15', -72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-11-01', '2025-11-01',  72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-11-15', '2025-11-15', -72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2025-12-01', '2025-12-01',  72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2025-12-15', '2025-12-15', -72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-01-01', '2026-01-01',  72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-01-15', '2026-01-15', -72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-02-01', '2026-02-01',  72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payment', '2026-02-15', '2026-02-15', -72.00, now(), now()),
  ('1cfbe144-9ded-4e4e-9957-0e35c6390439', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'charge',  '2026-03-01', '2026-03-01',  72.00, now(), now()),

  -- ── CAPE: Greg Phillips — paid through Feb, March pending ──────────────
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-10-01', '2025-10-01',  85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-11-01', '2025-11-01',  85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-12-01', '2025-12-01',  85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-01-01', '2026-01-01',  85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-02-01', '2026-02-01',  85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-02-15', '2026-02-15', -85.50, now(), now()),
  ('c66bf357-4ea0-4e9c-93df-bff77a408fe8', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-03-01', '2026-03-01',  85.50, now(), now()),

  -- ── CAPE: Brian Faulkner — arrears Feb-Mar ─────────────────────────────
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-10-01', '2025-10-01',  85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-11-01', '2025-11-01',  85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-12-01', '2025-12-01',  85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-01-01', '2026-01-01',  85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-02-01', '2026-02-01',  85.50, now(), now()),
  ('f77497e7-a6ee-4d63-bfee-5db5fca94c3b', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-03-01', '2026-03-01',  85.50, now(), now()),

  -- ── CAPE: Nadia Ouellet — fully paid through March ─────────────────────
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-10-01', '2025-10-01',  85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-10-15', '2025-10-15', -85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-11-01', '2025-11-01',  85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-11-15', '2025-11-15', -85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2025-12-01', '2025-12-01',  85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2025-12-15', '2025-12-15', -85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-01-01', '2026-01-01',  85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-01-15', '2026-01-15', -85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-02-01', '2026-02-01',  85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-02-15', '2026-02-15', -85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'charge',  '2026-03-01', '2026-03-01',  85.50, now(), now()),
  ('68b21cde-b86c-4e23-aaf6-93f87677642d', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'payment', '2026-03-15', '2026-03-15', -85.50, now(), now()),

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

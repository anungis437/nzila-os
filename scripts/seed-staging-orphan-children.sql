-- seed-staging-orphan-children.sql
-- Seeds the 14 child tables whose parent tables already exist with data.

-- ============================================================
-- 1. ALERT TABLES (FK → alert_rules)
-- ============================================================

INSERT INTO alert_actions (id, created_at, updated_at, alert_rule_id) VALUES
  ('e1000001-0001-4000-8000-000000000001', now(), now(), '9deebd43-b573-48e8-8bc5-7c5d482e5542'),
  ('e1000001-0001-4000-8000-000000000002', now(), now(), '7f09158c-203e-4b01-9111-17c17bc1bb00')
ON CONFLICT DO NOTHING;

INSERT INTO alert_conditions (id, created_at, updated_at, alert_rule_id) VALUES
  ('e1000002-0001-4000-8000-000000000001', now(), now(), '9deebd43-b573-48e8-8bc5-7c5d482e5542'),
  ('e1000002-0001-4000-8000-000000000002', now(), now(), '7f09158c-203e-4b01-9111-17c17bc1bb00')
ON CONFLICT DO NOTHING;

INSERT INTO alert_executions (id, created_at, updated_at, alert_rule_id) VALUES
  ('e1000003-0001-4000-8000-000000000001', now(), now(), '9deebd43-b573-48e8-8bc5-7c5d482e5542'),
  ('e1000003-0001-4000-8000-000000000002', now(), now(), '7f09158c-203e-4b01-9111-17c17bc1bb00')
ON CONFLICT DO NOTHING;

INSERT INTO alert_recipients (id, created_at, updated_at, alert_rule_id) VALUES
  ('e1000004-0001-4000-8000-000000000001', now(), now(), '9deebd43-b573-48e8-8bc5-7c5d482e5542'),
  ('e1000004-0001-4000-8000-000000000002', now(), now(), '7f09158c-203e-4b01-9111-17c17bc1bb00')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. AWARD HISTORY (FK → award_templates)
-- ============================================================

INSERT INTO award_history (id, created_at, updated_at, template_id, recipient_id) VALUES
  ('e1000005-0001-4000-8000-000000000001', now(), now(), 'e14de570-c264-4485-abb4-175921feecfa', 'member-001'),
  ('e1000005-0001-4000-8000-000000000002', now(), now(), '860513fa-b7ff-45e8-8d6e-044e6f0cd720', 'member-002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. BREAK GLASS ACTIVATIONS (FK → emergency_declarations)
-- ============================================================

INSERT INTO break_glass_activations (id, created_at, updated_at, emergency_id, activation_initiated_at, activation_reason, required_signatures, signatures_received) VALUES
  ('e1000006-0001-4000-8000-000000000001', now(), now(), 'e66689a1-2d9a-46b6-a671-432d19f6c7d8', now() - interval '1 day', 'Critical system access needed for security patch', 2, 2),
  ('e1000006-0001-4000-8000-000000000002', now(), now(), '1d895449-9059-411d-982e-8eaee2f6f1e0', now() - interval '3 days', 'Emergency financial system access for audit', 2, 1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. BUDGET RESERVATIONS (FK → budget_pool)
-- ============================================================

INSERT INTO budget_reservations (id, created_at, updated_at, pool_id, reserved_amount, status) VALUES
  ('e1000007-0001-4000-8000-000000000001', now(), now(), '0da5bc78-f9f8-496c-ba25-dc7f09a14543', 5000, 'active'),
  ('e1000007-0001-4000-8000-000000000002', now(), now(), '6cbb2a48-d71c-4a32-9050-1e29b51cb5ab', 3500, 'pending')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. EMPLOYMENT HISTORY (FK → organization_members, organizations, member_employment)
-- ============================================================

INSERT INTO employment_history (id, created_at, updated_at, member_id, organization_id, member_employment_id, change_type) VALUES
  ('e1000008-0001-4000-8000-000000000001', now(), now(), '5707857c-8d20-495d-bf7b-d64df44076b6', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '01000001-0001-4000-8000-000000000001', 'hire'),
  ('e1000008-0001-4000-8000-000000000002', now(), now(), '6bab3d9b-2e08-4ce1-84c0-d2d27579ffd3', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '01000001-0001-4000-8000-000000000002', 'promotion')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. FIREWALL ACCESS RULES (FK → data_classification_registry)
-- ============================================================

INSERT INTO firewall_access_rules (id, created_at, updated_at, data_type_id, rule_name, user_role, access_permitted, justification_required, requires_approval) VALUES
  ('e1000009-0001-4000-8000-000000000001', now(), now(), '207dbfb6-a811-4107-9237-6a93df2076cd', 'PII Read Access', 'admin', true, true, true),
  ('e1000009-0001-4000-8000-000000000002', now(), now(), '34c2b655-8a5f-4d28-a599-eb000e3d43d0', 'Financial Data Read', 'finance_officer', true, false, false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. SEGMENT EXECUTIONS (FK → member_segments)
-- ============================================================

INSERT INTO segment_executions (id, created_at, updated_at, segment_id) VALUES
  ('e100000a-0001-4000-8000-000000000001', now(), now(), '69716437-b359-41d3-bc4b-fa1c51e07245'),
  ('e100000a-0001-4000-8000-000000000002', now(), now(), '87006994-e31f-40b4-825b-e4ad255b5306')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. SEPARATED PAYMENT TRANSACTIONS (FK → stripe_connect_accounts, payment_routing_rules)
-- ============================================================

INSERT INTO separated_payment_transactions (id, created_at, updated_at, routed_to_account_id, routing_rule_id, transaction_date, payment_type, payment_category, payment_amount, payment_currency, payer_id, payer_email, routed_to_account_type, separation_enforced, correct_account_used, payment_status) VALUES
  ('e100000b-0001-4000-8000-000000000001', now(), now(), 'dd000001-0001-4000-8000-000000000001', 'a6c4c6d7-f33c-41f1-8612-3a518e37d227', now() - interval '5 days', 'dues', 'membership', '150.00', 'CAD', 'member-001', 'member001@cape.org', 'general', true, true, 'completed'),
  ('e100000b-0001-4000-8000-000000000002', now(), now(), 'dd000001-0001-4000-8000-000000000002', '4089d718-5612-4ea3-a3ec-37bc208edad1', now() - interval '2 days', 'donation', 'political', '75.00', 'CAD', 'member-002', 'member002@clc.org', 'political', true, true, 'completed')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. TICKET COMMENTS + TICKET HISTORY (FK → support_tickets)
-- ============================================================

INSERT INTO ticket_comments (id, created_at, updated_at, ticket_id) VALUES
  ('e100000c-0001-4000-8000-000000000001', now(), now(), '2dd96b87-d5f5-44c6-b0a2-2ce11de4e7bd'),
  ('e100000c-0001-4000-8000-000000000002', now(), now(), '03776488-6570-4871-91a1-2044756a8757')
ON CONFLICT DO NOTHING;

INSERT INTO ticket_history (id, created_at, updated_at, ticket_id) VALUES
  ('e100000d-0001-4000-8000-000000000001', now(), now(), '2dd96b87-d5f5-44c6-b0a2-2ce11de4e7bd'),
  ('e100000d-0001-4000-8000-000000000002', now(), now(), '03776488-6570-4871-91a1-2044756a8757')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. WORKFLOW EXECUTIONS (FK → workflow_definitions)
-- ============================================================

INSERT INTO workflow_executions (id, created_at, updated_at, workflow_definition_id) VALUES
  ('e100000e-0001-4000-8000-000000000001', now(), now(), '18f9c399-0831-465d-a5ca-61200c391879'),
  ('e100000e-0001-4000-8000-000000000002', now(), now(), '493707b4-fd02-496b-8cde-258e6cbe1192')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Seed: Dashboard Widget Data (claim_deadlines, deadline_rules, audit_logs,
--        in_app_notifications) + fill data gaps for CLC/CUPE National
-- Covers: Local 123, CAPE, CLC, CUPE National
-- =============================================================================
BEGIN;

-- Org IDs  (organizations table)
-- Local 123:      4a20966a-2f17-46b5-9b84-b3efea57b50a
-- CAPE:           c09173ad-5ba4-498e-a483-b371fb5e248e
-- CLC:            873cf59b-cef5-4d51-9a62-151512810449
-- CUPE National:  9210418f-6a4f-4dab-a7d2-4450d581dc81

-- =============================================================================
-- 0. Ensure CLC and CUPE National exist in "orgs" table (needed for documents FK)
-- =============================================================================
INSERT INTO orgs (id, legal_name, jurisdiction, status)
VALUES
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid, 'Canadian Labour Congress', 'CA-ON', 'active'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid, 'Canadian Union of Public Employees', 'CA-ON', 'active')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 1. CLAIMS for CLC (currently 0)
--    Required NOT NULL: claim_id, is_anonymous, previously_reported,
--                       witnesses_present, progress, priority, status, created_at
-- =============================================================================
INSERT INTO claims (
  id, claim_id, claim_number, organization_id, description,
  status, priority, claim_type,
  is_anonymous, previously_reported, witnesses_present, progress,
  created_at, updated_at, filed_date
) VALUES
  ('b0c10001-0001-4000-8000-000000000001'::uuid, 'a0c10001-0001-4000-8000-000000000001'::uuid, 'CLC-2026-001',
   '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Members in Transport Division report unpaid overtime for Q4 2025 shifts.',
   'under_review', 'high', 'wage_dispute',
   false, false, true, 25,
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '12 days'),
  ('b0c10001-0001-4000-8000-000000000002'::uuid, 'a0c10001-0001-4000-8000-000000000002'::uuid, 'CLC-2026-002',
   '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Employer failed to provide mandatory PPE as per Article 14.3 of the CBA.',
   'investigation', 'critical', 'workplace_safety',
   false, true, true, 40,
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '8 days'),
  ('b0c10001-0001-4000-8000-000000000003'::uuid, 'a0c10001-0001-4000-8000-000000000003'::uuid, 'CLC-2026-003',
   '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Three members denied vacation carry-over contrary to collective agreement terms.',
   'submitted', 'medium', 'contract_dispute',
   false, false, false, 0,
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- =============================================================================
-- 2. DEADLINE RULES (templates that define standard deadlines)
--    Required NOT NULL: event_type, business_days_only, allows_extension,
--       max_extension_days, requires_approval, escalation_delay_days, is_active, is_system_rule
-- =============================================================================
INSERT INTO deadline_rules (
  id, created_at, updated_at, organization_id,
  rule_name, rule_code, description, claim_type, priority_level,
  days_from_event, event_type, business_days_only,
  allows_extension, max_extension_days, requires_approval,
  is_active, is_system_rule
) VALUES
  -- Local 123
  (gen_random_uuid(), NOW(), NOW(), '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Initial Response', 'INIT_RESP', 'Employer must acknowledge claim within 5 business days',
   NULL, 'high', 5, 'claim_filed', true,
   false, 0, false, true, false),
  (gen_random_uuid(), NOW(), NOW(), '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Investigation Completion', 'INV_COMP', 'Investigation must be completed within 15 business days',
   NULL, 'medium', 15, 'investigation_started', true,
   true, 10, false, true, false),
  (gen_random_uuid(), NOW(), NOW(), '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Final Resolution', 'FINAL_RES', 'Claim must be resolved within 30 calendar days',
   NULL, 'high', 30, 'claim_filed', false,
   true, 15, true, true, false),
  -- CAPE
  (gen_random_uuid(), NOW(), NOW(), 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Initial Response', 'INIT_RESP', 'Employer must acknowledge claim within 5 business days',
   NULL, 'high', 5, 'claim_filed', true,
   false, 0, false, true, false),
  (gen_random_uuid(), NOW(), NOW(), 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Arbitration Filing', 'ARB_FILE', 'Arbitration must be filed within 45 calendar days',
   NULL, 'critical', 45, 'grievance_denied', false,
   false, 0, true, true, false),
  -- CLC
  (gen_random_uuid(), NOW(), NOW(), '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Initial Response', 'INIT_RESP', 'Employer must acknowledge claim within 5 business days',
   NULL, 'high', 5, 'claim_filed', true,
   false, 0, false, true, false),
  (gen_random_uuid(), NOW(), NOW(), '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Investigation Completion', 'INV_COMP', 'Investigation must be completed within 10 business days',
   NULL, 'medium', 10, 'investigation_started', true,
   true, 5, false, true, false),
  -- CUPE National
  (gen_random_uuid(), NOW(), NOW(), '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid,
   'Initial Response', 'INIT_RESP', 'Employer must acknowledge claim within 5 business days',
   NULL, 'high', 5, 'claim_filed', true,
   false, 0, false, true, false),
  (gen_random_uuid(), NOW(), NOW(), '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid,
   'Final Resolution', 'FINAL_RES', 'Claim must be resolved within 30 calendar days',
   NULL, 'high', 30, 'claim_filed', false,
   true, 15, true, true, false);

-- =============================================================================
-- 3. CLAIM DEADLINES (actual deadlines tied to existing claims)
-- =============================================================================
INSERT INTO claim_deadlines (id, created_at, updated_at, claim_id, organization_id, deadline_name, deadline_type, event_date, original_deadline, due_date, status, priority, is_overdue, days_until_due, days_overdue) VALUES
  -- Local 123: claim 12111956 (investigation, critical) — overdue
  (gen_random_uuid(), NOW(), NOW(),
   '12111956-89f9-4f27-9f6a-b8ca4be2d9d0'::uuid, '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Initial Response Due', 'initial_response',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days',
   'pending', 'high', true, -7, 7),
  -- Local 123: claim 15594a30 (under_review, medium) — due soon
  (gen_random_uuid(), NOW(), NOW(),
   '15594a30-3782-4c8e-bf59-bf55f5523f6a'::uuid, '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Documentation Deadline', 'investigation',
   NOW() - INTERVAL '10 days', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days',
   'pending', 'medium', false, 2, 0),
  -- Local 123: claim 9b2837cf (submitted, high) — on time, future
  (gen_random_uuid(), NOW(), NOW(),
   '9b2837cf-6357-4f3c-8f53-2f7120dc56a1'::uuid, '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Final Resolution Due', 'resolution',
   NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', NOW() + INTERVAL '25 days',
   'pending', 'high', false, 25, 0),
  -- Local 123: completed deadline (for on-time % calculation)
  (gen_random_uuid(), NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days',
   '15594a30-3782-4c8e-bf59-bf55f5523f6a'::uuid, '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Claim Acknowledgement', 'initial_response',
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days',
   'completed', 'high', false, 0, 0),

  -- CAPE: claim d79ab6bc (investigation, high) — overdue critical
  (gen_random_uuid(), NOW(), NOW(),
   'd79ab6bc-a4ed-42be-a18c-ca0a252fdcca'::uuid, 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Investigation Report Due', 'investigation',
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days',
   'pending', 'critical', true, -5, 5),
  -- CAPE: claim ef39fda9 (under_review, critical) — due tomorrow
  (gen_random_uuid(), NOW(), NOW(),
   'ef39fda9-4de8-4f1e-bc22-316b0c69fb59'::uuid, 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Arbitration Filing Deadline', 'arbitration',
   NOW() - INTERVAL '10 days', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day',
   'pending', 'critical', false, 1, 0),
  -- CAPE: completed on-time
  (gen_random_uuid(), NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days',
   'b861b0c3-0128-43d7-84f9-7de3f2e2370a'::uuid, 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Initial Response', 'initial_response',
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days',
   'completed', 'high', false, 0, 0),

  -- CLC: claim b0c10001-...-01 (under_review, high) — overdue
  (gen_random_uuid(), NOW(), NOW(),
   'b0c10001-0001-4000-8000-000000000001'::uuid, '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Initial Response Due', 'initial_response',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days',
   'pending', 'high', true, -5, 5),
  -- CLC: claim b0c10001-...-02 (investigation, critical) — due in 3 days
  (gen_random_uuid(), NOW(), NOW(),
   'b0c10001-0001-4000-8000-000000000002'::uuid, '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Safety Report Due', 'investigation',
   NOW() - INTERVAL '8 days', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days',
   'pending', 'critical', false, 3, 0),

  -- CUPE National: claim dc05145e (assigned, high) — pending
  (gen_random_uuid(), NOW(), NOW(),
   'dc05145e-8739-4d23-898a-99474081f51f'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid,
   'Investigation Completion', 'investigation',
   NOW() - INTERVAL '6 days', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days',
   'pending', 'medium', false, 14, 0),
  -- CUPE National: claim d36a17ff (submitted, medium) — overdue
  (gen_random_uuid(), NOW(), NOW(),
   'd36a17ff-74dd-4066-b9db-3d81b5bf3ab5'::uuid, '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid,
   'Initial Response Due', 'initial_response',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
   'pending', 'high', true, -3, 3);

-- Set completed_at for completed deadlines
UPDATE claim_deadlines SET completed_at = due_date WHERE status = 'completed' AND completed_at IS NULL;

-- =============================================================================
-- 4. AUDIT LOGS (recent activity for each org)
-- =============================================================================
INSERT INTO audit_security.audit_logs (organization_id, user_id, action, resource_type, resource_id, severity, outcome, metadata, created_at) VALUES
  -- Local 123
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid, 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'create', 'claim', '9b2837cf-6357-4f3c-8f53-2f7120dc56a1'::uuid, 'info', 'success',
   '{"description": "Filed new claim: Workplace Safety Concern", "claimNumber": "CLM-2026-003"}'::jsonb, NOW() - INTERVAL '5 days'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid, 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'status_change', 'claim', '15594a30-3782-4c8e-bf59-bf55f5523f6a'::uuid, 'info', 'success',
   '{"description": "Moved claim to Under Review", "claimNumber": "CLM-2026-002", "from": "submitted", "to": "under_review"}'::jsonb, NOW() - INTERVAL '4 days'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid, 'usr-l123-005', 'update', 'member', NULL, 'info', 'success',
   '{"description": "Updated member contact information"}'::jsonb, NOW() - INTERVAL '3 days'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid, 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'assign', 'claim', '12111956-89f9-4f27-9f6a-b8ca4be2d9d0'::uuid, 'info', 'success',
   '{"description": "Assigned claim to investigator", "claimNumber": "CLM-2026-001", "assignee": "J. Martin"}'::jsonb, NOW() - INTERVAL '2 days'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid, 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'create', 'document', NULL, 'info', 'success',
   '{"description": "Uploaded evidence document for CLM-2026-001"}'::jsonb, NOW() - INTERVAL '1 day'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid, 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', 'login', 'member', NULL, 'info', 'success',
   '{"description": "Member logged in to portal"}'::jsonb, NOW() - INTERVAL '6 hours'),

  -- CAPE
  ('c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid, 'cape-user-001', 'create', 'claim', 'c2c9affd-15ff-46a6-8729-8ff46269e591'::uuid, 'info', 'success',
   '{"description": "Filed new claim: Pay Equity Review", "claimNumber": "CAPE-2026-005"}'::jsonb, NOW() - INTERVAL '6 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid, 'cape-user-001', 'status_change', 'claim', 'd79ab6bc-a4ed-42be-a18c-ca0a252fdcca'::uuid, 'warning', 'success',
   '{"description": "Escalated claim to senior investigator", "claimNumber": "CAPE-2026-003", "from": "assigned", "to": "investigation"}'::jsonb, NOW() - INTERVAL '4 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid, 'cape-user-002', 'resolve', 'claim', 'b861b0c3-0128-43d7-84f9-7de3f2e2370a'::uuid, 'info', 'success',
   '{"description": "Resolved claim with employer agreement", "claimNumber": "CAPE-2026-001"}'::jsonb, NOW() - INTERVAL '3 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid, 'cape-user-003', 'update', 'grievance', 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f809102'::uuid, 'info', 'success',
   '{"description": "Added supporting documentation to grievance"}'::jsonb, NOW() - INTERVAL '1 day'),

  -- CLC
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid, 'clc-user-001', 'create', 'claim', 'b0c10001-0001-4000-8000-000000000001'::uuid, 'info', 'success',
   '{"description": "Filed overtime pay dispute — Transport Division", "claimNumber": "CLC-2026-001"}'::jsonb, NOW() - INTERVAL '12 days'),
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid, 'clc-user-001', 'create', 'claim', 'b0c10001-0001-4000-8000-000000000002'::uuid, 'critical', 'success',
   '{"description": "Filed safety equipment non-compliance claim", "claimNumber": "CLC-2026-002"}'::jsonb, NOW() - INTERVAL '8 days'),
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid, 'clc-user-002', 'status_change', 'claim', 'b0c10001-0001-4000-8000-000000000002'::uuid, 'info', 'success',
   '{"description": "Moved claim to investigation", "claimNumber": "CLC-2026-002", "from": "submitted", "to": "investigation"}'::jsonb, NOW() - INTERVAL '5 days'),
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid, 'clc-user-001', 'update', 'grievance', '7d98c242-ce53-4da4-af72-64debaa9d1b2'::uuid, 'info', 'success',
   '{"description": "Updated grievance with mediation outcome"}'::jsonb, NOW() - INTERVAL '2 days'),

  -- CUPE National
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid, 'user_35NlrrNcfTv0DMh2kzBHyXZRtpb', 'create', 'claim', 'dc05145e-8739-4d23-898a-99474081f51f'::uuid, 'info', 'success',
   '{"description": "Filed new claim: Policy Violation", "claimNumber": "CUPE-NAT-2026-001"}'::jsonb, NOW() - INTERVAL '6 days'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid, 'user_35NlrrNcfTv0DMh2kzBHyXZRtpb', 'assign', 'claim', 'dc05145e-8739-4d23-898a-99474081f51f'::uuid, 'info', 'success',
   '{"description": "Assigned claim to regional representative", "claimNumber": "CUPE-NAT-2026-001"}'::jsonb, NOW() - INTERVAL '4 days'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid, 'user_37Zo7OrvP4jy0J0MU5APfkDtE2V', 'export', 'claim', NULL, 'info', 'success',
   '{"description": "Exported quarterly claims report"}'::jsonb, NOW() - INTERVAL '1 day');

-- =============================================================================
-- 5. IN-APP NOTIFICATIONS (for admin users of each org)
-- =============================================================================
INSERT INTO in_app_notifications (id, created_at, updated_at, user_id, organization_id, title, message, type, action_label, action_url, read) VALUES
  -- Local 123 — admin user
  (gen_random_uuid(), NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour',
   'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Deadline Overdue', 'Initial Response deadline for CLM-2026-001 is 7 days overdue.',
   'error', 'View Claim', '/en/dashboard/claims/12111956-89f9-4f27-9f6a-b8ca4be2d9d0', false),
  (gen_random_uuid(), NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours',
   'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Deadline Approaching', 'Documentation deadline for CLM-2026-002 is due in 2 days.',
   'warning', 'View Claim', '/en/dashboard/claims/15594a30-3782-4c8e-bf59-bf55f5523f6a', false),
  (gen_random_uuid(), NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
   'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'New Claim Filed', 'A new claim (CLM-2026-003) has been submitted for review.',
   'info', 'Review Claim', '/en/dashboard/claims/9b2837cf-6357-4f3c-8f53-2f7120dc56a1', false),
  (gen_random_uuid(), NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
   'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Member Update', 'Member contact information was updated by usr-l123-005.',
   'info', NULL, NULL, true),
  -- Local 123 — member Bob
  (gen_random_uuid(), NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours',
   'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '4a20966a-2f17-46b5-9b84-b3efea57b50a'::uuid,
   'Claim Status Updated', 'Your claim CLM-2026-002 has moved to Under Review.',
   'success', 'View Status', '/en/dashboard/claims/15594a30-3782-4c8e-bf59-bf55f5523f6a', false),

  -- CAPE — admin
  (gen_random_uuid(), NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes',
   'cape-user-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Critical: Arbitration Deadline Tomorrow', 'CAPE-2026-006 arbitration filing deadline is tomorrow.',
   'error', 'View Deadline', '/en/dashboard/deadlines', false),
  (gen_random_uuid(), NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours',
   'cape-user-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Investigation Overdue', 'CAPE-2026-003 investigation report is 5 days overdue.',
   'warning', 'View Claim', '/en/dashboard/claims/d79ab6bc-a4ed-42be-a18c-ca0a252fdcca', false),
  (gen_random_uuid(), NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
   'cape-user-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Claim Resolved', 'CAPE-2026-001 has been resolved with employer agreement.',
   'success', NULL, NULL, true),
  -- CAPE — member
  (gen_random_uuid(), NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours',
   'cape-user-003', 'c09173ad-5ba4-498e-a483-b371fb5e248e'::uuid,
   'Documentation Received', 'Your supporting documents for grievance have been received.',
   'success', NULL, NULL, false),

  -- CLC — admin
  (gen_random_uuid(), NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour',
   'clc-user-001', '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Overdue: Employer Response', 'CLC-2026-001 initial response is 5 days overdue.',
   'error', 'View Claim', '/en/dashboard/claims/a0c10001-0001-4000-8000-000000000001', false),
  (gen_random_uuid(), NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours',
   'clc-user-001', '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Safety Investigation Update', 'CLC-2026-002 safety report is due in 3 days.',
   'warning', 'View Case', '/en/dashboard/claims/a0c10001-0001-4000-8000-000000000002', false),
  (gen_random_uuid(), NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
   'clc-user-001', '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'Grievance Mediation Complete', 'Grievance mediation concluded — settlement terms filed.',
   'success', NULL, NULL, true),

  -- CUPE National — admin
  (gen_random_uuid(), NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours',
   'user_35NlrrNcfTv0DMh2kzBHyXZRtpb', '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid,
   'Deadline Overdue', 'CUPE-NAT-2026-002 initial response is 3 days overdue.',
   'error', 'View Claim', '/en/dashboard/claims/d36a17ff-74dd-4066-b9db-3d81b5bf3ab5', false),
  (gen_random_uuid(), NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
   'user_35NlrrNcfTv0DMh2kzBHyXZRtpb', '9210418f-6a4f-4dab-a7d2-4450d581dc81'::uuid,
   'Report Exported', 'Quarterly claims report has been exported successfully.',
   'info', NULL, NULL, true);

-- =============================================================================
-- 6. DOCUMENTS for CLC (currently 0)
--    org_id is FK to orgs table; organization_id is nullable separate field
--    Required NOT NULL: org_id, category, title, blob_container, blob_path,
--                       content_type, sha256, uploaded_by
-- =============================================================================
INSERT INTO documents (
  org_id, organization_id, category, title,
  blob_container, blob_path, content_type, size_bytes, sha256,
  uploaded_by, classification, created_at, updated_at
) VALUES
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'agreement', 'CLC Collective Bargaining Agreement 2025-2028',
   'documents', 'clc/clc-cba-2025-2028.pdf', 'application/pdf', 2450000,
   'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
   'clc-user-001', 'internal',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'evidence', 'PPE Compliance Photos',
   'documents', 'clc/ppe-evidence-photos.zip', 'application/zip', 8900000,
   'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
   'clc-user-001', 'confidential',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   '873cf59b-cef5-4d51-9a62-151512810449'::uuid,
   'evidence', 'Overtime Dispute - Pay Stubs',
   'documents', 'clc/overtime-pay-stubs-q4.pdf', 'application/pdf', 1200000,
   'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
   'clc-user-002', 'confidential',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

COMMIT;

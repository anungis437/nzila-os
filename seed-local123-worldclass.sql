-- ==================================================================
-- WORLD-CLASS SEED DATA: CUPE LOCAL 123
-- Organization: 4a20966a-2f17-46b5-9b84-b3efea57b50a
-- 
-- Scenario: Municipal workers' union representing ~12 members across
-- Public Works, Parks & Recreation, Building Services, IT, Library,
-- and Community Services. Active steward: Bob Smith.
--
-- This seed creates a rich, realistic dataset spanning 90 days of
-- union case management activity with:
--   - 12 claims across 10+ claim types and all statuses
--   - Proper timelines (incident → filed → assigned → resolution)
--   - Deadlines at various stages (overdue, due today, upcoming, met)
--   - Documents per claim (intake forms, evidence, CBA references)
--   - Granular audit trail (actions → timestamps → users)
--   - Notifications for stewards (Bob, J-P, Priya) and members
--   - Deadline rules matching the collective agreement
-- ==================================================================

BEGIN;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 0. CONSTANTS                                                │
-- └─────────────────────────────────────────────────────────────┘
-- Org
-- Local 123: 4a20966a-2f17-46b5-9b84-b3efea57b50a

-- Users (from organization_members)
-- Bob Smith (steward):          user_3BP6IlC0zg9MwHJDDNn7KCcR0MV
-- Alice Johnson (member):       user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8
-- Grace Lee (admin):            user_3BP6IkK6vgBW4XjSTqfd3CsBjjv
-- Marie-Claire Dubois (member): user_3BSzhd4q6moCIlT3PhkWbdiAhtA
-- J-P Tremblay (steward):       usr-l123-005
-- Priya Sharma (steward):       usr-l123-010
-- David Okafor (member):        usr-l123-007
-- Fatima Al-Rashid (member):    usr-l123-006
-- Sophie Martin (member):       usr-l123-008
-- Carlos Vega (member):         usr-l123-009
-- Liam Chen (member):           usr-l123-011
-- Isabelle Nguyen (member):     usr-l123-012

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 1. CLEAN EXISTING DATA (idempotent re-seed)                 │
-- └─────────────────────────────────────────────────────────────┘
DELETE FROM in_app_notifications WHERE organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
DELETE FROM audit_security.audit_logs WHERE organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
DELETE FROM claim_deadlines WHERE organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
DELETE FROM deadline_rules WHERE organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
DELETE FROM documents WHERE organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';
DELETE FROM claims WHERE organization_id = '4a20966a-2f17-46b5-9b84-b3efea57b50a';

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 2. CLAIMS — 12 realistic cases across the lifecycle         │
-- └─────────────────────────────────────────────────────────────┘

-- CLAIM 1: Forced overtime — SUBMITTED (new, high priority)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at)
VALUES (
  'a1000001-0001-4000-8000-000000000001', gen_random_uuid(), 'L123-2026-001', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-007', NULL, 'grievance_schedule', 'submitted', 'high',
  'Forced overtime on statutory holiday (Good Friday) without proper 48-hour notice as required by Article 15.3 of the collective agreement. Member David Okafor was told at 4:45 PM on Thursday that he must report at 7:00 AM Friday for emergency road repair.',
  'Payment at 2x overtime rate per Article 15.5; written commitment from management to respect notice requirements.',
  false, false, true, 10,
  NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
);

-- CLAIM 2: Family leave denied — UNDER_REVIEW (assigned to Bob)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at)
VALUES (
  'a1000001-0002-4000-8000-000000000002', gen_random_uuid(), 'L123-2026-002', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-006', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'grievance_leave', 'under_review', 'medium',
  'Family responsibility leave denied for child''s emergency dental surgery. Manager cited "staffing shortages" but Article 21.4 guarantees up to 5 days family leave per year. Member Fatima Al-Rashid has used 0 of 5 days this year.',
  'Retroactive approval of 1 day family leave; removal of absence notation from personnel file.',
  false, false, false, 30,
  NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '3 days'
);

-- CLAIM 3: Sexual harassment — INVESTIGATION (critical, assigned to J-P)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, witness_details, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score)
VALUES (
  'a1000001-0003-4000-8000-000000000003', gen_random_uuid(), 'L123-2026-003', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-008', 'usr-l123-005', 'harassment_sexual', 'investigation', 'critical',
  'Repeated inappropriate comments and unwanted physical contact from a supervisor in Building Services. Member Sophie Martin reported the behaviour to her direct manager who dismissed the complaint, saying "that''s just how he is." Three incidents documented over 6 weeks.',
  'Full investigation per workplace harassment policy; interim separation of parties; mandatory training for supervisor; formal apology.',
  false, true, true,
  'Two coworkers witnessed the March 12 incident in the break room. Names provided in confidential intake form.',
  45,
  NOW() - INTERVAL '21 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '2 days', 85
);

-- CLAIM 4: Pay discrepancy — ASSIGNED (to Priya)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at)
VALUES (
  'a1000001-0004-4000-8000-000000000004', gen_random_uuid(), 'L123-2026-004', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-009', 'usr-l123-010', 'grievance_pay', 'assigned', 'high',
  'Carlos Vega has not received the negotiated 2.5% wage increase effective January 1, 2026 as per Article 32.1 of the new collective agreement. Payroll shows old rate on all 2026 pay stubs. Estimated underpayment: $1,847.32.',
  'Retroactive payment of $1,847.32 plus interest; correction of ongoing pay rate; written confirmation from payroll.',
  false, false, false, 25,
  NOW() - INTERVAL '45 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '15 days'
);

-- CLAIM 5: Workplace safety — PENDING_DOCUMENTATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, witness_details, progress, incident_date, filed_date, assigned_at, created_at, updated_at)
VALUES (
  'a1000001-0005-4000-8000-000000000005', gen_random_uuid(), 'L123-2026-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-011', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'workplace_safety', 'pending_documentation', 'critical',
  'Liam Chen reported exposed live wires in the server room ceiling at City Hall IT department. JHSC inspection found 4 additional safety violations: improper ventilation, blocked emergency exit, missing fire extinguisher, expired first aid kit. Ontario MOL notified.',
  'Immediate remediation of all 5 violations; WSIB Form 7 filed; temporary relocation of IT staff until repairs completed.',
  false, true, true,
  'JHSC co-chair and building maintenance supervisor both documented violations during March 15 inspection.',
  60,
  NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days'
);

-- CLAIM 6: Age discrimination — UNDER_REVIEW (assigned to Bob)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score)
VALUES (
  'a1000001-0006-4000-8000-000000000006', gen_random_uuid(), 'L123-2026-006', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-012', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'discrimination_age', 'under_review', 'high',
  'Isabelle Nguyen (Library Technician, 28 years seniority) was passed over for the Digital Services Librarian position in favour of a younger external candidate. Job posting required "digital native mindset." Member has completed all relevant training and certifications.',
  'Posting withdrawn and re-posted with non-discriminatory language; interview for member; compensation for wage differential if position is awarded.',
  false, false, false, 35,
  NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '7 days', 72
);

-- CLAIM 7: Verbal harassment — RESOLVED (success story)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at)
VALUES (
  'a1000001-0007-4000-8000-000000000007', gen_random_uuid(), 'L123-2026-007', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'harassment_verbal', 'resolved', 'medium',
  'Alice Johnson reported that a supervisor publicly belittled her work performance in front of colleagues during a team meeting on February 10. Comments included "maybe this job is too much for you" and "I expected more from someone in your position."',
  'Formal apology from supervisor; documentation in supervisor''s file; anti-bullying refresher training.',
  false, false, true, 100,
  NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '39 days', NOW() - INTERVAL '10 days', 'settled',
  NOW() - INTERVAL '40 days', NOW() - INTERVAL '10 days'
);

-- CLAIM 8: Contract dispute (benefits) — RESOLVED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at)
VALUES (
  'a1000001-0008-4000-8000-000000000008', gen_random_uuid(), 'L123-2026-008', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', 'usr-l123-005', 'grievance_benefits', 'resolved', 'medium',
  'Marie-Claire Dubois was denied extended health coverage for physiotherapy following a workplace injury. Benefits administrator claimed treatment was "elective" despite physician referral. Article 28.2 covers medically necessary rehabilitation.',
  'Approval of physiotherapy coverage; reimbursement of $420 out-of-pocket expenses.',
  false, false, false, 100,
  NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days', NOW() - INTERVAL '54 days', NOW() - INTERVAL '25 days', 'settled',
  NOW() - INTERVAL '55 days', NOW() - INTERVAL '25 days'
);

-- CLAIM 9: Schedule grievance — CLOSED (rejected by arbitrator)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, closed_at, resolution_outcome, created_at, updated_at)
VALUES (
  'a1000001-0009-4000-8000-000000000009', gen_random_uuid(), 'L123-2026-009', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-009', 'usr-l123-010', 'grievance_schedule', 'closed', 'low',
  'Carlos Vega requested a permanent shift change from afternoons to days citing childcare. Management denied citing operational needs and seniority provisions in Article 14.7.',
  'Accommodation of day shift schedule.',
  false, false, false, 100,
  NOW() - INTERVAL '75 days', NOW() - INTERVAL '70 days', NOW() - INTERVAL '69 days', NOW() - INTERVAL '20 days', 'rejected',
  NOW() - INTERVAL '70 days', NOW() - INTERVAL '20 days'
);

-- CLAIM 10: Wrongful discipline — INVESTIGATION (assigned to Bob)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score)
VALUES (
  'a1000001-0010-4000-8000-000000000010', gen_random_uuid(), 'L123-2026-010', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-007', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'grievance_discipline', 'investigation', 'high',
  'David Okafor received a 3-day suspension for alleged insubordination after refusing to operate a snowplow with a broken defroster at -22°C. Member cited Ontario Occupational Health & Safety Act right to refuse unsafe work. Employer did not follow proper refusal process per OHSA s.43.',
  'Rescission of suspension; removal from personnel file; full back pay for 3 days; written acknowledgement of OHSA right to refuse.',
  false, false, true, 40,
  NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days', 78
);

-- CLAIM 11: Retaliation — SUBMITTED (brand new, critical)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at)
VALUES (
  'a1000001-0011-4000-8000-000000000011', gen_random_uuid(), 'L123-2026-011', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-008', NULL, 'retaliation', 'submitted', 'critical',
  'Sophie Martin reports that since filing her harassment complaint (L123-2026-003), she has been transferred to a less desirable assignment, excluded from team meetings, and received a negative performance evaluation despite 5 years of "exceeds expectations" ratings. Anti-reprisal provisions of Article 6.8 and Ontario Human Rights Code apply.',
  'Immediate reversal of transfer; rescission of performance evaluation; investigation of supervisor conduct; interim protection measures.',
  false, true, false, 5,
  NOW() - INTERVAL '2 days', NOW(), NOW(), NOW()
);

-- CLAIM 12: Wage dispute (overtime calculation) — ASSIGNED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at)
VALUES (
  'a1000001-0012-4000-8000-000000000012', gen_random_uuid(), 'L123-2026-012', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'usr-l123-006', 'usr-l123-010', 'wage_dispute', 'assigned', 'medium',
  'Fatima Al-Rashid identified systematic miscalculation of overtime for Community Services staff. Overtime calculated on base rate instead of total compensation (including shift premiums) as required by Article 32.6. Affects approximately 8 members over the last 6 months. Estimated total underpayment: $12,340.',
  'Payroll audit of all affected members; retroactive payment with interest; correction of overtime calculation formula.',
  false, false, false, 20,
  NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '10 days'
);

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 3. DEADLINE RULES — CBA-aligned                             │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO deadline_rules (id, organization_id, rule_name, event_type, days_from_event, business_days_only, allows_extension, max_extension_days, is_active, is_system_rule, created_at, updated_at) VALUES
-- Standard grievance deadlines
('b1000001-0001-4000-8000-000000000001', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Acknowledge Receipt',        'claim_filed',          2, true,  false, 0,  true, true, NOW(), NOW()),
('b1000001-0002-4000-8000-000000000002', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Initial Steward Response',   'claim_filed',          5, true,  true,  5,  true, true, NOW(), NOW()),
('b1000001-0003-4000-8000-000000000003', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Step 1 Meeting',             'claim_filed',         10, true,  true,  5,  true, true, NOW(), NOW()),
('b1000001-0004-4000-8000-000000000004', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Step 1 Management Response', 'step1_meeting',        5, true,  false, 0,  true, true, NOW(), NOW()),
('b1000001-0005-4000-8000-000000000005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Step 2 Escalation',          'step1_response',       5, true,  true,  3,  true, true, NOW(), NOW()),
('b1000001-0006-4000-8000-000000000006', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Investigation Completion',   'investigation_started', 15, false, true,  10, true, true, NOW(), NOW()),
('b1000001-0007-4000-8000-000000000007', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Final Resolution',           'claim_filed',          30, false, true,  15, true, true, NOW(), NOW()),
-- Harassment-specific (tighter timelines)
('b1000001-0008-4000-8000-000000000008', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Interim Safety Measures',    'claim_filed',          1, true,  false, 0,  true, true, NOW(), NOW()),
('b1000001-0009-4000-8000-000000000009', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Harassment Investigation',   'investigation_started', 10, false, false, 0,  true, true, NOW(), NOW()),
-- OHSA-specific
('b1000001-0010-4000-8000-000000000010', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'MOL Notification',           'safety_report',         1, true,  false, 0,  true, true, NOW(), NOW()),
('b1000001-0011-4000-8000-000000000011', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'WSIB Form 7 Filing',         'workplace_injury',      3, true,  false, 0,  true, true, NOW(), NOW()),
-- Arbitration
('b1000001-0012-4000-8000-000000000012', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Arbitration Filing',          'step2_denied',         30, false, true,  10, true, true, NOW(), NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 4. CLAIM DEADLINES — mixed statuses for dashboard widget    │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO claim_deadlines (id, claim_id, organization_id, deadline_name, deadline_type, event_date, original_deadline, due_date, status, priority, is_overdue, days_until_due, days_overdue, created_at, updated_at) VALUES
-- Claim 1 (Forced overtime, submitted yesterday)
('c1000001-0001-4000-8000-000000000001', 'a1000001-0001-4000-8000-000000000001', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Acknowledge Receipt', 'initial', NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day',
 'pending', 'high', false, 1, 0, NOW() - INTERVAL '1 day', NOW()),
('c1000001-0002-4000-8000-000000000002', 'a1000001-0001-4000-8000-000000000001', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Steward Assignment', 'assignment', NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days',
 'pending', 'medium', false, 4, 0, NOW() - INTERVAL '1 day', NOW()),

-- Claim 2 (Family leave, under review — due soon)
('c1000001-0003-4000-8000-000000000003', 'a1000001-0002-4000-8000-000000000002', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Step 1 Meeting', 'hearing', NOW() - INTERVAL '6 days', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days',
 'pending', 'high', false, 2, 0, NOW() - INTERVAL '6 days', NOW()),

-- Claim 3 (Sexual harassment, investigation — OVERDUE)
('c1000001-0004-4000-8000-000000000004', 'a1000001-0003-4000-8000-000000000003', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Interim Safety Measures', 'safety', NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days',
 'completed', 'critical', false, 0, 0, NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days'),
('c1000001-0005-4000-8000-000000000005', 'a1000001-0003-4000-8000-000000000003', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Harassment Investigation Complete', 'investigation', NOW() - INTERVAL '13 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
 'pending', 'critical', true, -3, 3, NOW() - INTERVAL '13 days', NOW()),

-- Claim 4 (Pay discrepancy — overdue)
('c1000001-0006-4000-8000-000000000006', 'a1000001-0004-4000-8000-000000000004', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Payroll Audit Completion', 'documentation', NOW() - INTERVAL '28 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days',
 'pending', 'high', true, -5, 5, NOW() - INTERVAL '28 days', NOW()),

-- Claim 5 (Workplace safety — due today)
('c1000001-0007-4000-8000-000000000007', 'a1000001-0005-4000-8000-000000000005', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'MOL Inspection Follow-up', 'compliance', NOW() - INTERVAL '12 days', NOW(), NOW(),
 'pending', 'critical', false, 0, 0, NOW() - INTERVAL '12 days', NOW()),
('c1000001-0008-4000-8000-000000000008', 'a1000001-0005-4000-8000-000000000005', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'WSIB Form 7 Filing', 'compliance', NOW() - INTERVAL '12 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days',
 'completed', 'high', false, 0, 0, NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days'),

-- Claim 6 (Age discrimination — upcoming)
('c1000001-0009-4000-8000-000000000009', 'a1000001-0006-4000-8000-000000000006', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Step 1 Meeting with HR', 'hearing', NOW() - INTERVAL '14 days', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days',
 'pending', 'high', false, 3, 0, NOW() - INTERVAL '14 days', NOW()),

-- Claim 7 (Verbal harassment — RESOLVED, met deadlines)
('c1000001-0010-4000-8000-000000000010', 'a1000001-0007-4000-8000-000000000007', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Initial Response', 'initial', NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days',
 'completed', 'medium', false, 0, 0, NOW() - INTERVAL '40 days', NOW() - INTERVAL '36 days'),
('c1000001-0011-4000-8000-000000000011', 'a1000001-0007-4000-8000-000000000007', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Resolution Meeting', 'hearing', NOW() - INTERVAL '40 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days',
 'completed', 'medium', false, 0, 0, NOW() - INTERVAL '40 days', NOW() - INTERVAL '16 days'),

-- Claim 8 (Benefits — RESOLVED, met deadlines)  
('c1000001-0012-4000-8000-000000000012', 'a1000001-0008-4000-8000-000000000008', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Benefits Review Meeting', 'hearing', NOW() - INTERVAL '54 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days',
 'completed', 'medium', false, 0, 0, NOW() - INTERVAL '54 days', NOW() - INTERVAL '41 days'),

-- Claim 9 (Schedule — CLOSED, missed deadline → arbitration)
('c1000001-0013-4000-8000-000000000013', 'a1000001-0009-4000-8000-000000000009', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Step 2 Response', 'hearing', NOW() - INTERVAL '69 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days',
 'missed', 'medium', false, 0, 0, NOW() - INTERVAL '69 days', NOW() - INTERVAL '50 days'),

-- Claim 10 (Wrongful discipline — upcoming)
('c1000001-0014-4000-8000-000000000014', 'a1000001-0010-4000-8000-000000000010', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Employer Written Response', 'response', NOW() - INTERVAL '6 days', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days',
 'pending', 'high', false, 5, 0, NOW() - INTERVAL '6 days', NOW()),

-- Claim 11 (Retaliation — brand new, urgent)
('c1000001-0015-4000-8000-000000000015', 'a1000001-0011-4000-8000-000000000011', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Interim Protection Order', 'safety', NOW(), NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day',
 'pending', 'critical', false, 1, 0, NOW(), NOW()),

-- Claim 12 (Wage dispute — upcoming)
('c1000001-0016-4000-8000-000000000016', 'a1000001-0012-4000-8000-000000000012', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Payroll Records Request', 'documentation', NOW() - INTERVAL '16 days', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days',
 'pending', 'medium', false, 7, 0, NOW() - INTERVAL '16 days', NOW()),
('c1000001-0017-4000-8000-000000000017', 'a1000001-0012-4000-8000-000000000012', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Step 1 Meeting', 'hearing', NOW() - INTERVAL '16 days', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days',
 'pending', 'medium', false, 14, 0, NOW() - INTERVAL '16 days', NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 5. DOCUMENTS — evidence, CBA references, forms             │
-- └─────────────────────────────────────────────────────────────┘

-- Need org_id from orgs table
INSERT INTO documents (id, org_id, organization_id, title, category, blob_container, blob_path, content_type, sha256, uploaded_by, classification, created_at, updated_at) VALUES
-- CBA and governance documents
('d1000001-0001-4000-8000-000000000001', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE Local 123 Inside Workers CBA 2024-2027', 'collective_agreement',
 'documents', 'local123/cba/inside-workers-2024-2027.pdf', 'application/pdf',
 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'internal',
 NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
('d1000001-0002-4000-8000-000000000002', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE Local 123 Outside Workers CBA 2024-2027', 'collective_agreement',
 'documents', 'local123/cba/outside-workers-2024-2027.pdf', 'application/pdf',
 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'internal',
 NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
('d1000001-0003-4000-8000-000000000003', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE Local 123 Bylaws (Amended 2025)', 'governance',
 'documents', 'local123/governance/bylaws-2025.pdf', 'application/pdf',
 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcdef', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'internal',
 NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),

-- Health & Safety
('d1000001-0004-4000-8000-000000000004', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'JHSC Annual Report 2025', 'health_safety',
 'documents', 'local123/safety/jhsc-annual-2025.pdf', 'application/pdf',
 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcdef01', 'usr-l123-010', 'internal',
 NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
('d1000001-0005-4000-8000-000000000005', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Winter Operations Safety Manual', 'training',
 'documents', 'local123/training/winter-ops-safety.pdf', 'application/pdf',
 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcdef0102', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'internal',
 NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),

-- Financial
('d1000001-0006-4000-8000-000000000006', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE Local 123 Budget 2026', 'financial',
 'documents', 'local123/finance/budget-2026.pdf', 'application/pdf',
 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcdef010203', 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', 'confidential',
 NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),

-- Claim-specific documents
('d1000001-0007-4000-8000-000000000007', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-003 Intake Form — Harassment Complaint', 'case_evidence',
 'documents', 'local123/claims/L123-2026-003/intake-form.pdf', 'application/pdf',
 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8', 'usr-l123-005', 'confidential',
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
('d1000001-0008-4000-8000-000000000008', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-003 Witness Statements', 'case_evidence',
 'documents', 'local123/claims/L123-2026-003/witness-statements.pdf', 'application/pdf',
 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9', 'usr-l123-005', 'confidential',
 NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
('d1000001-0009-4000-8000-000000000009', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-005 JHSC Inspection Report — City Hall Server Room', 'case_evidence',
 'documents', 'local123/claims/L123-2026-005/jhsc-inspection.pdf', 'application/pdf',
 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0', 'usr-l123-010', 'internal',
 NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
('d1000001-0010-4000-8000-000000000010', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-005 MOL Work Refusal Report', 'case_evidence',
 'documents', 'local123/claims/L123-2026-005/mol-report.pdf', 'application/pdf',
 'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1', 'usr-l123-011', 'internal',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('d1000001-0011-4000-8000-000000000011', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-004 Pay Stubs Comparison (Jan-Mar 2026)', 'case_evidence',
 'documents', 'local123/claims/L123-2026-004/pay-stubs.pdf', 'application/pdf',
 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2', 'usr-l123-010', 'confidential',
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
('d1000001-0012-4000-8000-000000000012', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-010 OHSA Work Refusal Documentation', 'case_evidence',
 'documents', 'local123/claims/L123-2026-010/ohsa-refusal.pdf', 'application/pdf',
 'f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'internal',
 NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
('d1000001-0013-4000-8000-000000000013', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-006 Job Posting — Digital Services Librarian', 'case_evidence',
 'documents', 'local123/claims/L123-2026-006/job-posting.pdf', 'application/pdf',
 'a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4', 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', 'internal',
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
('d1000001-0014-4000-8000-000000000014', (SELECT id FROM orgs WHERE legal_name ILIKE '%local 123%' OR legal_name ILIKE '%shopmoica%' LIMIT 1),
 '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'L123-2026-012 Overtime Calculation Error Analysis', 'case_evidence',
 'documents', 'local123/claims/L123-2026-012/overtime-analysis.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5', 'usr-l123-010', 'confidential',
 NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 6. AUDIT LOGS — 90 days of granular activity                │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO audit_security.audit_logs (audit_id, user_id, organization_id, action, resource_type, resource_id, severity, outcome, metadata, created_at) VALUES
-- Today — new retaliation claim filed
(gen_random_uuid(), 'usr-l123-008', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0011-4000-8000-000000000011', 'warning', 'success', '{"claimNumber":"L123-2026-011","claimType":"retaliation","priority":"critical"}', NOW()),
-- Yesterday — forced overtime claim filed
(gen_random_uuid(), 'usr-l123-007', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0001-4000-8000-000000000001', 'info', 'success', '{"claimNumber":"L123-2026-001","claimType":"grievance_schedule","priority":"high"}', NOW() - INTERVAL '1 day'),
-- 2 days ago — discipline claim updated, documents uploaded
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'update', 'claim', 'a1000001-0010-4000-8000-000000000010', 'info', 'success', '{"field":"progress","from":20,"to":40}', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'document', 'd1000001-0012-4000-8000-000000000012', 'info', 'success', '{"title":"OHSA Work Refusal Documentation"}', NOW() - INTERVAL '6 days'),
-- 3 days ago — family leave review
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'update', 'claim', 'a1000001-0002-4000-8000-000000000002', 'info', 'success', '{"field":"status","from":"assigned","to":"under_review"}', NOW() - INTERVAL '3 days'),
-- 5 days ago — safety claim documentation update
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'update', 'claim', 'a1000001-0005-4000-8000-000000000005', 'info', 'success', '{"field":"status","from":"investigation","to":"pending_documentation"}', NOW() - INTERVAL '5 days'),
-- 6 days ago — wrongful discipline claim assigned to Bob
(gen_random_uuid(), 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'assign', 'claim', 'a1000001-0010-4000-8000-000000000010', 'info', 'success', '{"assignedTo":"user_3BP6IlC0zg9MwHJDDNn7KCcR0MV","steward":"Bob Smith"}', NOW() - INTERVAL '6 days'),
-- 7 days ago — age discrimination claim updated
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'update', 'claim', 'a1000001-0006-4000-8000-000000000006', 'info', 'success', '{"field":"status","from":"assigned","to":"under_review"}', NOW() - INTERVAL '7 days'),
-- 10 days ago — discipline claim filed, verbal harassment resolved, Bob login
(gen_random_uuid(), 'usr-l123-007', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0010-4000-8000-000000000010', 'info', 'success', '{"claimNumber":"L123-2026-010","claimType":"grievance_discipline"}', NOW() - INTERVAL '7 days'),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'status_change', 'claim', 'a1000001-0007-4000-8000-000000000007', 'info', 'success', '{"from":"investigation","to":"resolved","resolution":"settled"}', NOW() - INTERVAL '10 days'),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '10 days'),
-- 12-14 days ago — safety violations documented
(gen_random_uuid(), 'usr-l123-011', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0005-4000-8000-000000000005', 'warning', 'success', '{"claimNumber":"L123-2026-005","claimType":"workplace_safety","priority":"critical"}', NOW() - INTERVAL '12 days'),
(gen_random_uuid(), 'usr-l123-010', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'document', 'd1000001-0009-4000-8000-000000000009', 'info', 'success', '{"title":"JHSC Inspection Report"}', NOW() - INTERVAL '11 days'),
(gen_random_uuid(), 'usr-l123-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0003-4000-8000-000000000003', 'warning', 'success', '{"claimNumber":"L123-2026-003","claimType":"harassment_sexual","priority":"critical"}', NOW() - INTERVAL '14 days'),
(gen_random_uuid(), 'usr-l123-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'document', 'd1000001-0007-4000-8000-000000000007', 'info', 'success', '{"title":"Harassment Complaint Intake Form"}', NOW() - INTERVAL '14 days'),
-- 15-20 days ago — age discrimination filed, pay stubs uploaded
(gen_random_uuid(), 'usr-l123-012', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0006-4000-8000-000000000006', 'info', 'success', '{"claimNumber":"L123-2026-006","claimType":"discrimination_age","priority":"high"}', NOW() - INTERVAL '15 days'),
(gen_random_uuid(), 'usr-l123-010', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'document', 'd1000001-0011-4000-8000-000000000011', 'info', 'success', '{"title":"Pay Stubs Comparison"}', NOW() - INTERVAL '25 days'),
-- 25-30 days ago — wage dispute and pay claims
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'update', 'member', NULL, 'info', 'success', '{"field":"department","to":"Parks and Facilities","memberId":"usr-l123-009"}', NOW() - INTERVAL '25 days'),
(gen_random_uuid(), 'usr-l123-009', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0004-4000-8000-000000000004', 'info', 'success', '{"claimNumber":"L123-2026-004","claimType":"grievance_pay","priority":"high"}', NOW() - INTERVAL '30 days'),
-- 40-55 days ago — earlier claims
(gen_random_uuid(), 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0007-4000-8000-000000000007', 'info', 'success', '{"claimNumber":"L123-2026-007","claimType":"harassment_verbal"}', NOW() - INTERVAL '40 days'),
(gen_random_uuid(), 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0008-4000-8000-000000000008', 'info', 'success', '{"claimNumber":"L123-2026-008","claimType":"grievance_benefits"}', NOW() - INTERVAL '55 days'),
-- 55-70 days ago — schedule grievance lifecycle
(gen_random_uuid(), 'usr-l123-009', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0009-4000-8000-000000000009', 'info', 'success', '{"claimNumber":"L123-2026-009","claimType":"grievance_schedule"}', NOW() - INTERVAL '70 days'),
(gen_random_uuid(), 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'status_change', 'claim', 'a1000001-0009-4000-8000-000000000009', 'info', 'success', '{"from":"investigation","to":"closed","resolution":"rejected"}', NOW() - INTERVAL '20 days'),
-- Administrative — logins, document uploads
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'login', 'member', NULL, 'info', 'success', '{}', NOW()),
(gen_random_uuid(), 'usr-l123-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'usr-l123-010', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '3 days'),
-- Wage dispute filed
(gen_random_uuid(), 'usr-l123-006', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'create', 'claim', 'a1000001-0012-4000-8000-000000000012', 'info', 'success', '{"claimNumber":"L123-2026-012","claimType":"wage_dispute"}', NOW() - INTERVAL '18 days'),
-- Benefits resolved
(gen_random_uuid(), 'usr-l123-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'status_change', 'claim', 'a1000001-0008-4000-8000-000000000008', 'info', 'success', '{"from":"investigation","to":"resolved","resolution":"settled"}', NOW() - INTERVAL '25 days'),
-- Failed login attempt (security awareness)
(gen_random_uuid(), NULL, '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'login', 'member', NULL, 'warning', 'failure', '{"reason":"invalid_credentials","ip":"192.168.1.45"}', NOW() - INTERVAL '8 days');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 7. NOTIFICATIONS — for stewards and members                 │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO in_app_notifications (id, user_id, organization_id, title, message, type, read, created_at, updated_at) VALUES
-- Bob Smith (steward) notifications
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'URGENT: New Retaliation Claim Filed', 'Sophie Martin has filed L123-2026-011 alleging retaliation following her harassment complaint. Requires immediate attention per Article 6.8.',
 'error', false, NOW(), NOW()),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'New Claim Assigned: L123-2026-001', 'Forced overtime grievance filed by David Okafor requires steward response within 5 business days.',
 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Deadline Approaching: L123-2026-002 Step 1 Meeting', 'Step 1 meeting for family leave grievance is due in 2 days.',
 'warning', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Claim Resolved: L123-2026-007', 'Verbal harassment grievance for Alice Johnson has been resolved. Supervisor issued formal apology.',
 'success', true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Deadline Overdue: L123-2026-004 Payroll Audit', 'Payroll audit completion for Carlos Vega''s pay discrepancy is 5 days overdue.',
 'error', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Safety Alert: City Hall Server Room', 'JHSC inspection found 5 safety violations. MOL notification filed. IT staff temporary relocation in progress.',
 'warning', true, NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),

-- Grace Lee (admin) notifications
(gen_random_uuid(), 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Monthly Dashboard Summary', '12 active claims across the local. 2 critical cases require escalation review. On-time compliance rate: 75%.',
 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Security Alert: Failed Login Attempt', 'An unsuccessful login attempt was detected from IP 192.168.1.45. If this was not you, please contact IT support.',
 'error', false, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
(gen_random_uuid(), 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'New Critical Claim: L123-2026-011 Retaliation', 'A retaliation complaint has been filed. This may require executive committee involvement per local bylaws.',
 'warning', false, NOW(), NOW()),

-- Alice Johnson (member) — her case was resolved
(gen_random_uuid(), 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Your Claim Has Been Resolved', 'L123-2026-007 has been resolved. The supervisor has been directed to issue a formal apology and complete anti-bullying training.',
 'success', false, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

-- J-P Tremblay (steward) — handling harassment case
(gen_random_uuid(), 'usr-l123-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Deadline Overdue: L123-2026-003 Investigation', 'Harassment investigation for Sophie Martin''s case is 3 days past due. Please update investigation status.',
 'error', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'usr-l123-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Related Claim Filed: L123-2026-011', 'Sophie Martin has filed a retaliation claim linked to the ongoing harassment case L123-2026-003.',
 'warning', false, NOW(), NOW()),

-- Priya Sharma (steward) — handling pay and wage cases
(gen_random_uuid(), 'usr-l123-010', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Deadline Overdue: L123-2026-004 Payroll Audit', 'The payroll audit for Carlos Vega''s pay discrepancy case is overdue. HR has not provided requested records.',
 'error', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'usr-l123-010', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'New Claim Assigned: L123-2026-012', 'Systematic overtime miscalculation affecting 8 members in Community Services. Estimated underpayment: $12,340.',
 'info', false, NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),

-- Sophie Martin (member) — subject of harassment & retaliation
(gen_random_uuid(), 'usr-l123-008', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Case Update: L123-2026-003', 'Your harassment complaint is under investigation. Interim safety measures have been put in place. Steward J-P Tremblay is your point of contact.',
 'info', true, NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
(gen_random_uuid(), 'usr-l123-008', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Retaliation Claim Received', 'Your retaliation complaint L123-2026-011 has been filed and flagged as critical priority. The union will seek interim protection measures.',
 'info', false, NOW(), NOW()),

-- David Okafor (member) — overtime and discipline cases
(gen_random_uuid(), 'usr-l123-007', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Claim Filed: L123-2026-001', 'Your forced overtime grievance has been submitted. A steward will be assigned within 5 business days.',
 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'usr-l123-007', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
 'Case Update: L123-2026-010', 'Your wrongful discipline case is under investigation. Steward Bob Smith is handling your case.',
 'info', true, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');

COMMIT;

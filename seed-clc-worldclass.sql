-- ==================================================================
-- WORLD-CLASS SEED DATA: Canadian Labour Congress (CLC)
-- Organization: 873cf59b-cef5-4d51-9a62-151512810449
--
-- Scenario: National labour federation — 10 staff across executive,
-- legal, research, policy, international, education, media, organizing.
-- National context: inter-union solidarity, policy advocacy, 
-- international labour standards, worker education.
--
-- 12 claims, 18 deadlines, 10 rules, 14 docs, 28 audit logs, 18 notifs
-- ==================================================================

BEGIN;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ CONSTANTS                                                   │
-- └─────────────────────────────────────────────────────────────┘
-- Org: 873cf59b-cef5-4d51-9a62-151512810449
-- Hassan Yussuff (admin/President):       clc-user-001
-- Marie Clarke Walker (admin/EVP):        clc-user-002
-- Denis Bolduc (Secretary-Treasurer):     clc-user-003
-- Sophie Tremblay (Director Legal):       clc-user-004
-- James Nguyen (Senior Research):         clc-user-005
-- Rebecca Martin (Media Relations):       clc-user-006
-- Louis Picard (Policy Advisor):          clc-user-007
-- Angela Varga (International Liaison):   clc-user-008
-- Patrick O'Connor (Education Coord):     clc-user-009
-- Fatima Al-Rashid (National Organizer):  clc-user-010

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 1. CLEAN EXISTING DATA                                      │
-- └─────────────────────────────────────────────────────────────┘
DELETE FROM in_app_notifications WHERE organization_id = '873cf59b-cef5-4d51-9a62-151512810449';
DELETE FROM audit_security.audit_logs WHERE organization_id = '873cf59b-cef5-4d51-9a62-151512810449';
DELETE FROM claim_deadlines WHERE organization_id = '873cf59b-cef5-4d51-9a62-151512810449';
DELETE FROM deadline_rules WHERE organization_id = '873cf59b-cef5-4d51-9a62-151512810449';
DELETE FROM documents WHERE organization_id = '873cf59b-cef5-4d51-9a62-151512810449';
DELETE FROM claims WHERE organization_id = '873cf59b-cef5-4d51-9a62-151512810449';

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 2. CLAIMS — 12 national federation context cases            │
-- └─────────────────────────────────────────────────────────────┘

-- CLAIM 1: Wage dispute — staff salary equity review — SUBMITTED (new)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at) VALUES
('c3000001-0001-4000-8000-000000000001', gen_random_uuid(), 'CLC-2026-001', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-005', NULL, 'wage_dispute', 'submitted', 'high',
 'James Nguyen (Senior Research Analyst) discovered that a recently hired male colleague in the same classification earns $12,000 more annually despite James having 8 years seniority and comparable qualifications. CLC staff collective agreement Article 14.2 requires equal pay for equal work. Pay equity analysis requested.',
 'Salary review and adjustment to match comparator; retroactive pay correction for 12 months.',
 false, false, false, 5,
 NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- CLAIM 2: Harassment — verbal by affiliate leader during convention — INVESTIGATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, witness_details, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score) VALUES
('c3000001-0002-4000-8000-000000000002', gen_random_uuid(), 'CLC-2026-002', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-006', 'clc-user-004', 'harassment_verbal', 'investigation', 'critical',
 'Rebecca Martin (Media Relations) was verbally berated and threatened by a delegate from an affiliate union during the 2026 CLC Convention in Vancouver. The delegate made sexist remarks ("stick to typing") and threatened career consequences if she did not suppress a press release about internal governance reforms. Two witnesses present.',
 'Formal apology from affiliate union; written undertaking; banning order from CLC events for 2 years; updated harassment prevention protocol for conventions.',
 false, true, true,
 'Louis Picard (Policy Advisor) and one external journalist witnessed the incident on March 3.',
 45,
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '3 days', 75);

-- CLAIM 3: Workplace safety — office air quality — ASSIGNED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('c3000001-0003-4000-8000-000000000003', gen_random_uuid(), 'CLC-2026-003', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-009', 'clc-user-004', 'workplace_safety', 'assigned', 'medium',
 'Patrick O''Connor reports poor air quality at CLC national headquarters (2841 Riverside Dr, Ottawa). Multiple staff members reporting headaches and respiratory irritation since HVAC renovation in January. Building management has not provided air quality testing results despite 3 written requests over 60 days.',
 'Independent air quality testing within 14 days; remediation of any issues; compliance with Canada Labour Code Part II.',
 false, true, false, 25,
 NOW() - INTERVAL '30 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '8 days');

-- CLAIM 4: Discrimination — age — UNDER_REVIEW
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('c3000001-0004-4000-8000-000000000004', gen_random_uuid(), 'CLC-2026-004', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-009', 'clc-user-002', 'discrimination_age', 'under_review', 'high',
 'Patrick O''Connor (Education Coordinator, age 58) was passed over for the Director of Education position in favour of a 34-year-old external hire with less experience. Selection committee comments included "need fresh ideas" and "digital native generation." Canadian Human Rights Act s.3 prohibits age discrimination.',
 'Review of selection process; appointment to Director position or compensation; anti-discrimination training for hiring managers.',
 false, false, false, 30,
 NOW() - INTERVAL '18 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '6 days');

-- CLAIM 5: Contract dispute — telework policy for international staff — INVESTIGATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('c3000001-0005-4000-8000-000000000005', gen_random_uuid(), 'CLC-2026-005', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-008', 'clc-user-004', 'contract_dispute', 'investigation', 'medium',
 'Angela Varga (International Liaison) was denied continued remote work from her Montreal home despite having worked remotely since 2020 and her role requiring primarily virtual engagement with ILO and ITUC. New CLC policy requires 4 days on-site in Ottawa. Staff agreement s.11 allows telework where operationally feasible.',
 'Exemption from 4-day on-site requirement; formal telework agreement; reimbursement of relocation costs if required.',
 false, false, false, 40,
 NOW() - INTERVAL '15 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days');

-- CLAIM 6: Grievance — denied leave for union training — ASSIGNED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('c3000001-0006-4000-8000-000000000006', gen_random_uuid(), 'CLC-2026-006', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-010', 'clc-user-002', 'grievance_leave', 'assigned', 'medium',
 'Fatima Al-Rashid (National Organizer) was denied 5 days educational leave to attend an ITUC capacity-building seminar in Geneva. CLC staff agreement Article 20.3 provides for educational leave up to 10 days per fiscal year. HR cited "operational requirements" without evidence of scheduling conflict.',
 'Approval of 5-day educational leave; travel and accommodation expenses per Article 20.5.',
 false, false, false, 15,
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '4 days');

-- CLAIM 7: Grievance — discipline — written reprimand — PENDING_DOCUMENTATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('c3000001-0007-4000-8000-000000000007', gen_random_uuid(), 'CLC-2026-007', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-007', 'clc-user-004', 'grievance_discipline', 'pending_documentation', 'high',
 'Louis Picard (Policy Advisor) received a written reprimand for "insubordination" after he publicly questioned the CLC''s position on anti-scab legislation at a staff meeting. Article 6.1 protects internal dissent on policy matters. Staff agreement Article 12.4 states discipline must be proportionate.',
 'Rescission of written reprimand; written confirmation that internal policy debate is protected expression.',
 false, false, true, 50,
 NOW() - INTERVAL '12 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days');

-- CLAIM 8: Benefits grievance — denied mental health coverage — ASSIGNED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('c3000001-0008-4000-8000-000000000008', gen_random_uuid(), 'CLC-2026-008', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-010', 'clc-user-002', 'grievance_benefits', 'assigned', 'high',
 'Fatima Al-Rashid''s claim for psychologist sessions ($2,400 over 6 months) was denied by the benefits provider, citing "non-covered practitioner." Staff agreement benefit schedule lists psychologists as covered providers with $3,000/year maximum. Provider appears to be applying outdated exclusion list.',
 'Full coverage of $2,400 in psychologist charges; updated provider directory; written confirmation of benefit entitlements.',
 false, false, false, 20,
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days');

-- CLAIM 9: Racial discrimination — promotion denial — UNDER_REVIEW (critical)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score) VALUES
('c3000001-0009-4000-8000-000000000009', gen_random_uuid(), 'CLC-2026-009', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-010', 'clc-user-004', 'discrimination_race', 'under_review', 'critical',
 'Fatima Al-Rashid reports a pattern of racial bias: passed over for 3 promotions in 4 years despite consistently exceeding performance targets. Hiring panels have been exclusively white. Exit interviews from 2 former BIPOC staff (obtained with consent) describe similar experiences. CLC''s own equity policy commits to proportional representation.',
 'Human rights investigation; appointment or compensation; systemic review of CLC hiring practices; mandatory equity training.',
 false, true, false, 35,
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '5 days', 88);

-- CLAIM 10: Wrongful termination — probationary organizer — RESOLVED (settled)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at, settlement_amount) VALUES
('c3000001-0010-4000-8000-000000000010', gen_random_uuid(), 'CLC-2026-010', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-005', 'clc-user-004', 'wrongful_termination', 'resolved', 'high',
 'Former probationary organizer terminated after raising concerns about health and safety during a community organizing campaign. Canada Labour Code s.133.1 prohibits retaliation for H&S concerns. CLC settled to avoid reputational damage.',
 'Reinstatement or severance; commitment to anti-retaliation training.',
 false, false, true, 100,
 NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days', NOW() - INTERVAL '53 days', NOW() - INTERVAL '20 days', 'settled',
 NOW() - INTERVAL '55 days', NOW() - INTERVAL '20 days', 45000);

-- CLAIM 11: Pay grievance — overtime not paid — RESOLVED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at) VALUES
('c3000001-0011-4000-8000-000000000011', gen_random_uuid(), 'CLC-2026-011', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-006', 'clc-user-003', 'grievance_pay', 'resolved', 'medium',
 'Rebecca Martin worked 45 hours overtime during CLC Convention media coverage but was only paid straight time instead of 1.5x per Article 15.2. Payroll error confirmed by HR.',
 'Payment of overtime differential ($1,800) within 15 days.',
 false, false, false, 100,
 NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '34 days', NOW() - INTERVAL '25 days', 'settled',
 NOW() - INTERVAL '35 days', NOW() - INTERVAL '25 days');

-- CLAIM 12: Retaliation for reporting safety concern — SUBMITTED (brand new)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at) VALUES
('c3000001-0012-4000-8000-000000000012', gen_random_uuid(), 'CLC-2026-012', '873cf59b-cef5-4d51-9a62-151512810449',
 'clc-user-009', NULL, 'retaliation', 'submitted', 'critical',
 'Patrick O''Connor alleges retaliatory performance improvement plan (PIP) issued 5 days after he filed CLC-2026-003 (air quality complaint) and CLC-2026-004 (age discrimination). PIP cites "attitude" and "resistance to change." No prior performance issues in 12-year tenure. Canada Labour Code s.147 prohibits reprisal.',
 'Rescission of PIP; investigation of retaliatory pattern; written guarantee of protection.',
 false, true, false, 5,
 NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 3. DEADLINE RULES — CLC staff grievance process             │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO deadline_rules (id, organization_id, rule_name, event_type, days_from_event, business_days_only, allows_extension, max_extension_days, is_active, is_system_rule, created_at, updated_at) VALUES
('d3000001-0001-4000-8000-000000000001', '873cf59b-cef5-4d51-9a62-151512810449', 'Staff Grievance Filing',           'incident',              20, false, false, 0,  true, true, NOW(), NOW()),
('d3000001-0002-4000-8000-000000000002', '873cf59b-cef5-4d51-9a62-151512810449', 'Grievance Committee Assignment',   'claim_filed',            3,  true,  true,  2,  true, true, NOW(), NOW()),
('d3000001-0003-4000-8000-000000000003', '873cf59b-cef5-4d51-9a62-151512810449', 'First Level Response (Director)',   'claim_filed',            10, false, true,  5,  true, true, NOW(), NOW()),
('d3000001-0004-4000-8000-000000000004', '873cf59b-cef5-4d51-9a62-151512810449', 'Second Level (EVP Review)',         'first_level_denied',     10, false, true,  5,  true, true, NOW(), NOW()),
('d3000001-0005-4000-8000-000000000005', '873cf59b-cef5-4d51-9a62-151512810449', 'Arbitration Referral',             'second_level_denied',    30, false, true,  15, true, true, NOW(), NOW()),
('d3000001-0006-4000-8000-000000000006', '873cf59b-cef5-4d51-9a62-151512810449', 'Harassment Investigation',         'investigation_started',  14, false, false, 0,  true, true, NOW(), NOW()),
('d3000001-0007-4000-8000-000000000007', '873cf59b-cef5-4d51-9a62-151512810449', 'Safety Compliance Order',          'safety_report',          21, false, false, 0,  true, true, NOW(), NOW()),
('d3000001-0008-4000-8000-000000000008', '873cf59b-cef5-4d51-9a62-151512810449', 'Benefits Appeal',                  'benefit_denied',         30, false, true,  10, true, true, NOW(), NOW()),
('d3000001-0009-4000-8000-000000000009', '873cf59b-cef5-4d51-9a62-151512810449', 'Human Rights Complaint Filing',    'discrimination_report',  90, false, true,  30, true, true, NOW(), NOW()),
('d3000001-0010-4000-8000-000000000010', '873cf59b-cef5-4d51-9a62-151512810449', 'Convention Policy Resolution',     'convention_vote',        60, false, false, 0,  true, true, NOW(), NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 4. CLAIM DEADLINES — mixed statuses for dashboard           │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO claim_deadlines (id, claim_id, organization_id, deadline_name, deadline_type, event_date, original_deadline, due_date, status, priority, is_overdue, days_until_due, days_overdue, created_at, updated_at) VALUES
-- Claim 1 (Wage equity — new, needs assignment)
('e3000001-0001-4000-8000-000000000001', 'c3000001-0001-4000-8000-000000000001', '873cf59b-cef5-4d51-9a62-151512810449',
 'Grievance Committee Assignment', 'assignment', NOW() - INTERVAL '2 days', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day',
 'pending', 'high', false, 1, 0, NOW() - INTERVAL '2 days', NOW()),
-- Claim 2 (Convention harassment — investigation, overdue)
('e3000001-0002-4000-8000-000000000002', 'c3000001-0002-4000-8000-000000000002', '873cf59b-cef5-4d51-9a62-151512810449',
 'Harassment Investigation Completion', 'investigation', NOW() - INTERVAL '14 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
 'pending', 'critical', true, -2, 2, NOW() - INTERVAL '14 days', NOW()),
('e3000001-0003-4000-8000-000000000003', 'c3000001-0002-4000-8000-000000000002', '873cf59b-cef5-4d51-9a62-151512810449',
 'Witness Statements', 'documentation', NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days',
 'completed', 'high', false, 0, 0, NOW() - INTERVAL '14 days', NOW() - INTERVAL '11 days'),
-- Claim 3 (Air quality — upcoming)
('e3000001-0004-4000-8000-000000000004', 'c3000001-0003-4000-8000-000000000003', '873cf59b-cef5-4d51-9a62-151512810449',
 'Air Quality Testing', 'compliance', NOW() - INTERVAL '20 days', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days',
 'pending', 'medium', false, 5, 0, NOW() - INTERVAL '20 days', NOW()),
-- Claim 4 (Age discrimination — upcoming)
('e3000001-0005-4000-8000-000000000005', 'c3000001-0004-4000-8000-000000000004', '873cf59b-cef5-4d51-9a62-151512810449',
 'First Level Meeting', 'hearing', NOW() - INTERVAL '12 days', NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days',
 'pending', 'high', false, 4, 0, NOW() - INTERVAL '12 days', NOW()),
-- Claim 5 (Telework — due soon)
('e3000001-0006-4000-8000-000000000006', 'c3000001-0005-4000-8000-000000000005', '873cf59b-cef5-4d51-9a62-151512810449',
 'First Level Response', 'response', NOW() - INTERVAL '10 days', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days',
 'pending', 'medium', false, 2, 0, NOW() - INTERVAL '10 days', NOW()),
-- Claim 6 (Leave denied — due today)
('e3000001-0007-4000-8000-000000000007', 'c3000001-0006-4000-8000-000000000006', '873cf59b-cef5-4d51-9a62-151512810449',
 'EVP Review Meeting', 'hearing', NOW() - INTERVAL '6 days', NOW(), NOW(),
 'pending', 'medium', false, 0, 0, NOW() - INTERVAL '6 days', NOW()),
-- Claim 7 (Discipline — documentation pending)
('e3000001-0008-4000-8000-000000000008', 'c3000001-0007-4000-8000-000000000007', '873cf59b-cef5-4d51-9a62-151512810449',
 'Supporting Documentation Submission', 'documentation', NOW() - INTERVAL '7 days', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days',
 'pending', 'high', false, 3, 0, NOW() - INTERVAL '7 days', NOW()),
-- Claim 8 (Benefits — overdue)
('e3000001-0009-4000-8000-000000000009', 'c3000001-0008-4000-8000-000000000008', '873cf59b-cef5-4d51-9a62-151512810449',
 'Benefits Provider Response', 'response', NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
 'pending', 'high', true, -1, 1, NOW() - INTERVAL '8 days', NOW()),
-- Claim 9 (Racial discrimination — CHRC filing, long runway)
('e3000001-0010-4000-8000-000000000010', 'c3000001-0009-4000-8000-000000000009', '873cf59b-cef5-4d51-9a62-151512810449',
 'CHRC Complaint Filing Deadline', 'compliance', NOW() - INTERVAL '16 days', NOW() + INTERVAL '74 days', NOW() + INTERVAL '74 days',
 'pending', 'critical', false, 74, 0, NOW() - INTERVAL '16 days', NOW()),
('e3000001-0011-4000-8000-000000000011', 'c3000001-0009-4000-8000-000000000009', '873cf59b-cef5-4d51-9a62-151512810449',
 'Internal Equity Review', 'investigation', NOW() - INTERVAL '16 days', NOW() + INTERVAL '8 days', NOW() + INTERVAL '8 days',
 'pending', 'critical', false, 8, 0, NOW() - INTERVAL '16 days', NOW()),
-- Claim 10 (Wrongful termination — resolved)
('e3000001-0012-4000-8000-000000000012', 'c3000001-0010-4000-8000-000000000010', '873cf59b-cef5-4d51-9a62-151512810449',
 'Settlement Agreement Execution', 'documentation', NOW() - INTERVAL '53 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days',
 'completed', 'high', false, 0, 0, NOW() - INTERVAL '53 days', NOW() - INTERVAL '26 days'),
-- Claim 11 (Overtime — resolved)
('e3000001-0013-4000-8000-000000000013', 'c3000001-0011-4000-8000-000000000011', '873cf59b-cef5-4d51-9a62-151512810449',
 'Payroll Correction', 'documentation', NOW() - INTERVAL '34 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days',
 'completed', 'medium', false, 0, 0, NOW() - INTERVAL '34 days', NOW() - INTERVAL '23 days'),
-- Claim 12 (Retaliation — brand new)
('e3000001-0014-4000-8000-000000000014', 'c3000001-0012-4000-8000-000000000012', '873cf59b-cef5-4d51-9a62-151512810449',
 'Grievance Committee Assignment', 'assignment', NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days',
 'pending', 'critical', false, 2, 0, NOW() - INTERVAL '1 day', NOW()),
-- Extra deadline for claim 1
('e3000001-0015-4000-8000-000000000015', 'c3000001-0001-4000-8000-000000000001', '873cf59b-cef5-4d51-9a62-151512810449',
 'Pay Equity Analysis Completion', 'investigation', NOW() - INTERVAL '2 days', NOW() + INTERVAL '18 days', NOW() + INTERVAL '18 days',
 'pending', 'high', false, 18, 0, NOW() - INTERVAL '2 days', NOW()),
-- Extra deadlines for Claim 7
('e3000001-0016-4000-8000-000000000016', 'c3000001-0007-4000-8000-000000000007', '873cf59b-cef5-4d51-9a62-151512810449',
 'Discipline Hearing Date', 'hearing', NOW() - INTERVAL '7 days', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days',
 'pending', 'high', false, 10, 0, NOW() - INTERVAL '7 days', NOW()),
-- Extra for claim 12
('e3000001-0017-4000-8000-000000000017', 'c3000001-0012-4000-8000-000000000012', '873cf59b-cef5-4d51-9a62-151512810449',
 'Canada Labour Code s.147 Complaint', 'compliance', NOW() - INTERVAL '1 day', NOW() + INTERVAL '89 days', NOW() + INTERVAL '89 days',
 'pending', 'critical', false, 89, 0, NOW() - INTERVAL '1 day', NOW()),
-- Extended deadline for claim 3
('e3000001-0018-4000-8000-000000000018', 'c3000001-0003-4000-8000-000000000003', '873cf59b-cef5-4d51-9a62-151512810449',
 'First Level Grievance Meeting', 'hearing', NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days', NOW() + INTERVAL '3 days',
 'extended', 'medium', false, 3, 0, NOW() - INTERVAL '20 days', NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 5. DOCUMENTS                                                │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO documents (id, org_id, organization_id, title, category, blob_container, blob_path, content_type, sha256, uploaded_by, classification, created_at, updated_at) VALUES
-- Governance
('f3000001-0001-4000-8000-000000000001', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC Constitution (2025 Amended)', 'governance',
 'documents', 'clc/governance/constitution-2025.pdf', 'application/pdf',
 '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b', 'clc-user-001', 'internal', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
('f3000001-0002-4000-8000-000000000002', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC Staff Collective Agreement 2024-2027', 'collective_agreement',
 'documents', 'clc/cba/staff-agreement-2024-2027.pdf', 'application/pdf',
 '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c', 'clc-user-001', 'internal', NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
-- Policy
('f3000001-0003-4000-8000-000000000003', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC Anti-Harassment and Violence Prevention Policy', 'policy',
 'documents', 'clc/policy/harassment-prevention.pdf', 'application/pdf',
 '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d', 'clc-user-004', 'internal', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
('f3000001-0004-4000-8000-000000000004', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC Equity and Inclusion Policy Framework', 'policy',
 'documents', 'clc/policy/equity-inclusion-framework.pdf', 'application/pdf',
 '4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e', 'clc-user-002', 'internal', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
-- Financial
('f3000001-0005-4000-8000-000000000005', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC Annual Budget 2025-2026', 'financial',
 'documents', 'clc/finance/annual-budget-2025-2026.pdf', 'application/pdf',
 '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f', 'clc-user-003', 'confidential', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),
-- Case evidence
('f3000001-0006-4000-8000-000000000006', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-001 — Salary Comparator Analysis', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-001/salary-comparator.pdf', 'application/pdf',
 '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a', 'clc-user-005', 'confidential', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
('f3000001-0007-4000-8000-000000000007', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-002 — Convention Incident Witness Statements', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-002/witness-statements.pdf', 'application/pdf',
 '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f2a2b', 'clc-user-004', 'confidential', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
('f3000001-0008-4000-8000-000000000008', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-003 — HVAC Renovation Records', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-003/hvac-records.pdf', 'application/pdf',
 '2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f2a2b3c', 'clc-user-009', 'internal', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
('f3000001-0009-4000-8000-000000000009', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-009 — Employment Equity Data (BIPOC Staff)', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-009/equity-data.pdf', 'application/pdf',
 '3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f2a2b3c4d', 'clc-user-004', 'confidential', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
('f3000001-0010-4000-8000-000000000010', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-004 — Hiring Process Documentation', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-004/hiring-docs.pdf', 'application/pdf',
 '4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f2a2b3c4d5e', 'clc-user-002', 'confidential', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('f3000001-0011-4000-8000-000000000011', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-007 — Staff Meeting Audio (redacted)', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-007/meeting-audio.mp3', 'audio/mpeg',
 '5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f2a2b3c4d5e6f', 'clc-user-007', 'confidential', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
('f3000001-0012-4000-8000-000000000012', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-012 — PIP Letter and Prior Performance Reviews', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-012/pip-and-reviews.pdf', 'application/pdf',
 '6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f2a2b3c4d5e6f1a', 'clc-user-009', 'confidential', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
-- Training
('f3000001-0013-4000-8000-000000000013', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC Workplace Harassment Prevention Training Manual', 'training',
 'documents', 'clc/training/harassment-prevention-2026.pdf', 'application/pdf',
 '7a1b2c3d4e5f7a1b2c3d4e5f7a1b2c3d4e5f7a1b2c3d4e5f7a1b2c3d4e5f7a1b', 'clc-user-009', 'internal', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('f3000001-0014-4000-8000-000000000014', (SELECT id FROM orgs WHERE id = '873cf59b-cef5-4d51-9a62-151512810449'),
 '873cf59b-cef5-4d51-9a62-151512810449', 'CLC-2026-008 — Benefits Provider Denial Letter', 'case_evidence',
 'documents', 'clc/claims/CLC-2026-008/denial-letter.pdf', 'application/pdf',
 '8b2c3d4e5f6a8b2c3d4e5f6a8b2c3d4e5f6a8b2c3d4e5f6a8b2c3d4e5f6a8b2c', 'clc-user-010', 'confidential', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 6. AUDIT LOGS                                               │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO audit_security.audit_logs (audit_id, user_id, organization_id, action, resource_type, resource_id, severity, outcome, metadata, created_at) VALUES
-- Today
(gen_random_uuid(), 'clc-user-001', '873cf59b-cef5-4d51-9a62-151512810449', 'login', 'member', NULL, 'info', 'success', '{}', NOW()),
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449', 'update', 'claim', 'c3000001-0002-4000-8000-000000000002', 'info', 'success', '{"field":"progress","from":40,"to":45}', NOW()),
-- Yesterday
(gen_random_uuid(), 'clc-user-009', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0012-4000-8000-000000000012', 'warning', 'success', '{"claimNumber":"CLC-2026-012","claimType":"retaliation","priority":"critical"}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'clc-user-009', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'document', 'f3000001-0012-4000-8000-000000000012', 'info', 'success', '{"title":"PIP Letter and Performance Reviews"}', NOW() - INTERVAL '1 day'),
-- 2-5 days ago
(gen_random_uuid(), 'clc-user-005', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0001-4000-8000-000000000001', 'info', 'success', '{"claimNumber":"CLC-2026-001","claimType":"wage_dispute"}', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449', 'update', 'claim', 'c3000001-0007-4000-8000-000000000007', 'info', 'success', '{"field":"status","from":"assigned","to":"pending_documentation"}', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'clc-user-002', '873cf59b-cef5-4d51-9a62-151512810449', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'clc-user-002', '873cf59b-cef5-4d51-9a62-151512810449', 'assign', 'claim', 'c3000001-0006-4000-8000-000000000006', 'info', 'success', '{"assignedTo":"clc-user-002"}', NOW() - INTERVAL '4 days'),
-- 6-10 days ago
(gen_random_uuid(), 'clc-user-010', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0006-4000-8000-000000000006', 'info', 'success', '{"claimNumber":"CLC-2026-006","claimType":"grievance_leave"}', NOW() - INTERVAL '7 days'),
(gen_random_uuid(), 'clc-user-007', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0007-4000-8000-000000000007', 'info', 'success', '{"claimNumber":"CLC-2026-007","claimType":"grievance_discipline"}', NOW() - INTERVAL '8 days'),
(gen_random_uuid(), 'clc-user-002', '873cf59b-cef5-4d51-9a62-151512810449', 'assign', 'claim', 'c3000001-0008-4000-8000-000000000008', 'info', 'success', '{"assignedTo":"clc-user-002"}', NOW() - INTERVAL '8 days'),
(gen_random_uuid(), 'clc-user-010', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0008-4000-8000-000000000008', 'info', 'success', '{"claimNumber":"CLC-2026-008","claimType":"grievance_benefits"}', NOW() - INTERVAL '10 days'),
-- 12-18 days ago
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449', 'update', 'claim', 'c3000001-0005-4000-8000-000000000005', 'info', 'success', '{"field":"status","from":"under_review","to":"investigation"}', NOW() - INTERVAL '10 days'),
(gen_random_uuid(), 'clc-user-008', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0005-4000-8000-000000000005', 'info', 'success', '{"claimNumber":"CLC-2026-005","claimType":"contract_dispute"}', NOW() - INTERVAL '12 days'),
(gen_random_uuid(), 'clc-user-009', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0004-4000-8000-000000000004', 'info', 'success', '{"claimNumber":"CLC-2026-004","claimType":"discrimination_age"}', NOW() - INTERVAL '14 days'),
(gen_random_uuid(), 'clc-user-006', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0002-4000-8000-000000000002', 'warning', 'success', '{"claimNumber":"CLC-2026-002","claimType":"harassment_verbal","priority":"critical"}', NOW() - INTERVAL '16 days'),
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449', 'assign', 'claim', 'c3000001-0002-4000-8000-000000000002', 'info', 'success', '{"assignedTo":"clc-user-004"}', NOW() - INTERVAL '14 days'),
(gen_random_uuid(), 'clc-user-010', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0009-4000-8000-000000000009', 'warning', 'success', '{"claimNumber":"CLC-2026-009","claimType":"discrimination_race","priority":"critical"}', NOW() - INTERVAL '18 days'),
-- Resolved
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449', 'status_change', 'claim', 'c3000001-0010-4000-8000-000000000010', 'info', 'success', '{"from":"investigation","to":"resolved","resolution":"settled","amount":45000}', NOW() - INTERVAL '20 days'),
(gen_random_uuid(), 'clc-user-003', '873cf59b-cef5-4d51-9a62-151512810449', 'status_change', 'claim', 'c3000001-0011-4000-8000-000000000011', 'info', 'success', '{"from":"under_review","to":"resolved","resolution":"settled"}', NOW() - INTERVAL '25 days'),
-- Earlier
(gen_random_uuid(), 'clc-user-009', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0003-4000-8000-000000000003', 'info', 'success', '{"claimNumber":"CLC-2026-003","claimType":"workplace_safety"}', NOW() - INTERVAL '22 days'),
(gen_random_uuid(), 'clc-user-005', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0010-4000-8000-000000000010', 'info', 'success', '{"claimNumber":"CLC-2026-010","claimType":"wrongful_termination"}', NOW() - INTERVAL '55 days'),
(gen_random_uuid(), 'clc-user-006', '873cf59b-cef5-4d51-9a62-151512810449', 'create', 'claim', 'c3000001-0011-4000-8000-000000000011', 'info', 'success', '{"claimNumber":"CLC-2026-011","claimType":"grievance_pay"}', NOW() - INTERVAL '35 days'),
-- Admin/security
(gen_random_uuid(), 'clc-user-003', '873cf59b-cef5-4d51-9a62-151512810449', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'clc-user-010', '873cf59b-cef5-4d51-9a62-151512810449', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), NULL, '873cf59b-cef5-4d51-9a62-151512810449', 'login', 'member', NULL, 'warning', 'failure', '{"reason":"expired_session","ip":"192.168.1.50"}', NOW() - INTERVAL '4 days'),
(gen_random_uuid(), 'clc-user-007', '873cf59b-cef5-4d51-9a62-151512810449', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '5 days');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 7. NOTIFICATIONS                                            │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO in_app_notifications (id, user_id, organization_id, title, message, type, read, created_at, updated_at) VALUES
-- Hassan Yussuff (admin)
(gen_random_uuid(), 'clc-user-001', '873cf59b-cef5-4d51-9a62-151512810449',
 'URGENT: Retaliation Complaint Filed', 'Patrick O''Connor has filed CLC-2026-012 alleging retaliatory PIP after safety/discrimination complaints. Canada Labour Code s.147 may apply.', 'error', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'clc-user-001', '873cf59b-cef5-4d51-9a62-151512810449',
 'Monthly Case Summary', '12 active cases. 3 critical. 2 overdue deadlines. Racial discrimination complaint CLC-2026-009 requires board attention.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'clc-user-001', '873cf59b-cef5-4d51-9a62-151512810449',
 'Settlement: CLC-2026-010', 'Wrongful termination case settled for $45,000. Settlement agreement executed.', 'warning', true, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
-- Marie Clarke Walker (EVP)
(gen_random_uuid(), 'clc-user-002', '873cf59b-cef5-4d51-9a62-151512810449',
 'Deadline Today: CLC-2026-006 EVP Review', 'Educational leave grievance for Fatima Al-Rashid — EVP review meeting due today.', 'warning', false, NOW(), NOW()),
(gen_random_uuid(), 'clc-user-002', '873cf59b-cef5-4d51-9a62-151512810449',
 'Systemic Equity Concern: CLC-2026-009', 'Racial discrimination complaint raises systemic hiring concerns. Legal recommends internal equity audit.', 'warning', false, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
-- Sophie Tremblay (Legal)
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449',
 'Deadline Overdue: CLC-2026-002 Investigation', 'Convention harassment investigation is 2 days past the 14-day limit. Final report needed urgently.', 'error', false, NOW(), NOW()),
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449',
 'Deadline Overdue: CLC-2026-008 Benefits Response', 'Benefits provider response for Fatima Al-Rashid overdue by 1 day. Escalation to provider required.', 'error', false, NOW(), NOW()),
(gen_random_uuid(), 'clc-user-004', '873cf59b-cef5-4d51-9a62-151512810449',
 'New Case: CLC-2026-001 Pay Equity', 'Pay equity dispute filed by James Nguyen. $12,000 salary gap. Committee assignment due tomorrow.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Rebecca Martin (claimant — harassment)
(gen_random_uuid(), 'clc-user-006', '873cf59b-cef5-4d51-9a62-151512810449',
 'Case Update: CLC-2026-002', 'Your harassment complaint is under investigation by Director of Legal Services. Witness statements have been collected.', 'info', true, NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
(gen_random_uuid(), 'clc-user-006', '873cf59b-cef5-4d51-9a62-151512810449',
 'Claim Resolved: CLC-2026-011', 'Your overtime payment grievance has been settled. $1,800 differential will be in your next pay.', 'success', true, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
-- Patrick O'Connor
(gen_random_uuid(), 'clc-user-009', '873cf59b-cef5-4d51-9a62-151512810449',
 'Retaliation Claim Filed: CLC-2026-012', 'Your retaliation complaint has been submitted. A grievance committee member will be assigned within 3 business days.', 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'clc-user-009', '873cf59b-cef5-4d51-9a62-151512810449',
 'Case Update: CLC-2026-003 Extension Granted', 'Air quality grievance first-level meeting extended by 8 days. New deadline: 3 days from now.', 'info', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
-- Fatima Al-Rashid
(gen_random_uuid(), 'clc-user-010', '873cf59b-cef5-4d51-9a62-151512810449',
 'CHRC Filing Advisory', 'Legal recommends considering a formal CHRC complaint for CLC-2026-009. Filing deadline: 74 days.', 'warning', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'clc-user-010', '873cf59b-cef5-4d51-9a62-151512810449',
 'Benefits Claim Update: CLC-2026-008', 'Provider response is overdue. Sophie Tremblay is escalating to benefits broker.', 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
-- James Nguyen
(gen_random_uuid(), 'clc-user-005', '873cf59b-cef5-4d51-9a62-151512810449',
 'Claim Filed: CLC-2026-001', 'Your pay equity grievance has been submitted. Comparator analysis is being prepared.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Angela Varga
(gen_random_uuid(), 'clc-user-008', '873cf59b-cef5-4d51-9a62-151512810449',
 'Case Update: CLC-2026-005', 'Your telework dispute has entered investigation stage. First-level response due in 2 days.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Denis Bolduc
(gen_random_uuid(), 'clc-user-003', '873cf59b-cef5-4d51-9a62-151512810449',
 'Security Alert: Expired Session Login', 'An expired session login attempt was detected from IP 192.168.1.50.', 'error', false, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
-- Louis Picard
(gen_random_uuid(), 'clc-user-007', '873cf59b-cef5-4d51-9a62-151512810449',
 'Case Update: CLC-2026-007', 'Your discipline grievance requires supporting documentation within 3 days. Please submit evidence of internal policy debate rights.', 'warning', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

COMMIT;

-- ==================================================================
-- WORLD-CLASS SEED DATA: CAPE-ACEP
-- Organization: c09173ad-5ba4-498e-a483-b371fb5e248e
-- 
-- Scenario: Federal professional employees union (economists,
-- translators, analysts). 12 staff across Executive, Bargaining,
-- Legal, Finance, Labour Relations, Communications, Research, IT.
-- National context: Treasury Board negotiations, Phoenix pay,
-- classification grievances, telework disputes.
--
-- 12 claims, 18 deadlines, 10 rules, 14 docs, 28 audit logs, 18 notifs
-- ==================================================================

BEGIN;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ CONSTANTS                                                   │
-- └─────────────────────────────────────────────────────────────┘
-- Org: c09173ad-5ba4-498e-a483-b371fb5e248e
-- Greg Phillips  (admin):  cape-user-001
-- Emmanuelle Tremblay (admin):  cape-user-002
-- Brian Faulkner (bargaining): cape-user-003
-- Chantal Bertrand (LR):       cape-user-004
-- Mike Savard (legal):          cape-user-005
-- Nadia Ouellet (finance):      cape-user-006
-- Daniel Kim (membership):      cape-user-007
-- Sarah Lefebvre (chief steward): cape-user-008
-- Alexandre Moreau (steward pacific): cape-user-009
-- Jennifer Walsh (comms):       cape-user-010
-- Pierre Desmarais (research):  cape-user-011
-- Amira Hassan (IT):            cape-user-012

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 1. CLEAN EXISTING DATA                                      │
-- └─────────────────────────────────────────────────────────────┘
DELETE FROM in_app_notifications WHERE organization_id = 'c09173ad-5ba4-498e-a483-b371fb5e248e';
DELETE FROM audit_security.audit_logs WHERE organization_id = 'c09173ad-5ba4-498e-a483-b371fb5e248e';
DELETE FROM claim_deadlines WHERE organization_id = 'c09173ad-5ba4-498e-a483-b371fb5e248e';
DELETE FROM deadline_rules WHERE organization_id = 'c09173ad-5ba4-498e-a483-b371fb5e248e';
DELETE FROM documents WHERE organization_id = 'c09173ad-5ba4-498e-a483-b371fb5e248e';
DELETE FROM claims WHERE organization_id = 'c09173ad-5ba4-498e-a483-b371fb5e248e';

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 2. CLAIMS — 12 federal-context cases                        │
-- └─────────────────────────────────────────────────────────────┘

-- CLAIM 1: Phoenix pay system overpayment recovery — SUBMITTED (new, high)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at) VALUES
('e2000001-0001-4000-8000-000000000001', gen_random_uuid(), 'CAPE-2026-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-011', NULL, 'grievance_pay', 'submitted', 'high',
 'Pierre Desmarais received a Phoenix pay system overpayment notice demanding immediate repayment of $4,200. The overpayment occurred due to a delayed acting pay transaction in 2024. Member disputes the amount and the recovery timeline, citing TBS Directive on Terms & Conditions of Employment s.3.4 requiring reasonable repayment schedules.',
 'Verification of overpayment amount; establishment of a reasonable 12-month repayment schedule; waiver of interest charges.',
 false, false, false, 5,
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

-- CLAIM 2: Classification grievance — UNDER_REVIEW (assigned to Sarah)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score) VALUES
('e2000001-0002-4000-8000-000000000002', gen_random_uuid(), 'CAPE-2026-002', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-012', 'cape-user-008', 'contract_dispute', 'under_review', 'high',
 'Amira Hassan (IS-03) has been performing IS-04 duties for 14 months as part of an IT modernization project. Department refuses to reclassify or provide acting pay. Work description comparison shows 85% overlap with IS-04 standard. Collective agreement Article 18.1 requires review within 180 days of request.',
 'Reclassification to IS-04 or retroactive acting pay for 14 months; updated work description.',
 false, true, false, 35,
 NOW() - INTERVAL '30 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days', 68);

-- CLAIM 3: Telework denial — INVESTIGATION (assigned to Chantal)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('e2000001-0003-4000-8000-000000000003', gen_random_uuid(), 'CAPE-2026-003', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-011', 'cape-user-004', 'grievance_schedule', 'investigation', 'medium',
 'Pierre Desmarais'' telework agreement (3 days/week) was unilaterally revoked by DG citing new RTO policy requiring 3 days on-site. Member argues the collective agreement telework provisions (Letter of Understanding #4) take precedence over employer policy. Member has documented medical need (chronic back condition) supporting telework arrangement.',
 'Reinstatement of 3-day telework arrangement; accommodation of medical needs per duty to accommodate.',
 false, false, false, 40,
 NOW() - INTERVAL '18 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '4 days');

-- CLAIM 4: Harassment — workplace bullying by DG — INVESTIGATION (critical)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, witness_details, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score) VALUES
('e2000001-0004-4000-8000-000000000004', gen_random_uuid(), 'CAPE-2026-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-006', 'cape-user-005', 'harassment_workplace', 'investigation', 'critical',
 'Nadia Ouellet (Controller) reports sustained pattern of workplace harassment by a Director General: public humiliation during branch meetings, unreasonable deadlines, exclusion from decision-making on files within her mandate, and retaliatory performance reviews. 7 documented incidents over 4 months.',
 'Formal investigation under TBS Directive on the Prevention and Resolution of Workplace Harassment; interim measures to separate parties; restoration of professional responsibilities.',
 false, true, true,
 'Three colleagues witnessed the March 5 branch meeting incident. Names provided under confidence.',
 50,
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '3 days', 82);

-- CLAIM 5: Disability accommodation denied — ASSIGNED (to Sarah)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('e2000001-0005-4000-8000-000000000005', gen_random_uuid(), 'CAPE-2026-005', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-007', 'cape-user-008', 'discrimination_disability', 'assigned', 'high',
 'Daniel Kim (Membership Coordinator) requested ergonomic accommodations for RSI (repetitive strain injury) with physician documentation. Department purchased an ergonomic keyboard but denied request for voice-to-text software ($300) and stand-up desk ($800), citing budget constraints. Canadian Human Rights Act s.7 requires accommodation to point of undue hardship.',
 'Provision of all medically recommended accommodations; ergonomic assessment by qualified professional.',
 false, false, false, 20,
 NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days');

-- CLAIM 6: Official languages violation — UNDER_REVIEW
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('e2000001-0006-4000-8000-000000000006', gen_random_uuid(), 'CAPE-2026-006', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-009', 'cape-user-004', 'contract_dispute', 'under_review', 'medium',
 'Alexandre Moreau (Pacific Region Steward) reports that the Vancouver regional office conducts all management meetings in English only, despite 3 francophone members. Training materials available only in English. Official Languages Act Part V guarantees language of work rights in bilingual regions.',
 'Implementation of simultaneous interpretation for management meetings; translation of all training materials within 60 days; language of work policy reminder from ADM.',
 false, true, false, 30,
 NOW() - INTERVAL '22 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '8 days');

-- CLAIM 7: Workplace safety (ergonomics) — PENDING_DOCUMENTATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('e2000001-0007-4000-8000-000000000007', gen_random_uuid(), 'CAPE-2026-007', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-010', 'cape-user-008', 'workplace_safety', 'pending_documentation', 'medium',
 'Jennifer Walsh reports inadequate workstation in the new open-concept office at 240 Sparks Street. Noise levels measured at 72 dB (exceeding CSA Z412 guideline of 45 dB for analytical work). 15 members in the EC group affected. OHS committee notified but no action taken after 30 days.',
 'Sound-absorbing partitions; quiet rooms for concentrated work; noise level reassessment; compliance with Canada Labour Code Part II.',
 false, true, false, 55,
 NOW() - INTERVAL '35 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '26 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '10 days');

-- CLAIM 8: Performance evaluation grievance — ASSIGNED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('e2000001-0008-4000-8000-000000000008', gen_random_uuid(), 'CAPE-2026-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-006', 'cape-user-004', 'grievance_discipline', 'assigned', 'high',
 'Nadia Ouellet received a "Did Not Meet" performance evaluation despite meeting all work objectives. The negative evaluation was issued 3 weeks after she filed harassment complaint CAPE-2026-004. Article 23.5 prohibits reprisal for filing complaints. Previous 5 years all rated "Succeeded+" or higher.',
 'Rescission of "Did Not Meet" evaluation; investigation of reprisal; restoration of performance record.',
 false, false, false, 15,
 NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days');

-- CLAIM 9: Bilingual bonus denied — RESOLVED (settled)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at) VALUES
('e2000001-0009-4000-8000-000000000009', gen_random_uuid(), 'CAPE-2026-009', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-009', 'cape-user-003', 'grievance_pay', 'resolved', 'low',
 'Alexandre Moreau''s bilingual bonus ($800/year) was discontinued after SLE results expired. Member passed new SLE testing within 30 days. Payroll did not reinstate bonus for 3 months.',
 'Retroactive payment of $200 bilingual bonus.',
 false, false, false, 100,
 NOW() - INTERVAL '50 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days', NOW() - INTERVAL '15 days', 'settled',
 NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days');

-- CLAIM 10: Travel expense dispute — RESOLVED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at) VALUES
('e2000001-0010-4000-8000-000000000010', gen_random_uuid(), 'CAPE-2026-010', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-008', 'cape-user-003', 'wage_dispute', 'resolved', 'medium',
 'Sarah Lefebvre incurred $1,200 in travel expenses for mandatory steward training in Ottawa. Department delayed reimbursement for 6 months despite proper claim submission. NJC Travel Directive s.3.1 requires payment within 30 days.',
 'Full reimbursement of $1,200 within 15 days; interest on delayed payment.',
 false, false, false, 100,
 NOW() - INTERVAL '65 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '58 days', NOW() - INTERVAL '30 days', 'settled',
 NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days');

-- CLAIM 11: Wrongful termination (probation) — CLOSED (rejected at adjudication)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, closed_at, resolution_outcome, created_at, updated_at) VALUES
('e2000001-0011-4000-8000-000000000011', gen_random_uuid(), 'CAPE-2026-011', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-012', 'cape-user-005', 'wrongful_termination', 'closed', 'critical',
 'Former probationary employee alleges termination was based on personal animus rather than performance. FPSLRA s.211 limits grievance rights for probationers but CAPE argued procedural unfairness. Adjudicator found employer followed proper process.',
 'Reinstatement or compensation in lieu.',
 false, false, true, 100,
 NOW() - INTERVAL '80 days', NOW() - INTERVAL '75 days', NOW() - INTERVAL '74 days', NOW() - INTERVAL '20 days', 'rejected',
 NOW() - INTERVAL '75 days', NOW() - INTERVAL '20 days');

-- CLAIM 12: Retaliation for union activity — SUBMITTED (brand new, critical)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at) VALUES
('e2000001-0012-4000-8000-000000000012', gen_random_uuid(), 'CAPE-2026-012', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'cape-user-008', NULL, 'retaliation', 'submitted', 'critical',
 'Sarah Lefebvre (Chief Steward NCR) was denied a lateral deployment opportunity after her manager cited "too much time on union business." PSLRA s.186 prohibits interference with union activity. Member has documented emails showing supervisor frustration with steward duties.',
 'Rescission of deployment denial; investigation of anti-union conduct; written guarantee of PSLRA rights.',
 false, true, false, 5,
 NOW() - INTERVAL '1 day', NOW(), NOW(), NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 3. DEADLINE RULES — Federal grievance process               │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO deadline_rules (id, organization_id, rule_name, event_type, days_from_event, business_days_only, allows_extension, max_extension_days, is_active, is_system_rule, created_at, updated_at) VALUES
('f2000001-0001-4000-8000-000000000001', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Individual Grievance Filing',     'incident',              25, false, false, 0,  true, true, NOW(), NOW()),
('f2000001-0002-4000-8000-000000000002', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Steward Assignment',              'claim_filed',            3,  true,  true,  2,  true, true, NOW(), NOW()),
('f2000001-0003-4000-8000-000000000003', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'First Level Response',            'claim_filed',            15, false, true,  10, true, true, NOW(), NOW()),
('f2000001-0004-4000-8000-000000000004', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Second Level Referral',           'first_level_denied',     10, false, true,  5,  true, true, NOW(), NOW()),
('f2000001-0005-4000-8000-000000000005', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Final Level Response',            'second_level_referral',  15, false, true,  10, true, true, NOW(), NOW()),
('f2000001-0006-4000-8000-000000000006', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Adjudication Referral (FPSLREB)', 'final_level_denied',     40, false, true,  15, true, true, NOW(), NOW()),
('f2000001-0007-4000-8000-000000000007', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Harassment Investigation',        'investigation_started',  15, false, false, 0,  true, true, NOW(), NOW()),
('f2000001-0008-4000-8000-000000000008', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Classification Grievance Review',  'claim_filed',           180, false, true,  30, true, true, NOW(), NOW()),
('f2000001-0009-4000-8000-000000000009', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Duty to Accommodate Response',    'accommodation_request',  10, true,  true,  5,  true, true, NOW(), NOW()),
('f2000001-0010-4000-8000-000000000010', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'OHS Committee Response',          'safety_report',          30, false, false, 0,  true, true, NOW(), NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 4. CLAIM DEADLINES — mixed statuses for dashboard           │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO claim_deadlines (id, claim_id, organization_id, deadline_name, deadline_type, event_date, original_deadline, due_date, status, priority, is_overdue, days_until_due, days_overdue, created_at, updated_at) VALUES
-- Claim 1 (Phoenix pay, submitted 2 days ago)
('a2000001-0001-4000-8000-000000000001', 'e2000001-0001-4000-8000-000000000001', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Steward Assignment', 'assignment', NOW() - INTERVAL '2 days', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day',
 'pending', 'high', false, 1, 0, NOW() - INTERVAL '2 days', NOW()),
-- Claim 2 (Classification, under review — due soon)
('a2000001-0002-4000-8000-000000000002', 'e2000001-0002-4000-8000-000000000002', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'First Level Response', 'response', NOW() - INTERVAL '20 days', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days',
 'pending', 'high', false, 3, 0, NOW() - INTERVAL '20 days', NOW()),
-- Claim 3 (Telework, investigation)
('a2000001-0003-4000-8000-000000000003', 'e2000001-0003-4000-8000-000000000003', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Investigation Meeting', 'hearing', NOW() - INTERVAL '12 days', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days',
 'pending', 'medium', false, 5, 0, NOW() - INTERVAL '12 days', NOW()),
-- Claim 4 (Harassment — OVERDUE investigation)
('a2000001-0004-4000-8000-000000000004', 'e2000001-0004-4000-8000-000000000004', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Harassment Investigation Completion', 'investigation', NOW() - INTERVAL '16 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
 'pending', 'critical', true, -1, 1, NOW() - INTERVAL '16 days', NOW()),
('a2000001-0005-4000-8000-000000000005', 'e2000001-0004-4000-8000-000000000004', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Interim Safety Measures', 'safety', NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days',
 'completed', 'critical', false, 0, 0, NOW() - INTERVAL '18 days', NOW() - INTERVAL '17 days'),
-- Claim 5 (Accommodation — OVERDUE)
('a2000001-0006-4000-8000-000000000006', 'e2000001-0005-4000-8000-000000000005', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Duty to Accommodate Response', 'response', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
 'pending', 'high', true, -3, 3, NOW() - INTERVAL '8 days', NOW()),
-- Claim 6 (Official languages — upcoming)
('a2000001-0007-4000-8000-000000000007', 'e2000001-0006-4000-8000-000000000006', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'First Level Meeting', 'hearing', NOW() - INTERVAL '14 days', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days',
 'pending', 'medium', false, 7, 0, NOW() - INTERVAL '14 days', NOW()),
-- Claim 7 (Open-concept office — extended)
('a2000001-0008-4000-8000-000000000008', 'e2000001-0007-4000-8000-000000000007', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'OHS Committee Response', 'compliance', NOW() - INTERVAL '26 days', NOW() - INTERVAL '6 days', NOW() + INTERVAL '4 days',
 'extended', 'medium', false, 4, 0, NOW() - INTERVAL '26 days', NOW()),
-- Claim 8 (Performance eval — due today)
('a2000001-0009-4000-8000-000000000009', 'e2000001-0008-4000-8000-000000000008', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Steward Response', 'initial', NOW() - INTERVAL '4 days', NOW(), NOW(),
 'pending', 'high', false, 0, 0, NOW() - INTERVAL '4 days', NOW()),
-- Claim 9 (Bilingual bonus — resolved, deadlines met)
('a2000001-0010-4000-8000-000000000010', 'e2000001-0009-4000-8000-000000000009', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Payroll Correction', 'documentation', NOW() - INTERVAL '44 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days',
 'completed', 'low', false, 0, 0, NOW() - INTERVAL '44 days', NOW() - INTERVAL '21 days'),
-- Claim 10 (Travel — resolved, met)
('a2000001-0011-4000-8000-000000000011', 'e2000001-0010-4000-8000-000000000010', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Reimbursement Processing', 'documentation', NOW() - INTERVAL '58 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days',
 'completed', 'medium', false, 0, 0, NOW() - INTERVAL '58 days', NOW() - INTERVAL '36 days'),
-- Claim 11 (Wrongful termination — missed deadline, went to adjudication)
('a2000001-0012-4000-8000-000000000012', 'e2000001-0011-4000-8000-000000000011', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Final Level Response', 'response', NOW() - INTERVAL '74 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days',
 'missed', 'critical', false, 0, 0, NOW() - INTERVAL '74 days', NOW() - INTERVAL '50 days'),
-- Claim 12 (Retaliation — brand new)
('a2000001-0013-4000-8000-000000000013', 'e2000001-0012-4000-8000-000000000012', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Steward Assignment', 'assignment', NOW(), NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days',
 'pending', 'critical', false, 3, 0, NOW(), NOW()),
-- Extra deadlines for claims with multiple stages
('a2000001-0014-4000-8000-000000000014', 'e2000001-0002-4000-8000-000000000002', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Classification Review Deadline (180 days)', 'compliance', NOW() - INTERVAL '20 days', NOW() + INTERVAL '160 days', NOW() + INTERVAL '160 days',
 'pending', 'medium', false, 160, 0, NOW() - INTERVAL '20 days', NOW()),
('a2000001-0015-4000-8000-000000000015', 'e2000001-0001-4000-8000-000000000001', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'First Level Meeting', 'hearing', NOW() - INTERVAL '2 days', NOW() + INTERVAL '13 days', NOW() + INTERVAL '13 days',
 'pending', 'high', false, 13, 0, NOW() - INTERVAL '2 days', NOW()),
('a2000001-0016-4000-8000-000000000016', 'e2000001-0003-4000-8000-000000000003', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Medical Documentation Submission', 'documentation', NOW() - INTERVAL '12 days', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days',
 'pending', 'high', false, 2, 0, NOW() - INTERVAL '12 days', NOW()),
('a2000001-0017-4000-8000-000000000017', 'e2000001-0008-4000-8000-000000000008', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Performance Review Evidence Package', 'documentation', NOW() - INTERVAL '4 days', NOW() + INTERVAL '8 days', NOW() + INTERVAL '8 days',
 'pending', 'high', false, 8, 0, NOW() - INTERVAL '4 days', NOW()),
('a2000001-0018-4000-8000-000000000018', 'e2000001-0012-4000-8000-000000000012', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'PSLRA Unfair Labour Practice Filing', 'compliance', NOW(), NOW() + INTERVAL '90 days', NOW() + INTERVAL '90 days',
 'pending', 'critical', false, 90, 0, NOW(), NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 5. DOCUMENTS                                                │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO documents (id, org_id, organization_id, title, category, blob_container, blob_path, content_type, sha256, uploaded_by, classification, created_at, updated_at) VALUES
-- Governance
('b2000001-0001-4000-8000-000000000001', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE EC Group Collective Agreement 2023-2026', 'collective_agreement',
 'documents', 'cape/cba/ec-group-2023-2026.pdf', 'application/pdf',
 'aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44', 'cape-user-001', 'internal', NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
('b2000001-0002-4000-8000-000000000002', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE TR Group Collective Agreement 2023-2026', 'collective_agreement',
 'documents', 'cape/cba/tr-group-2023-2026.pdf', 'application/pdf',
 'bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55', 'cape-user-001', 'internal', NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
('b2000001-0003-4000-8000-000000000003', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE Constitution and Bylaws (2025)', 'governance',
 'documents', 'cape/governance/constitution-2025.pdf', 'application/pdf',
 'cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66', 'cape-user-001', 'internal', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
-- Treasury Board policies
('b2000001-0004-4000-8000-000000000004', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'TBS Directive on Telework (2025 Update)', 'policy',
 'documents', 'cape/policy/tbs-telework-2025.pdf', 'application/pdf',
 'dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11', 'cape-user-003', 'internal', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
('b2000001-0005-4000-8000-000000000005', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'TBS Directive on Harassment Prevention', 'policy',
 'documents', 'cape/policy/tbs-harassment-directive.pdf', 'application/pdf',
 'ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22', 'cape-user-005', 'internal', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
-- Financial
('b2000001-0006-4000-8000-000000000006', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE Budget and Financial Statements 2025-2026', 'financial',
 'documents', 'cape/finance/budget-2025-2026.pdf', 'application/pdf',
 'ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33', 'cape-user-006', 'confidential', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
-- Case-specific documents
('b2000001-0007-4000-8000-000000000007', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE-2026-002 — IS-03/IS-04 Work Description Comparison', 'case_evidence',
 'documents', 'cape/claims/CAPE-2026-002/work-description-comparison.pdf', 'application/pdf',
 'a1a2a3a4a5a6a7a8a1a2a3a4a5a6a7a8a1a2a3a4a5a6a7a8a1a2a3a4a5a6a7a8', 'cape-user-008', 'confidential', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
('b2000001-0008-4000-8000-000000000008', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE-2026-004 — Harassment Incident Chronology', 'case_evidence',
 'documents', 'cape/claims/CAPE-2026-004/incident-chronology.pdf', 'application/pdf',
 'b2b3b4b5b6b7b8b1b2b3b4b5b6b7b8b1b2b3b4b5b6b7b8b1b2b3b4b5b6b7b8b1', 'cape-user-005', 'confidential', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),
('b2000001-0009-4000-8000-000000000009', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE-2026-005 — Medical Documentation (RSI)', 'case_evidence',
 'documents', 'cape/claims/CAPE-2026-005/medical-documentation.pdf', 'application/pdf',
 'c3c4c5c6c7c8c1c2c3c4c5c6c7c8c1c2c3c4c5c6c7c8c1c2c3c4c5c6c7c8c1c2', 'cape-user-007', 'confidential', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
('b2000001-0010-4000-8000-000000000010', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE-2026-007 — Noise Level Measurements (240 Sparks)', 'case_evidence',
 'documents', 'cape/claims/CAPE-2026-007/noise-measurements.pdf', 'application/pdf',
 'd4d5d6d7d8d1d2d3d4d5d6d7d8d1d2d3d4d5d6d7d8d1d2d3d4d5d6d7d8d1d2d3', 'cape-user-010', 'internal', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
('b2000001-0011-4000-8000-000000000011', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE-2026-008 — 5-Year Performance Evaluation History', 'case_evidence',
 'documents', 'cape/claims/CAPE-2026-008/performance-history.pdf', 'application/pdf',
 'e5e6e7e8e1e2e3e4e5e6e7e8e1e2e3e4e5e6e7e8e1e2e3e4e5e6e7e8e1e2e3e4', 'cape-user-004', 'confidential', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
('b2000001-0012-4000-8000-000000000012', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE-2026-001 — Phoenix Pay Overpayment Notice', 'case_evidence',
 'documents', 'cape/claims/CAPE-2026-001/overpayment-notice.pdf', 'application/pdf',
 'f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4f5f6f7f8f1f2f3f4f5', 'cape-user-011', 'internal', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Training
('b2000001-0013-4000-8000-000000000013', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Steward Training Manual 2026', 'training',
 'documents', 'cape/training/steward-manual-2026.pdf', 'application/pdf',
 'a7a8a1a2a3a4a5a6a7a8a1a2a3a4a5a6a7a8a1a2a3a4a5a6a7a8a1a2a3a4a5a6', 'cape-user-003', 'internal', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('b2000001-0014-4000-8000-000000000014', (SELECT id FROM orgs WHERE id = 'c09173ad-5ba4-498e-a483-b371fb5e248e'),
 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'CAPE-2026-012 — Anti-Union Conduct Email Evidence', 'case_evidence',
 'documents', 'cape/claims/CAPE-2026-012/email-evidence.pdf', 'application/pdf',
 'b8b1b2b3b4b5b6b7b8b1b2b3b4b5b6b7b8b1b2b3b4b5b6b7b8b1b2b3b4b5b6b7', 'cape-user-008', 'confidential', NOW(), NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 6. AUDIT LOGS                                               │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO audit_security.audit_logs (audit_id, user_id, organization_id, action, resource_type, resource_id, severity, outcome, metadata, created_at) VALUES
-- Today
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0012-4000-8000-000000000012', 'warning', 'success', '{"claimNumber":"CAPE-2026-012","claimType":"retaliation","priority":"critical"}', NOW()),
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'document', 'b2000001-0014-4000-8000-000000000014', 'info', 'success', '{"title":"Anti-Union Conduct Email Evidence"}', NOW()),
(gen_random_uuid(), 'cape-user-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'login', 'member', NULL, 'info', 'success', '{}', NOW()),
-- 2 days ago
(gen_random_uuid(), 'cape-user-011', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0001-4000-8000-000000000001', 'info', 'success', '{"claimNumber":"CAPE-2026-001","claimType":"grievance_pay"}', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '2 days'),
-- 3-5 days ago
(gen_random_uuid(), 'cape-user-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'update', 'claim', 'e2000001-0004-4000-8000-000000000004', 'info', 'success', '{"field":"progress","from":40,"to":50}', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'cape-user-006', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0008-4000-8000-000000000008', 'warning', 'success', '{"claimNumber":"CAPE-2026-008","claimType":"grievance_discipline","note":"potential reprisal"}', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), 'cape-user-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'assign', 'claim', 'e2000001-0008-4000-8000-000000000008', 'info', 'success', '{"assignedTo":"cape-user-004"}', NOW() - INTERVAL '4 days'),
-- 8-10 days ago
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'assign', 'claim', 'e2000001-0005-4000-8000-000000000005', 'info', 'success', '{"assignedTo":"cape-user-008"}', NOW() - INTERVAL '8 days'),
(gen_random_uuid(), 'cape-user-007', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0005-4000-8000-000000000005', 'info', 'success', '{"claimNumber":"CAPE-2026-005","claimType":"discrimination_disability"}', NOW() - INTERVAL '10 days'),
(gen_random_uuid(), 'cape-user-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'update', 'claim', 'e2000001-0006-4000-8000-000000000006', 'info', 'success', '{"field":"status","from":"assigned","to":"under_review"}', NOW() - INTERVAL '8 days'),
-- 12-18 days ago
(gen_random_uuid(), 'cape-user-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'update', 'claim', 'e2000001-0003-4000-8000-000000000003', 'info', 'success', '{"field":"status","from":"under_review","to":"investigation"}', NOW() - INTERVAL '12 days'),
(gen_random_uuid(), 'cape-user-006', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0004-4000-8000-000000000004', 'warning', 'success', '{"claimNumber":"CAPE-2026-004","claimType":"harassment_workplace","priority":"critical"}', NOW() - INTERVAL '18 days'),
(gen_random_uuid(), 'cape-user-005', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'assign', 'claim', 'e2000001-0004-4000-8000-000000000004', 'info', 'success', '{"assignedTo":"cape-user-005"}', NOW() - INTERVAL '16 days'),
-- 15-25 days ago
(gen_random_uuid(), 'cape-user-012', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0002-4000-8000-000000000002', 'info', 'success', '{"claimNumber":"CAPE-2026-002","claimType":"contract_dispute"}', NOW() - INTERVAL '20 days'),
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'update', 'claim', 'e2000001-0002-4000-8000-000000000002', 'info', 'success', '{"field":"status","from":"assigned","to":"under_review"}', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), 'cape-user-009', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0006-4000-8000-000000000006', 'info', 'success', '{"claimNumber":"CAPE-2026-006","claimType":"contract_dispute"}', NOW() - INTERVAL '16 days'),
-- Resolved/closed
(gen_random_uuid(), 'cape-user-003', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'status_change', 'claim', 'e2000001-0009-4000-8000-000000000009', 'info', 'success', '{"from":"investigation","to":"resolved","resolution":"settled"}', NOW() - INTERVAL '15 days'),
(gen_random_uuid(), 'cape-user-003', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'status_change', 'claim', 'e2000001-0010-4000-8000-000000000010', 'info', 'success', '{"from":"under_review","to":"resolved","resolution":"settled"}', NOW() - INTERVAL '30 days'),
(gen_random_uuid(), 'cape-user-005', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'status_change', 'claim', 'e2000001-0011-4000-8000-000000000011', 'info', 'success', '{"from":"investigation","to":"closed","resolution":"rejected"}', NOW() - INTERVAL '20 days'),
-- Earlier filings
(gen_random_uuid(), 'cape-user-010', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0007-4000-8000-000000000007', 'info', 'success', '{"claimNumber":"CAPE-2026-007","claimType":"workplace_safety"}', NOW() - INTERVAL '28 days'),
(gen_random_uuid(), 'cape-user-009', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0009-4000-8000-000000000009', 'info', 'success', '{"claimNumber":"CAPE-2026-009","claimType":"grievance_pay"}', NOW() - INTERVAL '45 days'),
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'create', 'claim', 'e2000001-0010-4000-8000-000000000010', 'info', 'success', '{"claimNumber":"CAPE-2026-010","claimType":"wage_dispute"}', NOW() - INTERVAL '60 days'),
-- Administrative
(gen_random_uuid(), 'cape-user-002', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cape-user-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cape-user-003', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'cape-user-005', 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), NULL, 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'login', 'member', NULL, 'warning', 'failure', '{"reason":"invalid_credentials","ip":"10.0.2.15"}', NOW() - INTERVAL '6 days');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 7. NOTIFICATIONS                                            │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO in_app_notifications (id, user_id, organization_id, title, message, type, read, created_at, updated_at) VALUES
-- Greg Phillips (admin)
(gen_random_uuid(), 'cape-user-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'URGENT: Retaliation Complaint Filed', 'Chief Steward Sarah Lefebvre has filed CAPE-2026-012 alleging retaliation for union activity. PSLRA s.186 complaint may be required.', 'error', false, NOW(), NOW()),
(gen_random_uuid(), 'cape-user-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Monthly Case Summary', '12 active cases. 2 critical (harassment, retaliation). 2 overdue deadlines. Phoenix pay grievance pending assignment.', 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cape-user-001', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Adjudication Result: CAPE-2026-011', 'Wrongful termination case rejected at adjudication. Adjudicator upheld employer process.', 'warning', true, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
-- Sarah Lefebvre (chief steward NCR)
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'New Case Assigned: CAPE-2026-002', 'Classification grievance for Amira Hassan (IS-03→IS-04). First level response due in 15 days.', 'info', false, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Deadline Overdue: CAPE-2026-005 Accommodation', 'Duty to accommodate response for Daniel Kim is 3 days overdue. Escalation to ADM may be required.', 'error', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cape-user-008', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Retaliation Complaint Filed', 'Your retaliation complaint CAPE-2026-012 has been submitted. A steward from another region will be assigned to avoid conflict of interest.', 'info', false, NOW(), NOW()),
-- Chantal Bertrand (LR officer)
(gen_random_uuid(), 'cape-user-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Deadline Today: CAPE-2026-008 Steward Response', 'Performance evaluation grievance for Nadia Ouellet requires steward response today.', 'warning', false, NOW(), NOW()),
(gen_random_uuid(), 'cape-user-004', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Case Update: CAPE-2026-003 Medical Docs Due', 'Medical documentation for Pierre Desmarais telework accommodation due in 2 days.', 'warning', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
-- Mike Savard (legal)
(gen_random_uuid(), 'cape-user-005', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Deadline Overdue: CAPE-2026-004 Investigation', 'Harassment investigation for Nadia Ouellet is 1 day past the 15-day limit. Results needed urgently.', 'error', false, NOW(), NOW()),
(gen_random_uuid(), 'cape-user-005', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'New Reprisal Allegation for Review', 'CAPE-2026-008 may constitute reprisal linked to CAPE-2026-004. Legal review recommended.', 'warning', false, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
-- Daniel Kim (member — accommodation case)
(gen_random_uuid(), 'cape-user-007', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Case Update: CAPE-2026-005', 'Your accommodation request has been assigned to Chief Steward Sarah Lefebvre. Employer response is overdue.', 'info', false, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
-- Nadia Ouellet (member — harassment + reprisal)
(gen_random_uuid(), 'cape-user-006', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Case Update: CAPE-2026-004 Investigation', 'Your harassment complaint is under investigation by Staff Lawyer Mike Savard. Interim measures have been implemented.', 'info', true, NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),
(gen_random_uuid(), 'cape-user-006', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Grievance Filed: CAPE-2026-008', 'Your performance evaluation grievance has been filed. Steward Chantal Bertrand is handling your case.', 'info', false, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
-- Emmanuelle Tremblay (VP admin)
(gen_random_uuid(), 'cape-user-002', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Security Alert: Failed Login', 'An unsuccessful login attempt was detected from IP 10.0.2.15.', 'error', false, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
-- Pierre Desmarais (member)
(gen_random_uuid(), 'cape-user-011', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Claim Filed: CAPE-2026-001', 'Your Phoenix pay overpayment grievance has been submitted. A steward will be assigned within 3 business days.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Alexandre Moreau
(gen_random_uuid(), 'cape-user-009', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Claim Resolved: CAPE-2026-009', 'Your bilingual bonus grievance has been settled. Retroactive payment of $200 has been processed.', 'success', true, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
-- Jennifer Walsh
(gen_random_uuid(), 'cape-user-010', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Case Update: CAPE-2026-007', 'OHS committee has been granted a 10-day extension to respond to the noise level complaint. New deadline: 4 days.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Brian Faulkner
(gen_random_uuid(), 'cape-user-003', 'c09173ad-5ba4-498e-a483-b371fb5e248e',
 'Bargaining Alert: Phoenix Pay Patterns', 'Third Phoenix pay grievance this quarter. Consider raising systemic issue at next Labour-Management Consultation Committee.', 'warning', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

COMMIT;

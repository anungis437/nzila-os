-- ==================================================================
-- WORLD-CLASS SEED DATA: CUPE National
-- Organization: 9210418f-6a4f-4dab-a7d2-4450d581dc81
--
-- Scenario: CUPE National headquarters — Canada's largest union
-- (730k+ members). National staff handle inter-local disputes,
-- jurisdictional issues, national policy grievances, constitutional
-- interpretation, and support for local unions.
--
-- NOTE: Only 2 platform admins exist. We first seed 10 staff members
-- into organization_members, then build the full dataset.
--
-- 10 new members + 12 claims, 18 deadlines, 10 rules, 14 docs,
-- 28 audit logs, 18 notifs
-- ==================================================================

BEGIN;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ CONSTANTS                                                   │
-- └─────────────────────────────────────────────────────────────┘
-- Org: 9210418f-6a4f-4dab-a7d2-4450d581dc81
-- Existing admins:
--   user_35NlrrNcfTv0DMh2kzBHyXZRtpb  (platform admin)
--   user_37Zo7OrvP4jy0J0MU5APfkDtE2V  (platform admin)
-- New staff members (cupen-user-001 through 010):
--   cupen-user-001: Mark Hancock (National President)
--   cupen-user-002: Charles Fleury (National Secretary-Treasurer)
--   cupen-user-003: Candace Rennick (General VP Ontario)
--   cupen-user-004: Denis Bolduc (General VP Quebec)
--   cupen-user-005: Sherry Hanes (Director National Services)
--   cupen-user-006: Tammy Graham (Director of Organizing)
--   cupen-user-007: Nathan Prier (Senior Research Officer)
--   cupen-user-008: Louise Fecteau (National Legal Counsel)
--   cupen-user-009: Rajesh Sharma (National Rep — Western)
--   cupen-user-010: Marie-Claude Dubois (National Rep — Quebec)

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 0. SEED NEW MEMBERS                                         │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO organization_members (id, user_id, organization_id, name, email, role, department, position, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'cupen-user-001', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Mark Hancock',       'mhancock@cupe.ca',    'admin',  'Executive',       'National President',             NOW() - INTERVAL '200 days', NOW() - INTERVAL '200 days'),
  (gen_random_uuid(), 'cupen-user-002', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Charles Fleury',     'cfleury@cupe.ca',     'admin',  'Executive',       'National Secretary-Treasurer',    NOW() - INTERVAL '200 days', NOW() - INTERVAL '200 days'),
  (gen_random_uuid(), 'cupen-user-003', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Candace Rennick',    'crennick@cupe.ca',    'admin',  'Regional — ON',   'General VP Ontario',              NOW() - INTERVAL '180 days', NOW() - INTERVAL '180 days'),
  (gen_random_uuid(), 'cupen-user-004', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Denis Bolduc',       'dbolduc@cupe.ca',     'admin',  'Regional — QC',   'General VP Quebec',               NOW() - INTERVAL '180 days', NOW() - INTERVAL '180 days'),
  (gen_random_uuid(), 'cupen-user-005', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Sherry Hanes',       'shanes@cupe.ca',      'member', 'National Services','Director of National Services',   NOW() - INTERVAL '150 days', NOW() - INTERVAL '150 days'),
  (gen_random_uuid(), 'cupen-user-006', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Tammy Graham',       'tgraham@cupe.ca',     'member', 'Organizing',      'Director of Organizing',          NOW() - INTERVAL '150 days', NOW() - INTERVAL '150 days'),
  (gen_random_uuid(), 'cupen-user-007', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Nathan Prier',       'nprier@cupe.ca',      'member', 'Research',        'Senior Research Officer',         NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
  (gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Louise Fecteau',     'lfecteau@cupe.ca',    'member', 'Legal',           'National Legal Counsel',          NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
  (gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Rajesh Sharma',      'rsharma@cupe.ca',     'member', 'National Reps',   'National Representative — Western', NOW() - INTERVAL '100 days', NOW() - INTERVAL '100 days'),
  (gen_random_uuid(), 'cupen-user-010', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Marie-Claude Dubois','mcdubois@cupe.ca',    'member', 'National Reps',   'National Representative — Quebec',  NOW() - INTERVAL '100 days', NOW() - INTERVAL '100 days')
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 1. CLEAN EXISTING DATA                                      │
-- └─────────────────────────────────────────────────────────────┘
DELETE FROM in_app_notifications WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
DELETE FROM audit_security.audit_logs WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
DELETE FROM claim_deadlines WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
DELETE FROM deadline_rules WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
DELETE FROM documents WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';
DELETE FROM claims WHERE organization_id = '9210418f-6a4f-4dab-a7d2-4450d581dc81';

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 2. CLAIMS — 12 national-level union cases                   │
-- └─────────────────────────────────────────────────────────────┘

-- CLAIM 1: Inter-local jurisdictional dispute — INVESTIGATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score) VALUES
('a4000001-0001-4000-8000-000000000001', gen_random_uuid(), 'CUPEN-2026-001', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-009', 'cupen-user-008', 'contract_dispute', 'investigation', 'high',
 'CUPE Local 3902 (university TAs, Toronto) and CUPE Local 79 (city workers, Toronto) both claim jurisdiction over new City of Toronto community youth program coordinators. The positions involve both academic instruction (Local 3902 scope) and municipal recreation services (Local 79 scope). CUPE National Constitution Article 4.6 requires national resolution of jurisdictional disputes between locals.',
 'National Executive Board ruling on jurisdiction; 60-day mediation process; clear demarcation criteria for future hybrid positions.',
 false, true, false, 40,
 NOW() - INTERVAL '28 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '3 days', 78);

-- CLAIM 2: Local trusteeship challenge — UNDER_REVIEW (critical)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score) VALUES
('a4000001-0002-4000-8000-000000000002', gen_random_uuid(), 'CUPEN-2026-002', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-003', 'cupen-user-008', 'contract_dispute', 'under_review', 'critical',
 'CUPE Local 416 (City of Toronto outside workers) executive passed a non-confidence motion and is challenging the trusteeship imposed by CUPE Ontario. Local executive alleges trusteeship was imposed without proper notice per CUPE Constitution Article 6.12 (minimum 30 days written notice + right to be heard). 1,300 members affected.',
 'Review of trusteeship process; if procedurally defective, restore elected executive; if upheld, ensure new elections within 180 days per Article 6.15.',
 false, true, false, 30,
 NOW() - INTERVAL '18 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '14 days', NOW() - INTERVAL '4 days', 90);

-- CLAIM 3: Workplace safety — struck worker at hospital — ASSIGNED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, witness_details, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('a4000001-0003-4000-8000-000000000003', gen_random_uuid(), 'CUPEN-2026-003', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-010', 'cupen-user-005', 'workplace_safety', 'assigned', 'critical',
 'CUPE Local 1487 reports that a healthcare aide at Hôpital du Sacré-Cœur (Montréal) was physically assaulted by a patient with a known history of violence. Employer failed to implement violence risk assessment required by CNESST regulation. 15 similar incidents in past 12 months across CUPE healthcare locals in Quebec.',
 'Provincial safety compliance order; violence risk assessment for all affected units; WSIB/CNESST claim support; systemic policy change request to health ministry.',
 false, true, true,
 'Two RNs from OIIQ witnessed the March 8 incident.',
 25,
 NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '4 days');

-- CLAIM 4: Discrimination — gender pay gap in national office — INVESTIGATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('a4000001-0004-4000-8000-000000000004', gen_random_uuid(), 'CUPEN-2026-004', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-006', 'cupen-user-008', 'discrimination_gender', 'investigation', 'high',
 'Tammy Graham (Director of Organizing) discovered that male Directors at CUPE National earn an average of $8,500 more than female Directors in equivalent roles. Analysis based on 2025 salary grid and 8 comparable positions. Pay Equity Act (federal) requires CUPE National to have a pay equity plan.',
 'Full pay equity audit of national staff positions; retroactive adjustments; establishment of pay equity committee per federal legislation.',
 false, false, false, 45,
 NOW() - INTERVAL '25 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '16 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '5 days');

-- CLAIM 5: Local union dissolution appeal — SUBMITTED (new)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at) VALUES
('a4000001-0005-4000-8000-000000000005', gen_random_uuid(), 'CUPEN-2026-005', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-009', NULL, 'contract_dispute', 'submitted', 'high',
 'CUPE Local 2348 (childcare workers, Burnaby BC) — employer has ceased operations, leaving 45 members without union representation. National must facilitate merger into nearby Local 391 per CUPE Constitution Article 5.3 (dissolution and amalgamation). Members'' accumulated seniority and benefit credits at risk.',
 'Expedited merger process; preservation of seniority lists; negotiation of successor employer rights under BC Labour Relations Code s.35.',
 false, false, false, 5,
 NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- CLAIM 6: Harassment — sexual harassment complaint against national rep — INVESTIGATION (critical)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at, complexity_score) VALUES
('a4000001-0006-4000-8000-000000000006', gen_random_uuid(), 'CUPEN-2026-006', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-010', 'cupen-user-008', 'harassment_sexual', 'investigation', 'critical',
 'Marie-Claude Dubois (National Rep Quebec) reports sexual harassment by a senior national representative during a regional conference in Québec City. Three incidents over 2 days: unwanted physical contact, sexually suggestive comments, and an uninvited visit to her hotel room. Internal complaint filed per CUPE''s Harassment Policy Article 8.2. Respondent has been placed on administrative leave.',
 'Formal investigation by external investigator; disciplinary action up to termination; trauma-informed support; systemic review of conference safety protocols.',
 true, false, true, 35,
 NOW() - INTERVAL '12 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days', 92);

-- CLAIM 7: Discipline — suspension of Local president for misuse of funds — PENDING_DOCUMENTATION
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('a4000001-0007-4000-8000-000000000007', gen_random_uuid(), 'CUPEN-2026-007', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-002', 'cupen-user-005', 'grievance_discipline', 'pending_documentation', 'high',
 'CUPE Local 2067 (City of Sudbury) president was suspended by National for alleged misuse of $18,000 in strike fund contributions. Local president claims expenditures were authorized by executive vote. Financial audit in progress. CUPE Constitution Article 10.5 requires clear and convincing evidence for disciplinary action.',
 'Completion of forensic audit; hearing before National Trial Board; reinstatement if funds properly authorized; disciplinary action if misuse confirmed.',
 false, true, false, 55,
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '13 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '3 days');

-- CLAIM 8: Grievance — benefits — national staff long-term disability denial — ASSIGNED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, created_at, updated_at) VALUES
('a4000001-0008-4000-8000-000000000008', gen_random_uuid(), 'CUPEN-2026-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-007', 'cupen-user-008', 'grievance_benefits', 'assigned', 'high',
 'Nathan Prier (Senior Research Officer) had his long-term disability claim denied by Sun Life after 4 months on short-term disability for chronic fatigue syndrome. Sun Life claims condition is "self-reported" and lacks "objective evidence." Staff collective agreement Article 22.4 requires benefits for any medically documented disability. Two specialists have provided supporting letters.',
 'Reversal of LTD denial; retroactive benefits from date of denial; legal costs for appeal.',
 false, false, false, 20,
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days');

-- CLAIM 9: Wrongful termination — organizing staff laid off — RESOLVED (settled)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at, settlement_amount) VALUES
('a4000001-0009-4000-8000-000000000009', gen_random_uuid(), 'CUPEN-2026-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-006', 'cupen-user-008', 'wrongful_termination', 'resolved', 'high',
 'Organizing staff member laid off during "restructuring" — alleged union activity retaliation. Member had been organizing internal CUPE staff union. Settled via mediation.',
 'Reinstatement or severance; anti-retaliation commitment.',
 false, false, true, 100,
 NOW() - INTERVAL '55 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '48 days', NOW() - INTERVAL '18 days', 'settled',
 NOW() - INTERVAL '50 days', NOW() - INTERVAL '18 days', 62000);

-- CLAIM 10: Pay grievance — travel time not compensated — RESOLVED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, resolved_at, resolution_outcome, created_at, updated_at) VALUES
('a4000001-0010-4000-8000-000000000010', gen_random_uuid(), 'CUPEN-2026-010', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-009', 'cupen-user-002', 'grievance_pay', 'resolved', 'medium',
 'Rajesh Sharma reports 120 hours of uncompensated travel time over 6 months for representing locals across BC and Alberta. Staff agreement Article 16.2 requires compensation for travel exceeding 2 hours each way.',
 'Payment of 120 hours at applicable rate; updated travel policy compliance.',
 false, false, false, 100,
 NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days', NOW() - INTERVAL '20 days', 'settled',
 NOW() - INTERVAL '40 days', NOW() - INTERVAL '20 days');

-- CLAIM 11: Anti-scab legislation compliance challenge — CLOSED (withdrawn)
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, assigned_at, closed_at, resolution_outcome, created_at, updated_at) VALUES
('a4000001-0011-4000-8000-000000000011', gen_random_uuid(), 'CUPEN-2026-011', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-007', 'cupen-user-005', 'contract_dispute', 'closed', 'medium',
 'Research report flagged potential anti-scab legislation violations by a federally regulated employer during CUPE Local 2182 strike. After CIRB investigation, employer came into compliance. Case withdrawn.',
 'CIRB compliance order.',
 false, false, false, 100,
 NOW() - INTERVAL '70 days', NOW() - INTERVAL '65 days', NOW() - INTERVAL '63 days', NOW() - INTERVAL '30 days', 'withdrawn',
 NOW() - INTERVAL '65 days', NOW() - INTERVAL '30 days');

-- CLAIM 12: Retaliation — national rep reassigned after supporting local dissent — SUBMITTED
INSERT INTO claims (id, claim_id, claim_number, organization_id, member_id, assigned_to, claim_type, status, priority, description, desired_outcome, is_anonymous, previously_reported, witnesses_present, progress, incident_date, filed_date, created_at, updated_at) VALUES
('a4000001-0012-4000-8000-000000000012', gen_random_uuid(), 'CUPEN-2026-012', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'cupen-user-009', NULL, 'retaliation', 'submitted', 'critical',
 'Rajesh Sharma was reassigned from BC/Alberta region to a desk role at national HQ after supporting CUPE Local 882''s objections to a national bargaining strategy. This is retaliatory punishment for representing local members'' interests — a core function of the national rep role. CUPE Constitution Article 3.1 protects representation rights.',
 'Restoration of regional assignment; investigation of retaliatory reassignment; written guarantee of representation rights.',
 false, true, false, 5,
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 3. DEADLINE RULES — CUPE National governance timelines      │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO deadline_rules (id, organization_id, rule_name, event_type, days_from_event, business_days_only, allows_extension, max_extension_days, is_active, is_system_rule, created_at, updated_at) VALUES
('b4000001-0001-4000-8000-000000000001', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'National Staff Grievance Filing',    'incident',                  20, false, false, 0,  true, true, NOW(), NOW()),
('b4000001-0002-4000-8000-000000000002', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'NEB Case Assignment',                'claim_filed',               5,  true,  true,  3,  true, true, NOW(), NOW()),
('b4000001-0003-4000-8000-000000000003', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Director-Level Response',            'claim_filed',               15, false, true,  10, true, true, NOW(), NOW()),
('b4000001-0004-4000-8000-000000000004', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'NEB Appeal',                         'director_denied',           15, false, true,  10, true, true, NOW(), NOW()),
('b4000001-0005-4000-8000-000000000005', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'National Trial Board Hearing',       'neb_appeal_denied',         30, false, true,  15, true, true, NOW(), NOW()),
('b4000001-0006-4000-8000-000000000006', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Trusteeship Review',                 'trusteeship_imposed',       30, false, false, 0,  true, true, NOW(), NOW()),
('b4000001-0007-4000-8000-000000000007', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Sexual Harassment Investigation',    'investigation_started',     21, false, false, 0,  true, true, NOW(), NOW()),
('b4000001-0008-4000-8000-000000000008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Jurisdictional Dispute Mediation',   'jurisdiction_dispute',      60, false, true,  30, true, true, NOW(), NOW()),
('b4000001-0009-4000-8000-000000000009', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Financial Audit Completion',         'audit_started',             45, false, true,  15, true, true, NOW(), NOW()),
('b4000001-0010-4000-8000-000000000010', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Merger/Amalgamation Process',        'dissolution_petition',      90, false, true,  30, true, true, NOW(), NOW());

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 4. CLAIM DEADLINES                                          │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO claim_deadlines (id, claim_id, organization_id, deadline_name, deadline_type, event_date, original_deadline, due_date, status, priority, is_overdue, days_until_due, days_overdue, created_at, updated_at) VALUES
-- Claim 1 (Jurisdictional dispute — mediation, long runway)
('c4000001-0001-4000-8000-000000000001', 'a4000001-0001-4000-8000-000000000001', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Mediation Meeting', 'hearing', NOW() - INTERVAL '20 days', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days',
 'pending', 'high', false, 10, 0, NOW() - INTERVAL '20 days', NOW()),
('c4000001-0002-4000-8000-000000000002', 'a4000001-0001-4000-8000-000000000001', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Jurisdictional Mediation Completion', 'compliance', NOW() - INTERVAL '20 days', NOW() + INTERVAL '40 days', NOW() + INTERVAL '40 days',
 'pending', 'high', false, 40, 0, NOW() - INTERVAL '20 days', NOW()),
-- Claim 2 (Trusteeship — overdue review)
('c4000001-0003-4000-8000-000000000003', 'a4000001-0002-4000-8000-000000000002', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Trusteeship Review Hearing', 'hearing', NOW() - INTERVAL '12 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
 'pending', 'critical', true, -2, 2, NOW() - INTERVAL '12 days', NOW()),
-- Claim 3 (Hospital safety — compliance order due)
('c4000001-0004-4000-8000-000000000004', 'a4000001-0003-4000-8000-000000000003', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Violence Risk Assessment', 'compliance', NOW() - INTERVAL '8 days', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days',
 'pending', 'critical', false, 3, 0, NOW() - INTERVAL '8 days', NOW()),
('c4000001-0005-4000-8000-000000000005', 'a4000001-0003-4000-8000-000000000003', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'CNESST Report Filing', 'documentation', NOW() - INTERVAL '8 days', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days',
 'pending', 'high', false, 7, 0, NOW() - INTERVAL '8 days', NOW()),
-- Claim 4 (Gender pay equity — investigation)
('c4000001-0006-4000-8000-000000000006', 'a4000001-0004-4000-8000-000000000004', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Pay Equity Audit Report', 'investigation', NOW() - INTERVAL '16 days', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days',
 'pending', 'high', false, 14, 0, NOW() - INTERVAL '16 days', NOW()),
-- Claim 5 (Local dissolution — merger process)
('c4000001-0007-4000-8000-000000000007', 'a4000001-0005-4000-8000-000000000005', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'NEB Case Assignment', 'assignment', NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days',
 'pending', 'high', false, 2, 0, NOW() - INTERVAL '3 days', NOW()),
('c4000001-0008-4000-8000-000000000008', 'a4000001-0005-4000-8000-000000000005', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Merger Process Deadline (90 days)', 'compliance', NOW() - INTERVAL '3 days', NOW() + INTERVAL '87 days', NOW() + INTERVAL '87 days',
 'pending', 'medium', false, 87, 0, NOW() - INTERVAL '3 days', NOW()),
-- Claim 6 (Sexual harassment — external investigation, due soon)
('c4000001-0009-4000-8000-000000000009', 'a4000001-0006-4000-8000-000000000006', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'External Investigation Report', 'investigation', NOW() - INTERVAL '6 days', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days',
 'pending', 'critical', false, 5, 0, NOW() - INTERVAL '6 days', NOW()),
-- Claim 7 (Financial audit — extended)
('c4000001-0010-4000-8000-000000000010', 'a4000001-0007-4000-8000-000000000007', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Forensic Audit Completion', 'investigation', NOW() - INTERVAL '13 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '7 days',
 'extended', 'high', false, 7, 0, NOW() - INTERVAL '13 days', NOW()),
('c4000001-0011-4000-8000-000000000011', 'a4000001-0007-4000-8000-000000000007', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Trial Board Evidence Package', 'documentation', NOW() - INTERVAL '13 days', NOW() + INTERVAL '15 days', NOW() + INTERVAL '15 days',
 'pending', 'high', false, 15, 0, NOW() - INTERVAL '13 days', NOW()),
-- Claim 8 (LTD appeal — overdue)
('c4000001-0012-4000-8000-000000000012', 'a4000001-0008-4000-8000-000000000008', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Sun Life Appeal Submission', 'documentation', NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
 'pending', 'high', true, -1, 1, NOW() - INTERVAL '8 days', NOW()),
-- Claim 9 (Wrongful termination — resolved)
('c4000001-0013-4000-8000-000000000013', 'a4000001-0009-4000-8000-000000000009', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Settlement Execution', 'documentation', NOW() - INTERVAL '48 days', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days',
 'completed', 'high', false, 0, 0, NOW() - INTERVAL '48 days', NOW() - INTERVAL '23 days'),
-- Claim 10 (Travel pay — resolved)
('c4000001-0014-4000-8000-000000000014', 'a4000001-0010-4000-8000-000000000010', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Payroll Adjustment', 'documentation', NOW() - INTERVAL '38 days', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days',
 'completed', 'medium', false, 0, 0, NOW() - INTERVAL '38 days', NOW() - INTERVAL '25 days'),
-- Claim 11 (Anti-scab — closed, waived)
('c4000001-0015-4000-8000-000000000015', 'a4000001-0011-4000-8000-000000000011', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'CIRB Hearing', 'hearing', NOW() - INTERVAL '63 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days',
 'waived', 'medium', false, 0, 0, NOW() - INTERVAL '63 days', NOW() - INTERVAL '35 days'),
-- Claim 12 (Retaliation — brand new)
('c4000001-0016-4000-8000-000000000016', 'a4000001-0012-4000-8000-000000000012', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'NEB Case Assignment', 'assignment', NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days', NOW() + INTERVAL '4 days',
 'pending', 'critical', false, 4, 0, NOW() - INTERVAL '1 day', NOW()),
-- Extra deadline
('c4000001-0017-4000-8000-000000000017', 'a4000001-0004-4000-8000-000000000004', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Pay Equity Committee Formation', 'compliance', NOW() - INTERVAL '16 days', NOW() + INTERVAL '44 days', NOW() + INTERVAL '44 days',
 'pending', 'medium', false, 44, 0, NOW() - INTERVAL '16 days', NOW()),
('c4000001-0018-4000-8000-000000000018', 'a4000001-0006-4000-8000-000000000006', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Interim Safety Measures Verification', 'safety', NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days',
 'completed', 'critical', false, 0, 0, NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 5. DOCUMENTS                                                │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO documents (id, org_id, organization_id, title, category, blob_container, blob_path, content_type, sha256, uploaded_by, classification, created_at, updated_at) VALUES
-- Governance
('d4000001-0001-4000-8000-000000000001', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPE National Constitution (2025 Convention)', 'governance',
 'documents', 'cupe-national/governance/constitution-2025.pdf', 'application/pdf',
 'aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33', 'cupen-user-001', 'internal', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
('d4000001-0002-4000-8000-000000000002', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPE National Staff Collective Agreement 2024-2027', 'collective_agreement',
 'documents', 'cupe-national/cba/staff-agreement-2024-2027.pdf', 'application/pdf',
 'bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44', 'cupen-user-002', 'internal', NOW() - INTERVAL '120 days', NOW() - INTERVAL '120 days'),
-- Policy
('d4000001-0003-4000-8000-000000000003', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPE Harassment and Violence Prevention Policy', 'policy',
 'documents', 'cupe-national/policy/harassment-prevention.pdf', 'application/pdf',
 'cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55', 'cupen-user-008', 'internal', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
('d4000001-0004-4000-8000-000000000004', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPE Trusteeship and Administration Guidelines', 'policy',
 'documents', 'cupe-national/policy/trusteeship-guidelines.pdf', 'application/pdf',
 'dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00', 'cupen-user-005', 'internal', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
-- Financial
('d4000001-0005-4000-8000-000000000005', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPE National Financial Statements 2025', 'financial',
 'documents', 'cupe-national/finance/financial-statements-2025.pdf', 'application/pdf',
 'ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11', 'cupen-user-002', 'confidential', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
-- Case evidence
('d4000001-0006-4000-8000-000000000006', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-001 — Local 3902/79 Jurisdictional Brief', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-001/jurisdictional-brief.pdf', 'application/pdf',
 'ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22dd33ee44ff55aa00bb11cc22', 'cupen-user-009', 'confidential', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
('d4000001-0007-4000-8000-000000000007', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-002 — Trusteeship Notice and Local Response', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-002/trusteeship-docs.pdf', 'application/pdf',
 'aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44', 'cupen-user-003', 'confidential', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
('d4000001-0008-4000-8000-000000000008', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-003 — CNESST Incident Reports (15 incidents)', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-003/cnesst-incidents.pdf', 'application/pdf',
 'bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55', 'cupen-user-010', 'confidential', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
('d4000001-0009-4000-8000-000000000009', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-004 — Salary Grid Gender Analysis', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-004/salary-gender-analysis.pdf', 'application/pdf',
 'cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66', 'cupen-user-006', 'confidential', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),
('d4000001-0010-4000-8000-000000000010', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-006 — Sexual Harassment Formal Complaint', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-006/formal-complaint.pdf', 'application/pdf',
 'dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11', 'cupen-user-010', 'confidential', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
('d4000001-0011-4000-8000-000000000011', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-007 — Local 2067 Financial Records', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-007/financial-records.pdf', 'application/pdf',
 'ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22', 'cupen-user-002', 'confidential', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
('d4000001-0012-4000-8000-000000000012', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-008 — LTD Medical Documentation', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-008/medical-docs.pdf', 'application/pdf',
 'ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33dd44ee55ff66aa11bb22cc33', 'cupen-user-007', 'confidential', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
-- Training
('d4000001-0013-4000-8000-000000000013', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPE National Representative Handbook 2026', 'training',
 'documents', 'cupe-national/training/nat-rep-handbook-2026.pdf', 'application/pdf',
 'aa77bb88cc99dd00ee11ff22aa77bb88cc99dd00ee11ff22aa77bb88cc99dd00', 'cupen-user-005', 'internal', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
('d4000001-0014-4000-8000-000000000014', (SELECT id FROM orgs WHERE id = '9210418f-6a4f-4dab-a7d2-4450d581dc81'),
 '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CUPEN-2026-012 — Reassignment Letter and Prior Evaluations', 'case_evidence',
 'documents', 'cupe-national/claims/CUPEN-2026-012/reassignment-evidence.pdf', 'application/pdf',
 'bb88cc99dd00ee11ff22aa77bb88cc99dd00ee11ff22aa77bb88cc99dd00ee11', 'cupen-user-009', 'confidential', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 6. AUDIT LOGS                                               │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO audit_security.audit_logs (audit_id, user_id, organization_id, action, resource_type, resource_id, severity, outcome, metadata, created_at) VALUES
-- Today
(gen_random_uuid(), 'cupen-user-001', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'login', 'member', NULL, 'info', 'success', '{}', NOW()),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'update', 'claim', 'a4000001-0006-4000-8000-000000000006', 'info', 'success', '{"field":"progress","from":30,"to":35}', NOW()),
-- Yesterday
(gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0012-4000-8000-000000000012', 'warning', 'success', '{"claimNumber":"CUPEN-2026-012","claimType":"retaliation","priority":"critical"}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'document', 'd4000001-0014-4000-8000-000000000014', 'info', 'success', '{"title":"Reassignment Letter and Prior Evaluations"}', NOW() - INTERVAL '1 day'),
-- 2-5 days ago
(gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0005-4000-8000-000000000005', 'info', 'success', '{"claimNumber":"CUPEN-2026-005","claimType":"contract_dispute"}', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'update', 'claim', 'a4000001-0004-4000-8000-000000000004', 'info', 'success', '{"field":"progress","from":35,"to":45}', NOW() - INTERVAL '5 days'),
(gen_random_uuid(), 'cupen-user-005', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '2 days'),
-- 6-10 days ago
(gen_random_uuid(), 'cupen-user-010', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0006-4000-8000-000000000006', 'critical', 'success', '{"claimNumber":"CUPEN-2026-006","claimType":"harassment_sexual","priority":"critical"}', NOW() - INTERVAL '8 days'),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'assign', 'claim', 'a4000001-0006-4000-8000-000000000006', 'info', 'success', '{"assignedTo":"cupen-user-008","externalInvestigator":true}', NOW() - INTERVAL '6 days'),
(gen_random_uuid(), 'cupen-user-007', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0008-4000-8000-000000000008', 'info', 'success', '{"claimNumber":"CUPEN-2026-008","claimType":"grievance_benefits"}', NOW() - INTERVAL '10 days'),
(gen_random_uuid(), 'cupen-user-010', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0003-4000-8000-000000000003', 'warning', 'success', '{"claimNumber":"CUPEN-2026-003","claimType":"workplace_safety","priority":"critical"}', NOW() - INTERVAL '10 days'),
-- 12-18 days ago
(gen_random_uuid(), 'cupen-user-003', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0002-4000-8000-000000000002', 'warning', 'success', '{"claimNumber":"CUPEN-2026-002","claimType":"contract_dispute","note":"trusteeship challenge","priority":"critical"}', NOW() - INTERVAL '14 days'),
(gen_random_uuid(), 'cupen-user-002', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0007-4000-8000-000000000007', 'info', 'success', '{"claimNumber":"CUPEN-2026-007","claimType":"grievance_discipline"}', NOW() - INTERVAL '15 days'),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'update', 'claim', 'a4000001-0002-4000-8000-000000000002', 'info', 'success', '{"field":"status","from":"assigned","to":"under_review"}', NOW() - INTERVAL '12 days'),
(gen_random_uuid(), 'cupen-user-006', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0004-4000-8000-000000000004', 'info', 'success', '{"claimNumber":"CUPEN-2026-004","claimType":"discrimination_gender"}', NOW() - INTERVAL '18 days'),
-- 20-30 days ago
(gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0001-4000-8000-000000000001', 'info', 'success', '{"claimNumber":"CUPEN-2026-001","claimType":"contract_dispute"}', NOW() - INTERVAL '22 days'),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'assign', 'claim', 'a4000001-0001-4000-8000-000000000001', 'info', 'success', '{"assignedTo":"cupen-user-008"}', NOW() - INTERVAL '20 days'),
-- Resolved/closed
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'status_change', 'claim', 'a4000001-0009-4000-8000-000000000009', 'info', 'success', '{"from":"investigation","to":"resolved","resolution":"settled","amount":62000}', NOW() - INTERVAL '18 days'),
(gen_random_uuid(), 'cupen-user-002', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'status_change', 'claim', 'a4000001-0010-4000-8000-000000000010', 'info', 'success', '{"from":"assigned","to":"resolved","resolution":"settled"}', NOW() - INTERVAL '20 days'),
(gen_random_uuid(), 'cupen-user-005', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'status_change', 'claim', 'a4000001-0011-4000-8000-000000000011', 'info', 'success', '{"from":"investigation","to":"closed","resolution":"withdrawn","reason":"employer compliance"}', NOW() - INTERVAL '30 days'),
-- Earlier filings
(gen_random_uuid(), 'cupen-user-006', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0009-4000-8000-000000000009', 'info', 'success', '{"claimNumber":"CUPEN-2026-009","claimType":"wrongful_termination"}', NOW() - INTERVAL '50 days'),
(gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0010-4000-8000-000000000010', 'info', 'success', '{"claimNumber":"CUPEN-2026-010","claimType":"grievance_pay"}', NOW() - INTERVAL '40 days'),
(gen_random_uuid(), 'cupen-user-007', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'create', 'claim', 'a4000001-0011-4000-8000-000000000011', 'info', 'success', '{"claimNumber":"CUPEN-2026-011","claimType":"contract_dispute"}', NOW() - INTERVAL '65 days'),
-- Administrative logins
(gen_random_uuid(), 'cupen-user-002', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cupen-user-003', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'login', 'member', NULL, 'info', 'success', '{}', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), NULL, '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'login', 'member', NULL, 'warning', 'failure', '{"reason":"unknown_user","ip":"10.0.5.22"}', NOW() - INTERVAL '3 days');

-- ┌─────────────────────────────────────────────────────────────┐
-- │ 7. NOTIFICATIONS                                            │
-- └─────────────────────────────────────────────────────────────┘

INSERT INTO in_app_notifications (id, user_id, organization_id, title, message, type, read, created_at, updated_at) VALUES
-- Mark Hancock (President)
(gen_random_uuid(), 'cupen-user-001', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'URGENT: Sexual Harassment Investigation', 'CUPEN-2026-006 — external investigation in progress. Respondent on admin leave. Report due in 5 days.', 'error', false, NOW(), NOW()),
(gen_random_uuid(), 'cupen-user-001', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Monthly National Case Summary', '12 active cases. 3 critical (trusteeship, sexual harassment, retaliation). Local 2348 dissolution pending.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'cupen-user-001', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Settlement: CUPEN-2026-009', 'Wrongful termination case settled for $62,000. Anti-retaliation commitment obtained.', 'warning', true, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
-- Charles Fleury (Secretary-Treasurer)
(gen_random_uuid(), 'cupen-user-002', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Financial Audit Extended: CUPEN-2026-007', 'Forensic audit of Local 2067 finances extended by 10 days. Trial board evidence package due in 15 days.', 'warning', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(gen_random_uuid(), 'cupen-user-002', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Resolved: CUPEN-2026-010', 'Rajesh Sharma''s travel pay grievance settled. 120 hours compensated.', 'success', true, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
-- Candace Rennick (VP Ontario)
(gen_random_uuid(), 'cupen-user-003', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Deadline Overdue: CUPEN-2026-002 Trusteeship Review', 'Trusteeship review hearing is 2 days overdue. 1,300 Local 416 members affected.', 'error', false, NOW(), NOW()),
-- Louise Fecteau (Legal)
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'External Investigation Status: CUPEN-2026-006', 'External investigator report due in 5 days. Interim safety measures verified.', 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Deadline Overdue: CUPEN-2026-008 LTD Appeal', 'Sun Life appeal submission for Nathan Prier overdue by 1 day. Legal brief needs finalization.', 'error', false, NOW(), NOW()),
(gen_random_uuid(), 'cupen-user-008', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Retaliation Complaint: CUPEN-2026-012', 'Rajesh Sharma alleges retaliatory reassignment. NEB case assignment due in 4 days.', 'warning', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
-- Rajesh Sharma (National Rep)
(gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Claim Filed: CUPEN-2026-012', 'Your retaliation complaint has been submitted. NEB assignment expected within 5 business days.', 'info', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'cupen-user-009', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Jurisdictional Mediation: CUPEN-2026-001', 'Mediation meeting for Local 3902/79 dispute scheduled in 10 days.', 'info', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Marie-Claude Dubois
(gen_random_uuid(), 'cupen-user-010', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Investigation Update: CUPEN-2026-006', 'Your complaint is being investigated by an external investigator. Respondent is on administrative leave. Interim measures are in place.', 'info', false, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
-- Tammy Graham
(gen_random_uuid(), 'cupen-user-006', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Case Update: CUPEN-2026-004', 'Gender pay equity investigation is in progress. Salary grid analysis submitted. Pay equity audit report due in 14 days.', 'info', false, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
-- Nathan Prier
(gen_random_uuid(), 'cupen-user-007', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'LTD Appeal Update: CUPEN-2026-008', 'Your LTD appeal is being prepared by Legal. Two specialist letters have been obtained. Sun Life appeal is overdue — being expedited.', 'warning', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
-- Sherry Hanes
(gen_random_uuid(), 'cupen-user-005', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Local 2348 Dissolution: CUPEN-2026-005', 'Childcare employer has ceased operations. 45 members need merger into Local 391. NEB assignment due in 2 days.', 'warning', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
-- Security
(gen_random_uuid(), 'cupen-user-001', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Security Alert: Unknown Login Attempt', 'Failed login from unknown user at IP 10.0.5.22.', 'error', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
-- Denis Bolduc
(gen_random_uuid(), 'cupen-user-004', '9210418f-6a4f-4dab-a7d2-4450d581dc81',
 'Hospital Safety: CUPEN-2026-003', 'Sacré-Cœur hospital violence risk assessment due in 3 days. 15 prior incidents documented across Quebec healthcare locals.', 'warning', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

COMMIT;

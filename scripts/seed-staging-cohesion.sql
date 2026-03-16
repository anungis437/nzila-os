-- ============================================================
-- Staging Cohesion Seed: Fill org-distribution gaps
-- NZILA Ventures = platform owner (billing/platform data only)
-- CAPE + CLC = UE tenant orgs (union-specific data)
-- ============================================================

-- Org ID aliases:
-- CAPE:  885aa4e0-5dc1-45bf-ad32-86477868e8ea
-- CLC:   5ecb17ab-b5de-442e-a46f-93778ee496aa
-- NZILA: 458a56cb-251a-4c91-a0b5-81bb8ac39087

BEGIN;

-- ============================================================
-- 1. CBA CLAUSES: CLC=0 (CAPE=40) — fill CLC's 2 existing CBAs
-- ============================================================

INSERT INTO cba_clauses (id, organization_id, cba_id, clause_number, clause_type, title, content, created_at, updated_at)
SELECT gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
  'd1c61626-e36a-4bb9-9aa8-01aa9b49c6d1',
  v.clause_number, v.clause_type::clause_type, v.title, v.content, NOW(), NOW()
FROM (VALUES
  ('1.01', 'wages_compensation', 'Salary Scales', 'Annual salary scales for represented positions as outlined in Schedule A.'),
  ('2.01', 'benefits_insurance', 'Health Benefits', 'Comprehensive health and dental plan coverage for all bargaining unit employees.'),
  ('3.01', 'working_conditions', 'Hours of Work', 'Standard hours shall be 37.5 hours per week, Monday through Friday.'),
  ('4.01', 'grievance_arbitration', 'Grievance Procedure', 'Multi-step grievance process with final binding arbitration.'),
  ('5.01', 'vacation_leave', 'Annual Leave', 'Vacation entitlement ranges from 15 to 30 days based on years of service.'),
  ('6.01', 'health_safety', 'Occupational Health', 'Joint health and safety committee with quarterly workplace inspections.'),
  ('7.01', 'union_rights', 'Union Recognition', 'Employer recognizes the CLC as sole bargaining agent for covered employees.'),
  ('8.01', 'seniority_promotion', 'Promotion Policy', 'Promotions based on merit with seniority as tie-breaker among qualified candidates.'),
  ('9.01', 'pension_retirement', 'Pension Plan', 'Defined benefit pension matching 8% employer contribution.'),
  ('10.01', 'overtime', 'Overtime Compensation', 'Time and a half for hours exceeding 37.5 per week; double time on statutory holidays.')
) AS v(clause_number, clause_type, title, content);

INSERT INTO cba_clauses (id, organization_id, cba_id, clause_number, clause_type, title, content, created_at, updated_at)
SELECT gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
  'e8378b8b-8492-4c7a-8ddc-b21d71749c45',
  v.clause_number, v.clause_type::clause_type, v.title, v.content, NOW(), NOW()
FROM (VALUES
  ('1.01', 'wages_compensation', 'Regional Pay Scales', 'Regional salary grids adjusted annually for cost-of-living.'),
  ('2.01', 'benefits_insurance', 'Extended Health', 'Extended health coverage including vision and paramedical services.'),
  ('3.01', 'hours_scheduling', 'Flexible Scheduling', 'Compressed work week option available with manager approval.'),
  ('4.01', 'training_development', 'Professional Development', 'Annual professional development fund of $2,500 per employee.'),
  ('5.01', 'job_security', 'Layoff Protection', 'Six months notice required for any workforce reduction.'),
  ('6.01', 'vacation_leave', 'Special Leave', 'Family-related leave of up to 5 days per year without loss of pay.'),
  ('7.01', 'management_rights', 'Management Rights', 'Management retains right to direct workforce subject to agreement terms.'),
  ('8.01', 'duration_renewal', 'Term and Renewal', 'Agreement effective for four years with automatic renewal for one year.'),
  ('9.01', 'disciplinary_procedures', 'Progressive Discipline', 'Progressive discipline policy: verbal, written, suspension, termination.'),
  ('10.01', 'workplace_rights', 'Telework Policy', 'Remote work arrangements available for eligible positions.')
) AS v(clause_number, clause_type, title, content);

-- ============================================================
-- 2. GRIEVANCE TIMELINE: CLC=0 (CAPE=20)
-- ============================================================
INSERT INTO grievance_timeline (id, grievance_id, event_type, event_date, actor, actor_role, description, created_at)
SELECT gen_random_uuid(), g.id, 'filed', g.filed_date, g.grievant_name, 'grievant',
  'Grievance filed by ' || g.grievant_name, g.filed_date
FROM grievances g
WHERE g.organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa'
  AND NOT EXISTS (SELECT 1 FROM grievance_timeline gt WHERE gt.grievance_id = g.id);

INSERT INTO grievance_timeline (id, grievance_id, event_type, event_date, actor, actor_role, description, created_at)
SELECT gen_random_uuid(), g.id, 'acknowledged', g.filed_date + INTERVAL '3 days', 'HR Department', 'employer_rep',
  'Grievance acknowledged by employer', g.filed_date + INTERVAL '3 days'
FROM grievances g
WHERE g.organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa'
  AND g.status NOT IN ('draft', 'filed');

-- ============================================================
-- 3. GRIEVANCE RESPONSES: CLC=0 (CAPE=8)
-- ============================================================
INSERT INTO grievance_responses (id, grievance_id, response_number, responding_party, responder_name,
  responder_title, response, response_date, received_date, created_at)
SELECT gen_random_uuid(), g.id, 1, 'employer', 'HR Director',
  'Director of Human Resources', 'The employer has reviewed the grievance and will respond within the contractual timeframe.',
  g.filed_date + INTERVAL '5 days', g.filed_date + INTERVAL '5 days', g.filed_date + INTERVAL '5 days'
FROM grievances g
WHERE g.organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa'
  AND g.status NOT IN ('draft', 'filed')
  AND NOT EXISTS (SELECT 1 FROM grievance_responses gr WHERE gr.grievance_id = g.id);

-- ============================================================
-- 4. SUPPORT TICKETS: CLC=0 (CAPE=13, NZILA=2)
-- ============================================================
INSERT INTO support_tickets (id, ticket_number, organization_id, subject, description,
  category, status, priority, channel, submitted_by, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'TKT-CLC-001', '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'Unable to download CBA PDF', 'When clicking download on the CBA page, nothing happens.',
   'bug', 'resolved', 'high', 'portal', 'jsmith@clc.ca', NOW() - INTERVAL '20 days', NOW()),
  (gen_random_uuid(), 'TKT-CLC-002', '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'Need delegate access for regional rep', 'Requesting portal access for new Ontario regional coordinator.',
   'access', 'open', 'medium', 'email', 'mwilson@clc.ca', NOW() - INTERVAL '10 days', NOW()),
  (gen_random_uuid(), 'TKT-CLC-003', '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'Grievance form missing classification field', 'The grievance submission form does not show the classification dropdown.',
   'bug', 'in_progress', 'high', 'portal', 'lbrown@clc.ca', NOW() - INTERVAL '5 days', NOW()),
  (gen_random_uuid(), 'TKT-CLC-004', '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'Billing invoice discrepancy', 'March invoice shows incorrect member count.',
   'billing', 'open', 'medium', 'email', 'finance@clc.ca', NOW() - INTERVAL '3 days', NOW()),
  (gen_random_uuid(), 'TKT-CLC-005', '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'Training module not loading', 'The workplace safety training module shows a spinner indefinitely.',
   'bug', 'resolved', 'low', 'portal', 'tchen@clc.ca', NOW() - INTERVAL '15 days', NOW());

-- ============================================================
-- 5. INTEGRATION API KEYS: CLC=0 (CAPE=5, NZILA=5)
-- ============================================================
INSERT INTO integration_api_keys (id, organization_id, name, key_prefix, environment, status,
  scopes, request_count, created_by, created_at, updated_at)
VALUES
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC HR System Integration', 'clc_hr_', 'production', 'active',
   ARRAY['members:read','members:write'], 1240, 'admin@clc.ca', NOW() - INTERVAL '60 days', NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC Payroll Connector', 'clc_pay_', 'production', 'active',
   ARRAY['billing:read','dues:read'], 890, 'admin@clc.ca', NOW() - INTERVAL '45 days', NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC Reporting API', 'clc_rpt_', 'production', 'active',
   ARRAY['reports:read','analytics:read'], 2100, 'admin@clc.ca', NOW() - INTERVAL '90 days', NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC Staging Test Key', 'clc_stg_', 'staging', 'active',
   ARRAY['members:read'], 50, 'dev@clc.ca', NOW() - INTERVAL '30 days', NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC Document Management', 'clc_doc_', 'production', 'active',
   ARRAY['documents:read','documents:write'], 670, 'admin@clc.ca', NOW() - INTERVAL '40 days', NOW());

-- ============================================================
-- 6. WAGE PROGRESSIONS: CLC=0 (CAPE=82 via CBA)
-- ============================================================
INSERT INTO wage_progressions (id, cba_id, classification, step, hourly_rate, annual_salary,
  effective_date, end_date, created_at)
SELECT gen_random_uuid(), 'd1c61626-e36a-4bb9-9aa8-01aa9b49c6d1',
  v.classification, v.step, v.hourly_rate, v.annual_salary,
  '2023-07-01', '2027-06-30', NOW()
FROM (VALUES
  ('CLC-1', 1, 32.50, 63375), ('CLC-1', 2, 34.00, 66300), ('CLC-1', 3, 35.75, 69712),
  ('CLC-2', 1, 36.50, 71175), ('CLC-2', 2, 38.25, 74587), ('CLC-2', 3, 40.00, 78000),
  ('CLC-3', 1, 41.00, 79950), ('CLC-3', 2, 43.00, 83850), ('CLC-3', 3, 45.25, 88237),
  ('CLC-4', 1, 46.50, 90675), ('CLC-4', 2, 48.75, 95062), ('CLC-4', 3, 51.25, 99937),
  ('CLC-5', 1, 52.00, 101400), ('CLC-5', 2, 54.50, 106275), ('CLC-5', 3, 57.25, 111637)
) AS v(classification, step, hourly_rate, annual_salary);

-- ============================================================
-- 7. SHARED CLAUSE LIBRARY: CLC=0 (CAPE=4)
-- ============================================================
INSERT INTO shared_clause_library (id, source_organization_id, clause_number, clause_title, clause_text,
  clause_type, sharing_level, sector, effective_date, view_count, created_by, created_at, updated_at)
VALUES
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC-SC-001', 'Anti-Harassment Policy', 'Comprehensive anti-harassment and discrimination policy with investigation procedures.',
   'workplace_rights', 'public', 'public_administration', '2023-07-01', 15, 'admin@clc.ca', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC-SC-002', 'Telework Framework', 'Remote work eligibility criteria and performance monitoring guidelines.',
   'working_conditions', 'public', 'public_administration', '2023-07-01', 22, 'admin@clc.ca', NOW(), NOW());

-- ============================================================
-- 8. NEGOTIATIONS: CLC=0 (CAPE=1)
-- ============================================================
INSERT INTO negotiations (id, organization_id, title, status, union_name, employer_name,
  bargaining_unit_size, notice_given_date, first_session_date,
  created_by, created_at, updated_at)
VALUES
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC Staff Agreement 2027-2031 Renewal', 'active',
   'Canadian Labour Congress', 'Treasury Board of Canada',
   250, NOW() - INTERVAL '90 days', NOW() - INTERVAL '60 days', 'admin@clc.ca', NOW(), NOW());

-- ============================================================
-- 9. NEGOTIATION SESSIONS: CLC=0 (CAPE=10)
-- ============================================================
INSERT INTO negotiation_sessions (id, negotiation_id, session_number, session_type, title,
  scheduled_date, created_by, created_at, updated_at)
SELECT gen_random_uuid(), n.id, v.session_number, v.session_type::negotiation_session_type, v.title,
  n.first_session_date + (v.session_number - 1) * INTERVAL '14 days',
  'admin@clc.ca', NOW(), NOW()
FROM negotiations n
CROSS JOIN (VALUES
  (1, 'opening', 'Opening Session - Ground Rules'),
  (2, 'negotiation', 'Wages and Benefits Discussion'),
  (3, 'negotiation', 'Working Conditions Review'),
  (4, 'negotiation', 'Leave and Scheduling'),
  (5, 'negotiation', 'Health and Safety Proposals')
) AS v(session_number, session_type, title)
WHERE n.organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa'
  AND n.title = 'CLC Staff Agreement 2027-2031 Renewal';

-- ============================================================
-- 10. BARGAINING PROPOSALS: CLC=0 (CAPE=8)
-- ============================================================
INSERT INTO bargaining_proposals (id, negotiation_id, proposal_number, title, description,
  proposal_type, proposed_language, status, created_by, created_at, updated_at)
SELECT gen_random_uuid(), n.id, v.proposal_number, v.title, v.description,
  v.proposal_type::proposal_type, v.proposed_language, v.status::proposal_status, 'admin@clc.ca', NOW() - INTERVAL '30 days', NOW()
FROM negotiations n
CROSS JOIN (VALUES
  ('CLC-P-001', 'Wage Increase 4.5%', 'Annual wage increase of 4.5% across all classifications.', 'union_demand', 'Effective July 1 each year, all salary rates shall be increased by 4.5%.', 'submitted'),
  ('CLC-P-002', 'Enhanced Sick Leave', 'Increase sick leave bank from 15 to 20 days per year.', 'union_demand', 'Article 12.01: Sick leave credits shall accrue at 1.67 days per month to a maximum of 20 days.', 'under_review'),
  ('CLC-P-003', 'Employer Counter - Wages', 'Employer offers 2.8% annual increase with performance bonus.', 'management_offer', 'Annual increase of 2.8% plus performance bonus of up to 1% based on organizational metrics.', 'submitted'),
  ('CLC-P-004', 'Telework Expansion', 'Expand telework eligibility to all staff with 3+ months tenure.', 'joint_proposal', 'Employees with 3 or more months of service are eligible for hybrid work arrangements.', 'draft')
) AS v(proposal_number, title, description, proposal_type, proposed_language, status)
WHERE n.organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa'
  AND n.title = 'CLC Staff Agreement 2027-2031 Renewal';

-- ============================================================
-- 11. BARGAINING NOTES: CLC=0 (CAPE=4)
-- ============================================================
INSERT INTO bargaining_notes (id, organization_id, session_date, session_type, title, content, created_by, created_at, updated_at)
VALUES
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   NOW() - INTERVAL '60 days', 'opening', 'Opening Session Notes', 'Established ground rules. Both parties agreed to biweekly sessions.', 'admin@clc.ca', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   NOW() - INTERVAL '46 days', 'negotiation', 'Wages Discussion', 'Union proposed 4.5% annual increase. Employer countered with 2.8%.', 'admin@clc.ca', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   NOW() - INTERVAL '32 days', 'negotiation', 'Working Conditions Review', 'Reviewed remote work provisions. Both sides open to hybrid model expansion.', 'admin@clc.ca', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   NOW() - INTERVAL '18 days', 'negotiation', 'Leave Scheduling Discussion', 'Discussed parental leave top-up and flexible scheduling options.', 'admin@clc.ca', NOW(), NOW());

-- ============================================================
-- 12. PLATFORM TABLES: CLC=0 in page_views, login_events, feature_adoption
-- ============================================================
INSERT INTO platform_page_views (id, organization_id, user_id, page_path, module, session_duration_sec, viewed_at)
SELECT gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
  'clc-user-' || n, v.page_path, v.module, 30 + n * 15,
  NOW() - (n || ' days')::INTERVAL
FROM generate_series(1, 8) AS n,
  (VALUES ('/dashboard', 'core')) AS v(page_path, module);

INSERT INTO platform_login_events (id, organization_id, user_id, login_method, logged_in_at)
SELECT gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
  'clc-user-' || n, 'password', NOW() - (n || ' days')::INTERVAL
FROM generate_series(1, 6) AS n;

INSERT INTO platform_feature_adoption (id, organization_id, feature_name, module,
  first_used_at, last_used_at, usage_count, active_users)
SELECT gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
  v.feature_name, v.module, NOW() - INTERVAL '30 days', NOW(), v.usage_count, v.active_users
FROM (VALUES
  ('Grievance Filing', 'grievances', 45, 8),
  ('CBA Search', 'cba', 120, 12),
  ('Member Directory', 'members', 200, 15),
  ('Analytics Dashboard', 'analytics', 35, 5),
  ('Document Export', 'documents', 60, 10)
) AS v(feature_name, module, usage_count, active_users);

-- ============================================================
-- 13. CUSTOMER NPS SURVEYS: CLC=0 (CAPE=14)
-- ============================================================
INSERT INTO customer_nps_surveys (id, organization_id, respondent_name, score, submitted_at)
SELECT gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
  v.respondent_name, v.score, NOW() - (v.days_ago || ' days')::INTERVAL
FROM (VALUES
  ('Jean Tremblay', 9, 5), ('Sarah Wilson', 8, 10), ('Marc Dupuis', 7, 15),
  ('Linda Brown', 10, 20), ('Robert Chen', 6, 25)
) AS v(respondent_name, score, days_ago);

-- ============================================================
-- 14. CUSTOMER ONBOARDING MILESTONES: CLC=0 (CAPE=6)
-- ============================================================
INSERT INTO customer_onboarding_milestones (id, organization_id, milestone, status, created_at)
SELECT gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
  v.milestone, v.status, NOW() - (v.days_ago || ' days')::INTERVAL
FROM (VALUES
  ('Organization Setup', 'completed', 60),
  ('Member Import', 'completed', 55),
  ('CBA Upload', 'completed', 50),
  ('Admin Training', 'completed', 40)
) AS v(milestone, status, days_ago);

-- ============================================================
-- 15. BENEFIT COMPARISONS: CLC=0 (CAPE=12 via CBA)
-- ============================================================
INSERT INTO benefit_comparisons (id, cba_id, benefit_type, benefit_name, effective_date, created_at)
SELECT gen_random_uuid(), 'd1c61626-e36a-4bb9-9aa8-01aa9b49c6d1',
  v.benefit_type, v.benefit_name, '2023-07-01', NOW()
FROM (VALUES
  ('health', 'Extended Health Coverage'), ('dental', 'Dental Plan'),
  ('vision', 'Vision Care'), ('disability', 'Long-Term Disability'),
  ('life', 'Group Life Insurance'), ('pension', 'Defined Benefit Pension')
) AS v(benefit_type, benefit_name);

-- ============================================================
-- 16. CBA CONTACTS: CLC=0 (CAPE=8 via CBA)
-- ============================================================
INSERT INTO cba_contacts (id, cba_id, contact_type, name, created_at)
SELECT gen_random_uuid(), ca.id, v.contact_type, v.name, NOW()
FROM collective_agreements ca
CROSS JOIN (VALUES
  ('union_rep', 'Hassan Yussuf'), ('employer_rep', 'Treasury Board Secretariat')
) AS v(contact_type, name)
WHERE ca.organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa';

-- ============================================================
-- 17. RECOGNITION: CAPE=0, CLC=0 (only NZILA=3/4/5)
--     These are platform-level features; add for CAPE + CLC
-- ============================================================
INSERT INTO recognition_programs (id, org_id, name, status, currency, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAPE Star Awards', 'active', 'CAD', NOW(), NOW()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAPE Service Milestones', 'active', 'CAD', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CLC Excellence Program', 'active', 'CAD', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CLC Peer Recognition', 'active', 'CAD', NOW(), NOW());

INSERT INTO recognition_award_types (id, org_id, name, kind, default_credit_amount, requires_approval, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Outstanding Contribution', 'admin', 100, true, NOW(), NOW()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5-Year Service', 'milestone', 250, false, NOW(), NOW()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Peer Thank You', 'peer', 25, false, NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'Team Excellence', 'admin', 150, true, NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', '10-Year Service', 'milestone', 500, false, NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'Kudos', 'peer', 20, false, NOW(), NOW());

INSERT INTO recognition_awards (id, org_id, program_id, award_type_id, status, created_at, updated_at)
SELECT gen_random_uuid(), rp.org_id, rp.id, rat.id, 'issued', NOW(), NOW()
FROM recognition_programs rp
JOIN recognition_award_types rat ON rat.org_id = rp.org_id
WHERE rp.org_id IN ('885aa4e0-5dc1-45bf-ad32-86477868e8ea', '5ecb17ab-b5de-442e-a46f-93778ee496aa')
LIMIT 8;

-- ============================================================
-- 18. REWARD WALLET + BUDGET: CAPE=0, CLC=0 (only NZILA=2/2)
-- ============================================================
INSERT INTO reward_wallet_ledger (id, org_id, event_type, amount_credits, balance_after, source_type, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'earn', 100, 100, 'award', NOW(), NOW()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'spend', 25, 75, 'redemption', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'earn', 150, 150, 'award', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'earn', 50, 200, 'award', NOW(), NOW());

INSERT INTO reward_budget_envelopes (id, org_id, name, scope_type, period, amount_limit, amount_used, starts_at, ends_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAPE Q1 Budget', 'org', 'quarterly', 5000, 1200, '2026-01-01', '2026-03-31', NOW(), NOW()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAPE Annual Budget', 'org', 'annual', 20000, 3500, '2026-01-01', '2026-12-31', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CLC Q1 Budget', 'org', 'quarterly', 8000, 2100, '2026-01-01', '2026-03-31', NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CLC Annual Budget', 'org', 'annual', 35000, 5800, '2026-01-01', '2026-12-31', NOW(), NOW());

-- ============================================================
-- 19. DUES RULES: CLC=0 (CAPE=1) — CLC is a union org, needs dues
-- ============================================================
INSERT INTO dues_rules (id, organization_id, rule_name, rule_code, calculation_type, billing_frequency, effective_date, created_at, updated_at)
VALUES
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa',
   'CLC Standard Dues', 'CLC-DUES-STD', 'percentage', 'monthly', '2023-07-01', NOW(), NOW());

-- ============================================================
-- 20. ORG SHARING SETTINGS: CLC=0 (CAPE=1) — CLC tenant setting
-- ============================================================
INSERT INTO organization_sharing_settings (id, organization_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', NOW(), NOW());

-- ============================================================
-- 21. SETTLEMENTS: CLC=0 (CAPE=2)
-- ============================================================
INSERT INTO settlements (id, grievance_id, settlement_type, status, organization_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd62348b7-d871-4f48-8cb4-ba4f5a399d46', 'monetary', 'executed',
   '5ecb17ab-b5de-442e-a46f-93778ee496aa', NOW() - INTERVAL '10 days', NOW());

-- ============================================================
-- 22. TENTATIVE AGREEMENTS: CLC=0 (CAPE=2)
-- ============================================================
INSERT INTO tentative_agreements (id, negotiation_id, agreement_number, title, clause_category,
  agreed_language, agreed_date, created_by, created_at, updated_at)
SELECT gen_random_uuid(), n.id, 'CLC-TA-001', 'Telework Provisions',
  'working_conditions', 'Employees may telework up to 3 days per week with manager approval.',
  NOW() - INTERVAL '10 days', 'admin@clc.ca', NOW(), NOW()
FROM negotiations n
WHERE n.organization_id = '5ecb17ab-b5de-442e-a46f-93778ee496aa'
  AND n.title = 'CLC Staff Agreement 2027-2031 Renewal'
LIMIT 1;

-- ============================================================
-- 23. ARBITRATIONS: CLC=0 (CAPE=1)
-- ============================================================
INSERT INTO arbitrations (id, grievance_id, arbitration_number, board_name, board_type,
  status, organization_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'b4e09a5c-342e-446f-a3ea-ada16bb7a49f', 'CLC-ARB-2026-001',
   'Federal Public Sector Labour Relations and Employment Board', 'single_arbitrator',
   'scheduled', '5ecb17ab-b5de-442e-a46f-93778ee496aa', NOW(), NOW());

-- ============================================================
-- 24. BILLING INVOICES + PAYMENTS: NZILA=0 (platform org needs billing)
-- ============================================================
INSERT INTO billing_invoices (id, organization_id, invoice_number, status,
  subtotal, tax_total, total, amount_paid, amount_due,
  due_date, issued_at, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087',
   'INV-NZV-2026-001', 'paid', 2500.00, 325.00, 2825.00, 2825.00, 0,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '60 days', 'Platform subscription - January 2026', NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087',
   'INV-NZV-2026-002', 'paid', 2500.00, 325.00, 2825.00, 2825.00, 0,
   NOW(), NOW() - INTERVAL '30 days', 'Platform subscription - February 2026', NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087',
   'INV-NZV-2026-003', 'sent', 2500.00, 325.00, 2825.00, 0, 2825.00,
   NOW() + INTERVAL '15 days', NOW(), 'Platform subscription - March 2026', NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087',
   'INV-NZV-2025-011', 'paid', 2200.00, 286.00, 2486.00, 2486.00, 0,
   NOW() - INTERVAL '90 days', NOW() - INTERVAL '120 days', 'Platform subscription - November 2025', NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087',
   'INV-NZV-2025-012', 'paid', 2200.00, 286.00, 2486.00, 2486.00, 0,
   NOW() - INTERVAL '60 days', NOW() - INTERVAL '90 days', 'Platform subscription - December 2025', NOW(), NOW());

INSERT INTO billing_payments (id, organization_id, invoice_id, amount, currency, status,
  payment_method, card_last4, card_brand, created_at, updated_at)
SELECT gen_random_uuid(), bi.organization_id, bi.id, bi.amount_paid, 'CAD', 'succeeded',
  'card', '4242', 'visa', bi.issued_at + INTERVAL '10 days', bi.issued_at + INTERVAL '10 days'
FROM billing_invoices bi
WHERE bi.organization_id = '458a56cb-251a-4c91-a0b5-81bb8ac39087'
  AND bi.status = 'paid';

COMMIT;

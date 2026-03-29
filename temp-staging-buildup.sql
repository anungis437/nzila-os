-- =============================================================================
-- CAPE-ACEP & CUPE Local 123 – Comprehensive Data Build-Up
-- Fills gaps: CBA clauses (L123), negotiations, stewards, steward assignments,
-- training programs, voting sessions + options, workplace incidents,
-- documents, union dues receipts, and additional members for Local 123.
-- =============================================================================
-- Org IDs
--   CAPE-ACEP:     885aa4e0-5dc1-45bf-ad32-86477868e8ea
--   CUPE Local 123: 4a20966a-2f17-46b5-9b84-b3efea57b50a
-- =============================================================================
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Additional CUPE Local 123 Members (bring from 4 → 12)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO organization_members (id, organization_id, user_id, role, status, name, email, department, position, membership_number, hire_date, seniority, created_at, updated_at)
VALUES
  ('d1a00001-0001-4000-8000-000000000001', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-005', 'steward', 'active', 'Jean-Pierre Tremblay', 'jp.tremblay@cupe123.ca', 'Building Services', 'Senior Inspector', 'CL123-005', '2014-03-15', 12, now(), now()),
  ('d1a00001-0001-4000-8000-000000000002', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-006', 'member', 'active', 'Fatima Al-Rashid', 'f.alrashid@cupe123.ca', 'Community Services', 'Program Coordinator', 'CL123-006', '2019-07-01', 7, now(), now()),
  ('d1a00001-0001-4000-8000-000000000003', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-007', 'member', 'active', 'David Okafor', 'david.okafor@cupe123.ca', 'Roads and Drainage', 'Equipment Operator', 'CL123-007', '2020-01-10', 6, now(), now()),
  ('d1a00001-0001-4000-8000-000000000004', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-008', 'member', 'active', 'Sophie Martin', 'sophie.martin@cupe123.ca', 'City Clerk''s Office', 'Administrative Assistant', 'CL123-008', '2017-09-20', 9, now(), now()),
  ('d1a00001-0001-4000-8000-000000000005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-009', 'member', 'active', 'Carlos Vega', 'carlos.vega@cupe123.ca', 'Parks and Facilities', 'Parks Maintenance Worker', 'CL123-009', '2021-05-01', 5, now(), now()),
  ('d1a00001-0001-4000-8000-000000000006', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-010', 'steward', 'active', 'Priya Sharma', 'priya.sharma@cupe123.ca', 'Building Operations', 'Building Maintenance Technician', 'CL123-010', '2018-11-15', 8, now(), now()),
  ('d1a00001-0001-4000-8000-000000000007', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-011', 'member', 'active', 'Liam Chen', 'liam.chen@cupe123.ca', 'Information Technology', 'IT Support Analyst', 'CL123-011', '2022-03-01', 4, now(), now()),
  ('d1a00001-0001-4000-8000-000000000008', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'usr-l123-012', 'member', 'active', 'Isabelle Nguyen', 'isabelle.nguyen@cupe123.ca', 'Ottawa Public Library', 'Library Technician', 'CL123-012', '2023-01-15', 3, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CBA Clauses for CUPE Local 123 (Inside Workers CBA)
--    CBA ID: 12a1844e-014d-48c6-9e9a-543942d42517
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO cba_clauses (id, organization_id, cba_id, clause_number, clause_type, title, content, article_number, order_index, created_at, updated_at)
VALUES
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '1.01', 'other', 'Purpose and Scope',
   'This Agreement is entered into between the City of Ottawa (the Employer) and the Canadian Union of Public Employees, Local 123 (the Union) for the purpose of establishing rates of pay, hours of work, and other working conditions.',
   '1', 1, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '2.01', 'union_rights', 'Recognition of the Union',
   'The Employer recognizes CUPE Local 123 as the sole and exclusive bargaining agent for all employees in the bargaining unit as defined in the certificate issued by the Ontario Labour Relations Board.',
   '2', 2, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '3.01', 'union_rights', 'Union Security – Dues Check-Off',
   'The Employer shall deduct from each pay of each employee in the bargaining unit an amount equal to the regular monthly union dues as certified by the Union. Dues shall be remitted to the Union within fifteen (15) days.',
   '3', 3, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '4.01', 'management_rights', 'Management Rights',
   'The Union acknowledges the right of the Employer to manage the enterprise, direct the workforce, determine job content and work methods, and maintain order and efficiency, subject to the provisions of this Agreement.',
   '4', 4, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '5.01', 'disciplinary_procedures', 'No Discrimination',
   'The Employer and the Union agree that there shall be no discrimination, interference, restriction, or coercion exercised or practised with respect to any employee by reason of race, colour, creed, national origin, sex, sexual orientation, gender identity, marital status, disability, age, or union membership.',
   '5', 5, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '6.01', 'grievance_arbitration', 'Grievance Procedure – Definition',
   'A grievance shall mean any difference arising out of the interpretation, application, administration, or alleged violation of this Agreement, including any question as to whether a matter is arbitrable.',
   '6', 6, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '6.02', 'grievance_arbitration', 'Grievance Procedure – Step 1 (Informal)',
   'An employee who has a complaint shall first discuss the matter with the immediate supervisor within ten (10) working days of becoming aware of the circumstances giving rise to the complaint. A steward may be present at the employee''s request.',
   '6', 7, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '6.03', 'grievance_arbitration', 'Grievance Procedure – Step 2 (Formal)',
   'Failing settlement at Step 1, the grievance shall be submitted in writing to the Department Head within five (5) working days. The Department Head shall render a decision within ten (10) working days.',
   '6', 8, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '6.04', 'grievance_arbitration', 'Arbitration',
   'Failing settlement at Step 2, either party may refer the grievance to arbitration within thirty (30) calendar days. The arbitration shall be conducted by a single arbitrator mutually agreed upon, or failing agreement, appointed by the Ontario Minister of Labour.',
   '6', 9, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '7.01', 'seniority_promotion', 'Seniority – Definition and Application',
   'Seniority shall be defined as the length of continuous service with the Employer from the date of last hire. Seniority shall be the determining factor in matters of layoff, recall, and filling vacancies, provided the employee has the ability to perform the work.',
   '7', 10, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '8.01', 'hours_scheduling', 'Hours of Work',
   'The regular work week shall consist of thirty-five (35) hours per week, seven (7) hours per day, Monday through Friday. The Employer may schedule employees on compressed work weeks where operationally feasible, subject to mutual agreement.',
   '8', 11, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '9.01', 'overtime', 'Overtime',
   'All authorized work performed in excess of the regular daily or weekly hours shall be paid at one and one-half (1½) times the regular rate for the first four hours and double (2×) the regular rate thereafter. Overtime shall be distributed equitably among qualified employees.',
   '9', 12, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '10.01', 'working_conditions', 'Designated Holidays',
   'The following shall be recognized as designated paid holidays: New Year''s Day, Family Day, Good Friday, Easter Monday, Victoria Day, Canada Day, Civic Holiday, Labour Day, National Day for Truth and Reconciliation, Thanksgiving Day, Remembrance Day, Christmas Day, Boxing Day.',
   '10', 13, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '11.01', 'vacation_leave', 'Vacation Entitlement',
   'Vacation entitlement: less than 1 year – prorated; 1–7 years – 15 days; 8–14 years – 20 days; 15–24 years – 25 days; 25+ years – 30 days. Vacation pay shall be at the employee''s regular rate of pay.',
   '11', 14, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '12.01', 'vacation_leave', 'Sick Leave',
   'An employee shall earn sick leave credits at the rate of one and one-quarter (1.25) days per month. Unused sick leave may be accumulated up to a maximum of two hundred (200) working days.',
   '12', 15, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '13.01', 'wages_compensation', 'Rates of Pay',
   'The rates of pay shall be as set out in Appendix A attached hereto and forming part of this Agreement. Effective January 1 of each year of this Agreement, all rates shall be increased by: Year 1 – 2.5%, Year 2 – 2.75%, Year 3 – 3.0%, Year 4 – 2.5%.',
   '13', 16, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '14.01', 'other', 'Occupational Health and Safety',
   'The Employer and the Union agree to cooperate to maintain a safe and healthy workplace. A Joint Health and Safety Committee shall be established in accordance with the Occupational Health and Safety Act. The Committee shall meet monthly and conduct quarterly workplace inspections.',
   '14', 17, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '15.01', 'benefits_insurance', 'Employee Benefits',
   'The Employer shall provide Group Life Insurance, Extended Health Care, Dental Plan, and Long-Term Disability coverage. Premium sharing: Employer 75%, Employee 25% for health and dental; Employer 100% for life insurance and LTD.',
   '15', 18, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '16.01', 'disciplinary_procedures', 'Discipline and Discharge',
   'No employee shall be disciplined or discharged without just cause. The Employer shall follow principles of progressive discipline. A disciplinary record shall be removed from an employee''s file after eighteen (18) months, provided no further discipline has occurred.',
   '16', 19, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '12a1844e-014d-48c6-9e9a-543942d42517',
   '17.01', 'job_security', 'Layoff and Recall',
   'In the event of layoff, employees shall be laid off in reverse order of seniority within their classification, provided the remaining employees have the qualifications and ability to perform the available work. Recall shall be in order of seniority for a period of twenty-four (24) months.',
   '17', 20, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Clauses for Outside Workers CBA (c89170f0-256f-44f3-a579-894360c2675c)
INSERT INTO cba_clauses (id, organization_id, cba_id, clause_number, clause_type, title, content, article_number, order_index, created_at, updated_at)
VALUES
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '1.01', 'other', 'Purpose and Scope',
   'This Agreement covers all outside workers employed by the City of Ottawa in the classifications listed in Appendix B, including maintenance, parks, roads, and utilities workers.',
   '1', 1, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '2.01', 'union_rights', 'Union Recognition',
   'The Employer recognizes CUPE Local 123 as the exclusive bargaining agent for all outside workers. The Employer shall deduct union dues from each bi-weekly pay.',
   '2', 2, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '5.01', 'hours_scheduling', 'Hours of Work – Outside Workers',
   'The regular work week for outside workers shall consist of forty (40) hours, eight (8) hours per day, Monday through Friday. Seasonal adjustments may apply for winter operations with a 4-day/10-hour schedule.',
   '5', 3, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '6.01', 'overtime', 'Overtime – Outside Workers',
   'Overtime for outside workers shall be paid at double time (2×) for all hours worked beyond the regular shift. Call-back premium: minimum four (4) hours at overtime rate.',
   '6', 4, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '8.01', 'other', 'Safety Equipment and PPE',
   'The Employer shall supply and maintain all required personal protective equipment including safety boots ($250 annual allowance), hard hats, high-visibility vests, gloves, and hearing protection. Employees are required to wear PPE as prescribed.',
   '8', 5, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '9.01', 'wages_compensation', 'Rates of Pay – Outside Workers',
   'Rates of pay for outside worker classifications shall be as set out in Appendix B. A shift differential of $1.25/hour applies for evening shift and $1.75/hour for night shift. A lead hand premium of $1.50/hour applies when designated.',
   '9', 6, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '10.01', 'working_conditions', 'Inclement Weather',
   'When weather conditions prevent outside work, employees shall report to the designated indoor facility. The Employer shall provide heated shelters at outdoor worksites during winter operations.',
   '10', 7, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'c89170f0-256f-44f3-a579-894360c2675c',
   '12.01', 'benefits_insurance', 'Benefits – Outside Workers',
   'In addition to the benefits under Article 15 of the Inside Workers Agreement, outside workers shall receive a tool allowance of $500 per year and a clothing allowance of $400 per year for work-related attire not covered by PPE.',
   '12', 8, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Negotiations
-- ─────────────────────────────────────────────────────────────────────────────
-- CAPE already has 1 negotiation. Add one for the TC Group renewal.
INSERT INTO negotiations (id, organization_id, expiring_cba_id, title, description, union_name, employer_name, bargaining_unit_size, notice_given_date, first_session_date, target_completion_date, status, current_round, total_sessions, key_issues, estimated_cost, progress_summary, last_activity_date, created_by, created_at, updated_at)
VALUES
  ('bb000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea',
   'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
   'CAPE TC Group 2025 Renewal Negotiations',
   'Renewal negotiations for the Translation and Interpretation (TC) Group collective agreement. Key focus on salary parity with other professional groups and remote work provisions.',
   'CAPE', 'Treasury Board of Canada', 1200,
   '2025-03-01', '2025-06-15', '2026-06-30',
   'active', 4, 8,
   '["Salary parity with EC group","Remote work 3 days/week","Mental health coverage expansion","Professional development allowance increase"]',
   15000000, 'Reached tentative agreement on remote work provisions. Salary discussions ongoing. Fourth round completed with productive exchange on benefits.',
   '2026-03-15', 'system-seed', now(), now())
ON CONFLICT (id) DO NOTHING;

-- L123 – Inside Workers CBA renewal (expired CBA)
INSERT INTO negotiations (id, organization_id, expiring_cba_id, resulting_cba_id, title, description, union_name, union_local, employer_name, bargaining_unit_size, notice_given_date, first_session_date, target_completion_date, tentative_agreement_date, ratification_date, completion_date, status, current_round, total_sessions, key_issues, strike_vote_passed, strike_vote_date, strike_vote_yes_percent, estimated_cost, progress_summary, last_activity_date, created_by, created_at, updated_at)
VALUES
  ('bb000001-0001-4000-8000-000000000002', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
   'ca9c6388-a7ec-40b7-91b1-44380641e394',
   '12a1844e-014d-48c6-9e9a-543942d42517',
   '2023 Inside Workers CBA Renewal',
   'Renewal of the 2020-2023 Inside Workers collective agreement. Negotiations concluded successfully after 12 sessions with a ratified agreement effective 2024-01-01.',
   'CUPE', 'Local 123', 'City of Ottawa', 450,
   '2023-06-01', '2023-09-15', '2024-01-01',
   '2023-11-20', '2023-12-10', '2023-12-15',
   'completed', 12, 12,
   '["Wage increase matching inflation","Remote work for eligible positions","Mental health days","Childcare support","Anti-harassment policy strengthening"]',
   true, '2023-10-28', 87.3,
   8500000,
   'Completed – 12 sessions. Strike vote passed Oct 28 with 87.3% support which accelerated employer concessions. Tentative agreement Nov 20. Ratified Dec 10 with 91% approval.',
   '2023-12-15', 'system-seed', now(), now())
ON CONFLICT (id) DO NOTHING;

-- L123 – Outside Workers current negotiation
INSERT INTO negotiations (id, organization_id, expiring_cba_id, title, description, union_name, union_local, employer_name, bargaining_unit_size, notice_given_date, first_session_date, target_completion_date, status, current_round, total_sessions, key_issues, estimated_cost, progress_summary, last_activity_date, created_by, created_at, updated_at)
VALUES
  ('bb000001-0001-4000-8000-000000000003', '4a20966a-2f17-46b5-9b84-b3efea57b50a',
   'c89170f0-256f-44f3-a579-894360c2675c',
   'Outside Workers CBA Mid-Term Review 2026',
   'Mid-term review of the Outside Workers agreement focusing on safety equipment standards and seasonal scheduling.',
   'CUPE', 'Local 123', 'City of Ottawa', 320,
   '2026-01-15', '2026-02-20', '2026-06-30',
   'active', 2, 6,
   '["Updated PPE standards","Winter operations scheduling","Tool allowance increase","EV transition training"]',
   2000000,
   'Two sessions completed. Agreement in principle on PPE standards update. Scheduling discussions underway.',
   '2026-03-10', 'system-seed', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Stewards
-- ─────────────────────────────────────────────────────────────────────────────
-- CAPE stewards
INSERT INTO stewards (id, org_id, user_id, region, specialization, active, max_caseload, current_caseload, created_at, updated_at)
VALUES
  ('cc000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '3ea05964-824e-4e5a-a22f-4111c6f0f774', 'National Capital Region', 'Grievances – Classification', true, 15, 6, now(), now()),
  ('cc000001-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cf3c73a8-3424-4c41-8a4e-bf5e6dcfd3a9', 'National Capital Region', 'Harassment and Discipline', true, 12, 4, now(), now()),
  ('cc000001-0001-4000-8000-000000000003', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'b45b99ed-fe83-4166-8b98-e4a3246e0131', 'Western Canada', 'Health & Safety', true, 10, 3, now(), now()),
  ('cc000001-0001-4000-8000-000000000004', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'df93b6d0-f9b4-4689-a75b-360a8a95c882', 'Quebec', 'Pay and Benefits', true, 12, 5, now(), now())
ON CONFLICT (id) DO NOTHING;

-- L123 stewards (use member id as user_id since stewards.user_id is UUID)
INSERT INTO stewards (id, org_id, user_id, region, specialization, active, max_caseload, current_caseload, created_at, updated_at)
VALUES
  ('cc000001-0001-4000-8000-000000000005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'd1a00001-0001-4000-8000-000000000001', 'Ottawa – Inside', 'Grievances – General', true, 12, 5, now(), now()),
  ('cc000001-0001-4000-8000-000000000006', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'd1a00001-0001-4000-8000-000000000006', 'Ottawa – Outside', 'Health & Safety', true, 10, 7, now(), now()),
  ('cc000001-0001-4000-8000-000000000007', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2f5bdfe0-7d87-47b7-b2c3-36242b256a4f', 'Ottawa – Inside', 'Discipline and Discharge', true, 10, 4, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Steward Assignments
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO steward_assignments (id, organization_id, steward_id, steward_type, status, department, start_date, members_covered, training_completed, training_completion_date, certification_date, certification_expiry, preferred_contact_method, notes, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000001-0001-4000-8000-000000000001', 'chief_steward', 'active', 'Translation Bureau', '2024-06-01', 85, true, '2024-05-15', '2024-06-01', '2027-06-01', 'email', 'Chief steward – PA Group NCR', now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000001-0001-4000-8000-000000000002', 'steward', 'active', 'Policy and Programs', '2025-01-10', 60, true, '2024-12-20', '2025-01-10', '2028-01-10', 'phone', 'Handles harassment cases in Policy branch', now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000001-0001-4000-8000-000000000003', 'steward', 'active', 'Regional Operations', '2025-03-01', 45, true, '2025-02-15', '2025-03-01', '2028-03-01', 'email', 'Western Canada regional steward', now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cc000001-0001-4000-8000-000000000004', 'steward', 'active', 'Financial Services', '2024-09-15', 70, true, '2024-09-01', '2024-09-15', '2027-09-15', 'email', 'Specializes in pay equity and classification grievances', now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cc000001-0001-4000-8000-000000000005', 'chief_steward', 'active', 'Administrative Services', '2024-01-15', 120, true, '2024-01-10', '2024-01-15', '2027-01-15', 'phone', 'Chief steward for Inside Workers unit', now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cc000001-0001-4000-8000-000000000006', 'steward', 'active', 'Parks and Roads', '2025-04-01', 95, true, '2025-03-20', '2025-04-01', '2028-04-01', 'phone', 'Health & Safety lead for outdoor crews', now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'cc000001-0001-4000-8000-000000000007', 'steward', 'active', 'Public Works', '2024-06-01', 80, true, '2024-05-28', '2024-06-01', '2027-06-01', 'email', 'Handles discipline and discharge cases', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Training Programs
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO training_programs (id, organization_id, program_name, program_description, program_duration, provides_certification, certification_name, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Steward Fundamentals', 'Introduction to steward duties, rights, and responsibilities under the collective agreement. Covers duty of fair representation, grievance intake procedures, and time limits.', '2 days', true, 'CAPE Steward Certificate', true, now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Advanced Grievance Handling', 'In-depth grievance investigation, evidence gathering, preparation for hearings, and settlement negotiation techniques.', '3 days', true, 'Advanced Grievance Certificate', true, now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Workplace Harassment Prevention', 'Recognizing, responding to, and preventing workplace harassment and violence. Includes trauma-informed approaches.', '1 day', false, NULL, true, now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Collective Bargaining Essentials', 'Preparation for bargaining: proposal development, costing, negotiation strategies, and ratification processes.', '5 days', true, 'Bargaining Team Certificate', true, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE Steward Training – Level 1', 'Basic steward rights and responsibilities, understanding the collective agreement, and grievance filing procedures. Aligns with CUPE National education program.', '2 days', true, 'CUPE Steward Level 1', true, now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'WHMIS and Workplace Safety', 'Workplace Hazardous Materials Information System training plus site-specific safety orientation for inside and outside workers.', '1 day', true, 'WHMIS Certificate', true, now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Joint Health & Safety Committee', 'Training for JHSC members: inspections, accident investigation, right to refuse, and recommending corrective actions.', '3 days', true, 'JHSC Certification Part 1', true, now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Duty of Fair Representation', 'Understanding the legal duty of fair representation, avoiding arbitrary or discriminatory conduct, communicating decisions to members.', '1 day', false, NULL, true, now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Winter Operations Safety', 'Seasonal safety protocols for snow removal, salting, and cold weather operations. Equipment operation and emergency procedures.', '1 day', true, 'Winter Ops Safety Certificate', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Voting Sessions & Options
-- ─────────────────────────────────────────────────────────────────────────────
-- CAPE – Ratification vote
INSERT INTO voting_sessions (id, title, description, type, status, meeting_type, organization_id, created_by, created_at, updated_at, start_time, end_time, requires_quorum, quorum_threshold, total_eligible_voters)
VALUES
  ('dd000001-0001-4000-8000-000000000001', 'Ratification Vote – PA Group CBA 2024-2028', 'Members vote to ratify the tentative agreement reached between CAPE and the Treasury Board for the PA Group.', 'ratification', 'completed', 'general_membership', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'admin@cape-acep.ca', now(), now(), '2024-11-15 09:00:00-05', '2024-11-17 17:00:00-05', true, 50, 2400),
  ('dd000001-0001-4000-8000-000000000002', 'Board of Directors Election 2026', 'Election for four board positions: President, Vice-President, Secretary-Treasurer, and Member-at-Large.', 'election', 'active', 'annual_general_meeting', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'admin@cape-acep.ca', now(), now(), '2026-04-01 09:00:00-04', '2026-04-03 17:00:00-04', true, 33, 2400)
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000001', 'Accept', 'Accept the tentative agreement as presented', 1, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000001', 'Reject', 'Reject the tentative agreement and return to bargaining', 2, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000002', 'Marie-France Gauthier', 'Candidate for President – 12 years CAPE experience', 1, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000002', 'Robert Bhérer', 'Candidate for President – Former VP, 8 years service', 2, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000002', 'Abstain', 'Abstain from voting', 3, now(), now())
ON CONFLICT (id) DO NOTHING;

-- L123 – Strike vote and bylaw amendment
INSERT INTO voting_sessions (id, title, description, type, status, meeting_type, organization_id, created_by, created_at, updated_at, start_time, end_time, requires_quorum, quorum_threshold, total_eligible_voters)
VALUES
  ('dd000001-0001-4000-8000-000000000003', 'Strike Authorization Vote – Outside Workers', 'Vote to authorize a legal strike if necessary during the Outside Workers CBA mid-term review. Requires 50%+1 of eligible voters.', 'strike_authorization', 'completed', 'special_meeting', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'president@cupe123.ca', now(), now(), '2026-02-10 18:00:00-05', '2026-02-10 21:00:00-05', true, 50, 320),
  ('dd000001-0001-4000-8000-000000000004', 'Bylaw Amendment – Dues Increase', 'Proposal to increase monthly dues by $5 to fund the strike fund and legal defence costs. Requires two-thirds majority.', 'bylaw_amendment', 'completed', 'general_membership', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'president@cupe123.ca', now(), now(), '2026-01-20 19:00:00-05', '2026-01-20 21:00:00-05', true, 50, 770),
  ('dd000001-0001-4000-8000-000000000005', 'Annual General Meeting – Executive Elections', 'Election of executive officers for the 2026-2028 term.', 'election', 'active', 'annual_general_meeting', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'president@cupe123.ca', now(), now(), '2026-04-15 18:30:00-04', '2026-04-15 22:00:00-04', true, 25, 770)
ON CONFLICT (id) DO NOTHING;

INSERT INTO voting_options (id, session_id, text, description, order_index, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000003', 'Yes – Authorize Strike', 'Authorize the executive to call a legal strike if negotiations fail', 1, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000003', 'No – Continue Negotiating', 'Do not authorize a strike at this time', 2, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000004', 'Approve Dues Increase', 'Approve the $5/month dues increase effective July 2026', 1, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000004', 'Reject Dues Increase', 'Reject the proposed dues increase', 2, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000005', 'Jean-Pierre Tremblay', 'Candidate for President – Steward, 12 years with the City', 1, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000005', 'Grace Lee', 'Candidate for President – Current Secretary-Treasurer', 2, now(), now()),
  (gen_random_uuid(), 'dd000001-0001-4000-8000-000000000005', 'Abstain', 'Abstain from voting', 3, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Workplace Incidents
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO workplace_incidents (id, organization_id, incident_number, incident_type, severity, incident_date, reported_date, location_description, department_name, injured_person_name, injured_person_job_title, description, what_happened, investigation_required, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAPE-INC-2026-001', 'ergonomic', 'minor',
   '2026-01-15 10:30:00-05', '2026-01-15 14:00:00-05',
   'Place du Portage Phase III, 4th Floor, Cubicle 412', 'Translation Bureau',
   'Sarah Lefebvre', 'Translator (TR-02)',
   'Repetitive strain injury from prolonged keyboard use without ergonomic equipment.',
   'Employee reported wrist pain after several months of intensive translation work. Workstation had not been assessed for ergonomics in over 3 years.',
   true, now(), now()),

  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CAPE-INC-2026-002', 'other', 'moderate',
   '2026-02-20 11:00:00-05', '2026-02-21 09:00:00-05',
   'L''Esplanade Laurier, Tower A, 12th Floor', 'Policy and Programs',
   'Daniel Kim', 'Policy Analyst (EC-05)',
   'Workplace harassment complaint involving sustained pattern of exclusion from team activities and unreasonable performance expectations.',
   'Employee filed formal harassment complaint citing six months of documented incidents. Matter referred to informal conflict resolution and JHSC.',
   true, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE123-INC-2026-001', 'fall', 'serious',
   '2026-01-08 07:45:00-05', '2026-01-08 08:30:00-05',
   'Merivale Road Operations Yard', 'Roads and Drainage',
   'David Okafor', 'Equipment Operator',
   'Slip and fall on icy surface in operations yard during early morning winter shift.',
   'Employee slipped on unmarked icy patch in the equipment staging area. Landed on right shoulder. Transported to hospital. Diagnosis: rotator cuff tear. 6 weeks lost time.',
   true, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE123-INC-2026-002', 'vehicle', 'moderate',
   '2026-02-14 13:20:00-05', '2026-02-14 14:00:00-05',
   'Bank Street and Somerset Avenue intersection', 'Parks and Facilities',
   'Carlos Vega', 'Parks Maintenance Worker',
   'Minor vehicle collision while operating City pickup truck at intersection.',
   'City vehicle struck by private vehicle running a red light. Employee reports neck stiffness but was able to continue working with restrictions. Vehicle damage estimated at $4,500.',
   true, now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CUPE123-INC-2026-003', 'exposure', 'minor',
   '2026-03-05 10:15:00-05', '2026-03-05 11:00:00-05',
   'City Hall – Maintenance Level B2', 'Building Operations',
   'Liam Chen', 'Building Maintenance Worker',
   'Chemical splash from cleaning solution due to container failure.',
   'While transferring industrial cleaning concentrate, container cracked and splashed onto employee forearms. First aid administered. No lasting effects. Batch of containers quarantined for inspection.',
   false, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Documents
-- ─────────────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Ensure orgs rows exist (documents.org_id FK → orgs.id)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO orgs (id, legal_name, jurisdiction, status, created_at, updated_at)
VALUES
  ('885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Canadian Association of Professional Employees (CAPE-ACEP)', 'CA-ON', 'active', now(), now()),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Canadian Union of Public Employees, Local 123', 'CA-ON', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO documents (id, organization_id, org_id, category, title, blob_container, blob_path, content_type, sha256, uploaded_by, classification, name, description, is_confidential, access_level, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'filing', 'CAPE PA Group CBA 2024-2028', 'documents', 'cape/cba/CAPE-PA-CBA-2024-2028.pdf', 'application/pdf', 'seed-placeholder-sha256-001', 'system-seed', 'internal', 'CAPE-PA-CBA-2024-2028.pdf', 'Ratified collective agreement for the PA Group effective 2024-2028.', false, 'member', now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'filing', 'CAPE EC Group CBA 2018-2021', 'documents', 'cape/cba/CAPE-EC-CBA-2018-2021.pdf', 'application/pdf', 'seed-placeholder-sha256-002', 'system-seed', 'internal', 'CAPE-EC-CBA-2018-2021.pdf', 'Expired collective agreement for the EC Group.', false, 'member', now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'filing', 'CAPE Anti-Harassment Policy', 'documents', 'cape/policy/CAPE-Anti-Harassment-Policy-2025.pdf', 'application/pdf', 'seed-placeholder-sha256-003', 'system-seed', 'internal', 'CAPE-Anti-Harassment-Policy-2025.pdf', 'Updated anti-harassment and violence prevention policy.', false, 'member', now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'year_end', 'CAPE 2025 Audited Financial Statements', 'documents', 'cape/financial/CAPE-Financial-Statements-2025.pdf', 'application/pdf', 'seed-placeholder-sha256-004', 'system-seed', 'confidential', 'CAPE-Financial-Statements-2025.pdf', 'Auditor-reviewed financial statements for fiscal year 2025.', true, 'executive', now(), now()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'other', 'Steward Handbook 2026', 'documents', 'cape/training/CAPE-Steward-Handbook-2026.pdf', 'application/pdf', 'seed-placeholder-sha256-005', 'system-seed', 'internal', 'CAPE-Steward-Handbook-2026.pdf', 'Comprehensive guide for CAPE stewards covering rights, procedures, and resources.', false, 'steward', now(), now()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'filing', 'CUPE Local 123 Inside Workers CBA 2024-2027', 'documents', 'cupe123/cba/CUPE123-Inside-CBA-2024-2027.pdf', 'application/pdf', 'seed-placeholder-sha256-006', 'system-seed', 'internal', 'CUPE123-Inside-CBA-2024-2027.pdf', 'Current collective agreement for inside workers including administrative, clerical, and technical staff.', false, 'member', now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'filing', 'CUPE Local 123 Outside Workers CBA 2024-2027', 'documents', 'cupe123/cba/CUPE123-Outside-CBA-2024-2027.pdf', 'application/pdf', 'seed-placeholder-sha256-007', 'system-seed', 'internal', 'CUPE123-Outside-CBA-2024-2027.pdf', 'Current collective agreement for outside workers including parks, roads, and utilities.', false, 'member', now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'other', 'JHSC Annual Report 2025', 'documents', 'cupe123/reports/CUPE123-JHSC-Report-2025.pdf', 'application/pdf', 'seed-placeholder-sha256-008', 'system-seed', 'internal', 'CUPE123-JHSC-Report-2025.pdf', 'Joint Health and Safety Committee annual report covering inspections, incidents, and recommendations.', false, 'member', now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'resolution', 'CUPE Local 123 Bylaws (Amended 2025)', 'documents', 'cupe123/governance/CUPE123-Bylaws-2025.pdf', 'application/pdf', 'seed-placeholder-sha256-009', 'system-seed', 'public', 'CUPE123-Bylaws-2025.pdf', 'Local bylaws as amended at the 2025 Annual General Meeting.', false, 'public', now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'year_end', 'CUPE Local 123 Budget 2026', 'documents', 'cupe123/financial/CUPE123-Budget-2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'seed-placeholder-sha256-010', 'system-seed', 'confidential', 'CUPE123-Budget-2026.xlsx', 'Approved operating budget for 2026 including strike fund allocation.', true, 'executive', now(), now()),
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'other', 'Winter Operations Safety Manual', 'documents', 'cupe123/training/CUPE123-Winter-Ops-Safety-2026.pdf', 'application/pdf', 'seed-placeholder-sha256-011', 'system-seed', 'internal', 'CUPE123-Winter-Ops-Safety-2026.pdf', 'Safety procedures for winter operations including snow removal and salting.', false, 'member', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Union Dues Receipts (2025 tax year)
-- ─────────────────────────────────────────────────────────────────────────────
-- CAPE members – selected sample
INSERT INTO union_dues_receipts (id, user_id, organization_id, tax_year, member_name, member_province, union_name, union_business_number, union_address, union_city, union_province, union_postal_code, total_union_dues, regular_dues, special_assessments, initiation_fees, non_deductible_amount, cope_contributions, collection_method, employer_deducted, employer_name, is_quebec_resident, delivered_to_member, is_amendment, receipt_number, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'cape-user-009', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2025', 'Alexandre Moreau', 'ON', 'Canadian Association of Professional Employees', '119217168RR0001', '100 Queen Street', 'Ottawa', 'ON', 'K1P 1J9', 1245.60, 1185.60, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'Treasury Board of Canada Secretariat', false, false, false, 'CAPE-2025-001', 'generated', now(), now()),
  (gen_random_uuid(), 'cape-user-004', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2025', 'Chantal Bertrand', 'QC', 'Canadian Association of Professional Employees', '119217168RR0001', '100 Queen Street', 'Ottawa', 'ON', 'K1P 1J9', 1245.60, 1185.60, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'Treasury Board of Canada Secretariat', true, false, false, 'CAPE-2025-002', 'generated', now(), now()),
  (gen_random_uuid(), 'cape-user-007', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2025', 'Daniel Kim', 'ON', 'Canadian Association of Professional Employees', '119217168RR0001', '100 Queen Street', 'Ottawa', 'ON', 'K1P 1J9', 1245.60, 1185.60, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'Treasury Board of Canada Secretariat', false, false, false, 'CAPE-2025-003', 'generated', now(), now()),
  (gen_random_uuid(), 'cape-user-008', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2025', 'Sarah Lefebvre', 'ON', 'Canadian Association of Professional Employees', '119217168RR0001', '100 Queen Street', 'Ottawa', 'ON', 'K1P 1J9', 1245.60, 1185.60, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'Treasury Board of Canada Secretariat', false, false, false, 'CAPE-2025-004', 'generated', now(), now()),
  (gen_random_uuid(), 'cape-user-002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2025', 'Emmanuelle Tremblay', 'QC', 'Canadian Association of Professional Employees', '119217168RR0001', '100 Queen Street', 'Ottawa', 'ON', 'K1P 1J9', 1245.60, 1185.60, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'Treasury Board of Canada Secretariat', true, false, false, 'CAPE-2025-005', 'generated', now(), now()),
  (gen_random_uuid(), 'cape-user-006', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2025', 'Nadia Ouellet', 'QC', 'Canadian Association of Professional Employees', '119217168RR0001', '100 Queen Street', 'Ottawa', 'ON', 'K1P 1J9', 1245.60, 1185.60, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'Treasury Board of Canada Secretariat', true, false, false, 'CAPE-2025-006', 'generated', now(), now())
ON CONFLICT (id) DO NOTHING;

-- L123 members
INSERT INTO union_dues_receipts (id, user_id, organization_id, tax_year, member_name, member_province, union_name, union_business_number, union_address, union_city, union_province, union_postal_code, total_union_dues, regular_dues, special_assessments, initiation_fees, non_deductible_amount, cope_contributions, collection_method, employer_deducted, employer_name, is_quebec_resident, delivered_to_member, is_amendment, receipt_number, status, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'user_3BP6Ienqg55Bk54Q8I3K5hh4Mk8', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'Alice Johnson', 'ON', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', false, false, false, 'CUPE123-2025-001', 'generated', now(), now()),
  (gen_random_uuid(), 'user_3BP6IlC0zg9MwHJDDNn7KCcR0MV', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'Bob Smith', 'ON', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', false, false, false, 'CUPE123-2025-002', 'generated', now(), now()),
  (gen_random_uuid(), 'user_3BP6IkK6vgBW4XjSTqfd3CsBjjv', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'Grace Lee', 'ON', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', false, false, false, 'CUPE123-2025-003', 'generated', now(), now()),
  (gen_random_uuid(), 'user_3BSzhd4q6moCIlT3PhkWbdiAhtA', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'Marie-Claire Dubois', 'QC', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', true, false, false, 'CUPE123-2025-004', 'generated', now(), now()),
  (gen_random_uuid(), 'usr-l123-005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'Jean-Pierre Tremblay', 'ON', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', false, false, false, 'CUPE123-2025-005', 'generated', now(), now()),
  (gen_random_uuid(), 'usr-l123-006', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'Fatima Al-Rashid', 'ON', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', false, false, false, 'CUPE123-2025-006', 'generated', now(), now()),
  (gen_random_uuid(), 'usr-l123-007', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'David Okafor', 'ON', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', false, false, false, 'CUPE123-2025-007', 'generated', now(), now()),
  (gen_random_uuid(), 'usr-l123-010', '4a20966a-2f17-46b5-9b84-b3efea57b50a', '2025', 'Priya Sharma', 'ON', 'Canadian Union of Public Employees, Local 123', '107886209RR0001', '21 Florence Street', 'Ottawa', 'ON', 'K2P 0W6', 936.00, 876.00, 60.00, 0.00, 0.00, 0.00, 'payroll_deduction', true, 'City of Ottawa', false, false, false, 'CUPE123-2025-008', 'generated', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Pension & Employment for New L123 Members
-- ─────────────────────────────────────────────────────────────────────────────
-- Ensure defaults exist (idempotent)
ALTER TABLE pension_members ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE pension_members ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE pension_members ALTER COLUMN updated_at SET DEFAULT now();

INSERT INTO pension_members (organization_id, plan_id, user_id, name, plan_name, enrollment_date, membership_status, years_of_service, vesting_status)
VALUES
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000001', 'Jean-Pierre Tremblay', 'CUPE National Pension Plan', '2014-03-15', 'active', 12, 'fully_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000002', 'Fatima Al-Rashid', 'CUPE National Pension Plan', '2019-07-01', 'active', 7, 'partially_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000003', 'David Okafor', 'CUPE National Pension Plan', '2020-01-10', 'active', 6, 'partially_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000004', 'Sophie Martin', 'CUPE National Pension Plan', '2017-09-20', 'active', 9, 'fully_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000005', 'Carlos Vega', 'CUPE National Pension Plan', '2021-05-01', 'active', 5, 'partially_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000006', 'Priya Sharma', 'CUPE National Pension Plan', '2018-11-15', 'active', 8, 'fully_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000007', 'Liam Chen', 'CUPE National Pension Plan', '2022-03-01', 'active', 4, 'not_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '3d7a994f-09b1-44f3-9155-329fa1d2d315', 'd1a00001-0001-4000-8000-000000000008', 'Isabelle Nguyen', 'CUPE National Pension Plan', '2023-01-15', 'active', 3, 'not_vested')
ON CONFLICT DO NOTHING;

INSERT INTO member_employment (id, member_id, organization_id, employment_status, employment_type, hire_date, seniority_date, job_title, department, pay_frequency, base_salary, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000001', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2014-03-15', '2014-03-15', 'Senior Inspector', 'Building Services', 'bi_weekly', 82500.00, now(), now()),
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000002', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2019-07-01', '2019-07-01', 'Program Coordinator', 'Community Services', 'bi_weekly', 71200.00, now(), now()),
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000003', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2020-01-10', '2020-01-10', 'Equipment Operator', 'Roads and Drainage', 'bi_weekly', 62800.00, now(), now()),
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000004', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2017-09-20', '2017-09-20', 'Administrative Assistant', 'City Clerk''s Office', 'bi_weekly', 58400.00, now(), now()),
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000005', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2021-05-01', '2021-05-01', 'Parks Maintenance Worker', 'Parks and Facilities', 'bi_weekly', 55600.00, now(), now()),
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000006', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2018-11-15', '2018-11-15', 'Building Maintenance Technician', 'Building Operations', 'bi_weekly', 68900.00, now(), now()),
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000007', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2022-03-01', '2022-03-01', 'IT Support Analyst', 'Information Technology', 'bi_weekly', 64500.00, now(), now()),
  (gen_random_uuid(), 'd1a00001-0001-4000-8000-000000000008', '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'active', 'full_time', '2023-01-15', '2023-01-15', 'Library Technician', 'Ottawa Public Library', 'bi_weekly', 52100.00, now(), now())
ON CONFLICT DO NOTHING;

-- Seniority for new L123 members
-- Seniority already set in the INSERT above; these UPDATEs are a no-op safety net.
UPDATE organization_members SET seniority = 12 WHERE id = 'd1a00001-0001-4000-8000-000000000001' AND seniority IS DISTINCT FROM 12;
UPDATE organization_members SET seniority = 7  WHERE id = 'd1a00001-0001-4000-8000-000000000002' AND seniority IS DISTINCT FROM 7;
UPDATE organization_members SET seniority = 6  WHERE id = 'd1a00001-0001-4000-8000-000000000003' AND seniority IS DISTINCT FROM 6;
UPDATE organization_members SET seniority = 9  WHERE id = 'd1a00001-0001-4000-8000-000000000004' AND seniority IS DISTINCT FROM 9;
UPDATE organization_members SET seniority = 5  WHERE id = 'd1a00001-0001-4000-8000-000000000005' AND seniority IS DISTINCT FROM 5;
UPDATE organization_members SET seniority = 8  WHERE id = 'd1a00001-0001-4000-8000-000000000006' AND seniority IS DISTINCT FROM 8;
UPDATE organization_members SET seniority = 4  WHERE id = 'd1a00001-0001-4000-8000-000000000007' AND seniority IS DISTINCT FROM 4;
UPDATE organization_members SET seniority = 3  WHERE id = 'd1a00001-0001-4000-8000-000000000008' AND seniority IS DISTINCT FROM 3;

COMMIT;


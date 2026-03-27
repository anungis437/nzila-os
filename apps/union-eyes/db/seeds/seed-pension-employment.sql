-- ============================================================
-- Seed: Pension enrollment, employment records & seniority
-- for CLC, CAPE-ACEP, and CUPE Local 123 organizations
-- ============================================================
-- CLC:        873cf59b-cef5-4d51-9a62-151512810449
--   Plan:     839407e3-27cc-4d72-b889-0d48f3915e9c  (CLC Solidarity Pension Fund)
--
-- CAPE-ACEP:  c09173ad-5ba4-498e-a483-b371fb5e248e
--   Plan:     6dda2682-b1be-4501-9c53-405dbfbc9760  (CAPE Professional Pension Plan)
--
-- Local 123:  4a20966a-2f17-46b5-9b84-b3efea57b50a
--   Plan:     b2c3d4e5-1234-4000-8000-000000000123  (CUPE Local 123 Pension Plan)
-- ============================================================

BEGIN;

-- ============================================================
-- 0a. Ensure column defaults exist (Drizzle ORM defines these
--     at the application level but they may be missing in the DB)
-- ============================================================
ALTER TABLE pension_members ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE pension_members ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE pension_members ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE pension_contributions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE pension_contributions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE pension_contributions ALTER COLUMN updated_at SET DEFAULT now();

-- ============================================================
-- 0b. Clean previous data for idempotency
-- ============================================================
DELETE FROM pension_contributions WHERE organization_id IN (
  '873cf59b-cef5-4d51-9a62-151512810449',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a'
);
DELETE FROM pension_members WHERE organization_id IN (
  '873cf59b-cef5-4d51-9a62-151512810449',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a'
);
DELETE FROM employment_history WHERE organization_id IN (
  '873cf59b-cef5-4d51-9a62-151512810449',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a'
);
DELETE FROM member_employment WHERE organization_id IN (
  '873cf59b-cef5-4d51-9a62-151512810449',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a'
);

-- ============================================================
-- 1. Update seniority on organization_members (CLC + Local 123)
--    CAPE already has seniority set from seed-demo-members-claims
-- ============================================================

-- CLC members (seniority derived from hire_date → 2026-03-27)
UPDATE organization_members SET seniority = 12 WHERE user_id = 'clc-user-001'; -- Hassan Yussuff    2014-05-01
UPDATE organization_members SET seniority = 9  WHERE user_id = 'clc-user-002'; -- Marie Clarke Walker 2017-06-15
UPDATE organization_members SET seniority = 7  WHERE user_id = 'clc-user-003'; -- Denis Bolduc       2019-09-01
UPDATE organization_members SET seniority = 6  WHERE user_id = 'clc-user-004'; -- Sophie Tremblay    2020-01-10
UPDATE organization_members SET seniority = 8  WHERE user_id = 'clc-user-005'; -- James Nguyen       2018-03-20
UPDATE organization_members SET seniority = 5  WHERE user_id = 'clc-user-006'; -- Rebecca Martin     2021-07-01
UPDATE organization_members SET seniority = 9  WHERE user_id = 'clc-user-007'; -- Louis Picard       2016-11-20
UPDATE organization_members SET seniority = 4  WHERE user_id = 'clc-user-008'; -- Angela Varga       2022-02-14
UPDATE organization_members SET seniority = 7  WHERE user_id = 'clc-user-009'; -- Patrick O''Connor  2019-08-05
UPDATE organization_members SET seniority = 3  WHERE user_id = 'clc-user-010'; -- Fatima Al-Rashid   2023-01-15

-- Local 123 members (assign hire_date and seniority)
UPDATE organization_members SET hire_date = '2019-03-15', seniority = 7
  WHERE id = 'beb4a1d7-fa51-4622-b118-2eff94decb45'; -- Alice Johnson
UPDATE organization_members SET hire_date = '2017-06-01', seniority = 9
  WHERE id = '2f5bdfe0-7d87-47b7-b2c3-36242b256a4f'; -- Bob Smith
UPDATE organization_members SET hire_date = '2021-09-01', seniority = 5
  WHERE id = '0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc'; -- Grace Lee
UPDATE organization_members SET hire_date = '2020-01-20', seniority = 6
  WHERE id = '8653b21c-9692-49b9-b519-128a7dc52558'; -- Marie-Claire Dubois

-- ============================================================
-- 2. Pension Members: CLC → CLC Solidarity Pension Fund
-- ============================================================
INSERT INTO pension_members (organization_id, plan_id, name, plan_name, enrollment_date, membership_status, years_of_service, vesting_status)
VALUES
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Hassan Yussuff', 'CLC Solidarity Pension Fund', '2014-11-01', 'active', 11.9, 'fully_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Marie Clarke Walker', 'CLC Solidarity Pension Fund', '2017-12-15', 'active', 8.8, 'fully_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Denis Bolduc', 'CLC Solidarity Pension Fund', '2020-03-01', 'active', 6.6, 'fully_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Sophie Tremblay', 'CLC Solidarity Pension Fund', '2020-07-10', 'active', 6.2, 'fully_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'James Nguyen', 'CLC Solidarity Pension Fund', '2018-09-20', 'active', 8.0, 'fully_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Rebecca Martin', 'CLC Solidarity Pension Fund', '2022-01-01', 'active', 4.7, 'partially_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Louis Picard', 'CLC Solidarity Pension Fund', '2017-05-20', 'active', 9.4, 'fully_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Angela Varga', 'CLC Solidarity Pension Fund', '2022-08-14', 'active', 4.1, 'partially_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Patrick O''Connor', 'CLC Solidarity Pension Fund', '2020-02-05', 'active', 6.6, 'fully_vested'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '839407e3-27cc-4d72-b889-0d48f3915e9c',
   'Fatima Al-Rashid', 'CLC Solidarity Pension Fund', '2023-07-15', 'active', 3.2, 'partially_vested');

-- ============================================================
-- 3. Pension Members: CAPE-ACEP → CAPE Professional Pension Plan
-- ============================================================
INSERT INTO pension_members (organization_id, plan_id, name, plan_name, enrollment_date, membership_status, years_of_service, vesting_status)
VALUES
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Greg Phillips', 'CAPE Professional Pension Plan', '2018-10-01', 'active', 8.0, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Emmanuelle Tremblay', 'CAPE Professional Pension Plan', '2019-12-01', 'active', 6.8, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Brian Faulkner', 'CAPE Professional Pension Plan', '2015-07-15', 'active', 11.2, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Chantal Bertrand', 'CAPE Professional Pension Plan', '2020-09-01', 'active', 6.1, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Mike Savard', 'CAPE Professional Pension Plan', '2018-03-15', 'active', 8.5, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Nadia Ouellet', 'CAPE Professional Pension Plan', '2021-07-10', 'active', 5.2, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Daniel Kim', 'CAPE Professional Pension Plan', '2022-11-01', 'active', 3.9, 'partially_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Sarah Lefebvre', 'CAPE Professional Pension Plan', '2017-01-20', 'active', 9.7, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Alexandre Moreau', 'CAPE Professional Pension Plan', '2023-09-01', 'active', 3.1, 'partially_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Jennifer Walsh', 'CAPE Professional Pension Plan', '2020-05-01', 'active', 6.4, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Pierre Desmarais', 'CAPE Professional Pension Plan', '2015-02-01', 'active', 11.7, 'fully_vested'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6dda2682-b1be-4501-9c53-405dbfbc9760',
   'Amira Hassan', 'CAPE Professional Pension Plan', '2024-07-15', 'active', 2.2, 'partially_vested');

-- ============================================================
-- 4. Pension Members: Local 123 → CUPE Local 123 Pension Plan
-- ============================================================
INSERT INTO pension_members (organization_id, plan_id, name, plan_name, enrollment_date, membership_status, years_of_service, vesting_status)
VALUES
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'b2c3d4e5-1234-4000-8000-000000000123',
   'Alice Johnson', 'CUPE Local 123 Pension Plan', '2019-09-15', 'active', 7.0, 'fully_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'b2c3d4e5-1234-4000-8000-000000000123',
   'Bob Smith', 'CUPE Local 123 Pension Plan', '2017-12-01', 'active', 9.0, 'fully_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'b2c3d4e5-1234-4000-8000-000000000123',
   'Grace Lee', 'CUPE Local 123 Pension Plan', '2022-03-01', 'active', 4.5, 'partially_vested'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'b2c3d4e5-1234-4000-8000-000000000123',
   'Marie-Claire Dubois', 'CUPE Local 123 Pension Plan', '2020-07-20', 'active', 6.2, 'fully_vested');

-- ============================================================
-- 5. Update pension_plans active_members count
-- ============================================================
UPDATE pension_plans SET active_members = 10
  WHERE id = '839407e3-27cc-4d72-b889-0d48f3915e9c'; -- CLC
UPDATE pension_plans SET active_members = 12
  WHERE id = '6dda2682-b1be-4501-9c53-405dbfbc9760'; -- CAPE
UPDATE pension_plans SET active_members = 4
  WHERE id = 'b2c3d4e5-1234-4000-8000-000000000123'; -- Local 123

-- ============================================================
-- 6. Member Employment: CLC
-- ============================================================
INSERT INTO member_employment (
  organization_id, member_id, employment_status, employment_type,
  hire_date, seniority_date, seniority_years, job_title, department,
  pay_frequency, base_salary, hourly_rate, regular_hours_per_week,
  checkoff_authorized
) VALUES
  -- Hassan Yussuff – National President
  ('873cf59b-cef5-4d51-9a62-151512810449', '0aa3f40e-e13b-4076-862f-eb1977f86b67',
   'active', 'full_time', '2014-05-01', '2014-05-01', 11.9,
   'National President', 'Executive', 'bi_weekly', 148000.00, 71.15, 37.50, true),
  -- Marie Clarke Walker – Executive VP
  ('873cf59b-cef5-4d51-9a62-151512810449', '532da6d3-3963-406f-876c-92f1853ab34f',
   'active', 'full_time', '2017-06-15', '2017-06-15', 8.8,
   'Executive Vice-President', 'Executive', 'bi_weekly', 138000.00, 66.35, 37.50, true),
  -- Denis Bolduc – Secretary-Treasurer
  ('873cf59b-cef5-4d51-9a62-151512810449', '5d6fee6d-2edc-4ed2-8668-fb0c976f7293',
   'active', 'full_time', '2019-09-01', '2019-09-01', 6.6,
   'Secretary-Treasurer', 'Policy', 'bi_weekly', 125000.00, 60.10, 37.50, true),
  -- Sophie Tremblay – Director of Legal Affairs
  ('873cf59b-cef5-4d51-9a62-151512810449', '92dd6052-f3c8-4fb5-88dd-8dd5dc2358b1',
   'active', 'full_time', '2020-01-10', '2020-01-10', 6.2,
   'Director of Legal Affairs', 'Legal', 'bi_weekly', 118000.00, 56.73, 37.50, true),
  -- James Nguyen – Senior Research Analyst
  ('873cf59b-cef5-4d51-9a62-151512810449', '0d7a504e-b00f-474e-aa61-2ae0ae9ee651',
   'active', 'full_time', '2018-03-20', '2018-03-20', 8.0,
   'Senior Research Analyst', 'Research', 'bi_weekly', 95000.00, 45.67, 37.50, true),
  -- Rebecca Martin – Media Relations Officer
  ('873cf59b-cef5-4d51-9a62-151512810449', 'c3101c60-eb81-4f15-b0d6-e7b794b6ff7c',
   'active', 'full_time', '2021-07-01', '2021-07-01', 4.7,
   'Media Relations Officer', 'Communications', 'bi_weekly', 82000.00, 39.42, 37.50, true),
  -- Louis Picard – Policy Advisor
  ('873cf59b-cef5-4d51-9a62-151512810449', 'a489865d-28e1-46c8-8320-21dcef558fba',
   'active', 'full_time', '2016-11-20', '2016-11-20', 9.4,
   'Policy Advisor', 'Policy', 'bi_weekly', 98000.00, 47.12, 37.50, true),
  -- Angela Varga – International Liaison
  ('873cf59b-cef5-4d51-9a62-151512810449', '9811ef70-9006-4844-a0c0-217f182c7783',
   'active', 'full_time', '2022-02-14', '2022-02-14', 4.1,
   'International Liaison', 'International', 'bi_weekly', 85000.00, 40.87, 37.50, true),
  -- Patrick O'Connor – Education Coordinator
  ('873cf59b-cef5-4d51-9a62-151512810449', '7b02f835-49c9-4125-ae28-cb20ce3c205a',
   'active', 'full_time', '2019-08-05', '2019-08-05', 6.6,
   'Education Coordinator', 'Education', 'bi_weekly', 79000.00, 37.98, 37.50, true),
  -- Fatima Al-Rashid – National Organizer
  ('873cf59b-cef5-4d51-9a62-151512810449', 'bcd89ad9-05f6-46e9-987e-31a460425521',
   'active', 'full_time', '2023-01-15', '2023-01-15', 3.2,
   'National Organizer', 'Organizing', 'bi_weekly', 76000.00, 36.54, 37.50, true);

-- ============================================================
-- 7. Member Employment: CAPE-ACEP
-- ============================================================
INSERT INTO member_employment (
  organization_id, member_id, employment_status, employment_type,
  hire_date, seniority_date, seniority_years, job_title, department,
  pay_frequency, base_salary, hourly_rate, regular_hours_per_week,
  checkoff_authorized
) VALUES
  -- Greg Phillips – National President
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'b45b99ed-fe83-4166-8b98-e4a3246e0131',
   'active', 'full_time', '2018-04-01', '2018-04-01', 8.0,
   'National President', 'Executive', 'bi_weekly', 142000.00, 68.27, 37.50, true),
  -- Emmanuelle Tremblay – Vice-President
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'c3a5bbb6-9d39-42fe-866d-d907135a94d6',
   'active', 'full_time', '2019-06-01', '2019-06-01', 6.8,
   'Vice-President', 'Executive', 'bi_weekly', 132000.00, 63.46, 37.50, true),
  -- Brian Faulkner – Chief Negotiator
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'e7d6137b-0b4a-4558-9a85-c61ad5c865ab',
   'active', 'full_time', '2015-01-15', '2015-01-15', 11.2,
   'Chief Negotiator', 'Bargaining', 'bi_weekly', 115000.00, 55.29, 37.50, true),
  -- Chantal Bertrand – Labour Relations Officer
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'cf3c73a8-3424-4c41-8a4e-bf5e6dcfd3a9',
   'active', 'full_time', '2020-03-01', '2020-03-01', 6.1,
   'Labour Relations Officer', 'Labour Relations', 'bi_weekly', 92000.00, 44.23, 37.50, true),
  -- Mike Savard – Staff Lawyer
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '3c137d19-7200-4d04-aec7-e85d6cc424c6',
   'active', 'full_time', '2017-09-15', '2017-09-15', 8.5,
   'Staff Lawyer', 'Legal', 'bi_weekly', 108000.00, 51.92, 37.50, true),
  -- Nadia Ouellet – Controller
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '662fad22-5341-4c5b-913e-1b55cdadf268',
   'active', 'full_time', '2021-01-10', '2021-01-10', 5.2,
   'Controller', 'Finance', 'bi_weekly', 98000.00, 47.12, 37.50, true),
  -- Daniel Kim – Membership Coordinator
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'b70557b6-5123-4b60-ba04-ac0212bbbe47',
   'active', 'full_time', '2022-05-01', '2022-05-01', 3.9,
   'Membership Coordinator', 'Membership Services', 'bi_weekly', 72000.00, 34.62, 37.50, true),
  -- Sarah Lefebvre – Chief Steward NCR
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '4455f87c-5802-4d4d-8e52-f50fce111ffd',
   'active', 'full_time', '2016-07-20', '2016-07-20', 9.7,
   'Chief Steward - NCR', 'Stewards', 'bi_weekly', 88000.00, 42.31, 37.50, true),
  -- Alexandre Moreau – Steward Pacific Region
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '3ea05964-824e-4e5a-a22f-4111c6f0f774',
   'active', 'full_time', '2023-03-01', '2023-03-01', 3.1,
   'Steward - Pacific Region', 'Stewards', 'bi_weekly', 68000.00, 32.69, 37.50, true),
  -- Jennifer Walsh – Digital Communications Lead
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '18298e75-8759-4e92-8ac3-01d8b8370d0a',
   'active', 'full_time', '2019-11-01', '2019-11-01', 6.4,
   'Digital Communications Lead', 'Communications', 'bi_weekly', 86000.00, 41.35, 37.50, true),
  -- Pierre Desmarais – Senior Economist
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'df93b6d0-f9b4-4689-a75b-360a8a95c882',
   'active', 'full_time', '2014-08-01', '2014-08-01', 11.7,
   'Senior Economist', 'Research', 'bi_weekly', 112000.00, 53.85, 37.50, true),
  -- Amira Hassan – Systems Analyst
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6b8790dd-ef2c-42d6-8814-f740331ac825',
   'active', 'full_time', '2024-01-15', '2024-01-15', 2.2,
   'Systems Analyst', 'IT', 'bi_weekly', 78000.00, 37.50, 37.50, true);

-- ============================================================
-- 8. Member Employment: CUPE Local 123
-- ============================================================
INSERT INTO member_employment (
  organization_id, member_id, employment_status, employment_type,
  hire_date, seniority_date, seniority_years, job_title, department,
  pay_frequency, base_salary, hourly_rate, regular_hours_per_week,
  checkoff_authorized
) VALUES
  -- Alice Johnson
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'beb4a1d7-fa51-4622-b118-2eff94decb45',
   'active', 'full_time', '2019-03-15', '2019-03-15', 7.0,
   'Community Services Worker', 'Community Programs', 'bi_weekly', 68000.00, 32.69, 37.50, true),
  -- Bob Smith
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '2f5bdfe0-7d87-47b7-b2c3-36242b256a4f',
   'active', 'full_time', '2017-06-01', '2017-06-01', 9.0,
   'Maintenance Technician', 'Facilities', 'bi_weekly', 72000.00, 34.62, 37.50, true),
  -- Grace Lee
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc',
   'active', 'full_time', '2021-09-01', '2021-09-01', 4.5,
   'Administrative Assistant', 'Administration', 'bi_weekly', 58000.00, 27.88, 37.50, true),
  -- Marie-Claire Dubois
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '8653b21c-9692-49b9-b519-128a7dc52558',
   'active', 'full_time', '2020-01-20', '2020-01-20', 6.2,
   'Program Coordinator', 'Community Programs', 'bi_weekly', 74000.00, 35.58, 37.50, true);

-- ============================================================
-- 9. Employment History: CLC (initial hire events)
-- ============================================================
INSERT INTO employment_history (organization_id, member_id, change_type, effective_date, new_values, reason)
VALUES
  ('873cf59b-cef5-4d51-9a62-151512810449', '0aa3f40e-e13b-4076-862f-eb1977f86b67',
   'hire', '2014-05-01', '{"job_title":"National President","department":"Executive","base_salary":"148000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '532da6d3-3963-406f-876c-92f1853ab34f',
   'hire', '2017-06-15', '{"job_title":"Executive Vice-President","department":"Executive","base_salary":"138000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '5d6fee6d-2edc-4ed2-8668-fb0c976f7293',
   'hire', '2019-09-01', '{"job_title":"Secretary-Treasurer","department":"Policy","base_salary":"125000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '92dd6052-f3c8-4fb5-88dd-8dd5dc2358b1',
   'hire', '2020-01-10', '{"job_title":"Director of Legal Affairs","department":"Legal","base_salary":"118000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '0d7a504e-b00f-474e-aa61-2ae0ae9ee651',
   'hire', '2018-03-20', '{"job_title":"Senior Research Analyst","department":"Research","base_salary":"95000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', 'c3101c60-eb81-4f15-b0d6-e7b794b6ff7c',
   'hire', '2021-07-01', '{"job_title":"Media Relations Officer","department":"Communications","base_salary":"82000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', 'a489865d-28e1-46c8-8320-21dcef558fba',
   'hire', '2016-11-20', '{"job_title":"Policy Advisor","department":"Policy","base_salary":"98000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '9811ef70-9006-4844-a0c0-217f182c7783',
   'hire', '2022-02-14', '{"job_title":"International Liaison","department":"International","base_salary":"85000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', '7b02f835-49c9-4125-ae28-cb20ce3c205a',
   'hire', '2019-08-05', '{"job_title":"Education Coordinator","department":"Education","base_salary":"79000"}'::jsonb, 'Initial hire'),
  ('873cf59b-cef5-4d51-9a62-151512810449', 'bcd89ad9-05f6-46e9-987e-31a460425521',
   'hire', '2023-01-15', '{"job_title":"National Organizer","department":"Organizing","base_salary":"76000"}'::jsonb, 'Initial hire');

-- ============================================================
-- 10. Employment History: CAPE-ACEP (initial hire events)
-- ============================================================
INSERT INTO employment_history (organization_id, member_id, change_type, effective_date, new_values, reason)
VALUES
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'b45b99ed-fe83-4166-8b98-e4a3246e0131',
   'hire', '2018-04-01', '{"job_title":"National President","department":"Executive","base_salary":"142000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'c3a5bbb6-9d39-42fe-866d-d907135a94d6',
   'hire', '2019-06-01', '{"job_title":"Vice-President","department":"Executive","base_salary":"132000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'e7d6137b-0b4a-4558-9a85-c61ad5c865ab',
   'hire', '2015-01-15', '{"job_title":"Chief Negotiator","department":"Bargaining","base_salary":"115000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'cf3c73a8-3424-4c41-8a4e-bf5e6dcfd3a9',
   'hire', '2020-03-01', '{"job_title":"Labour Relations Officer","department":"Labour Relations","base_salary":"92000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '3c137d19-7200-4d04-aec7-e85d6cc424c6',
   'hire', '2017-09-15', '{"job_title":"Staff Lawyer","department":"Legal","base_salary":"108000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '662fad22-5341-4c5b-913e-1b55cdadf268',
   'hire', '2021-01-10', '{"job_title":"Controller","department":"Finance","base_salary":"98000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'b70557b6-5123-4b60-ba04-ac0212bbbe47',
   'hire', '2022-05-01', '{"job_title":"Membership Coordinator","department":"Membership Services","base_salary":"72000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '4455f87c-5802-4d4d-8e52-f50fce111ffd',
   'hire', '2016-07-20', '{"job_title":"Chief Steward - NCR","department":"Stewards","base_salary":"88000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '3ea05964-824e-4e5a-a22f-4111c6f0f774',
   'hire', '2023-03-01', '{"job_title":"Steward - Pacific Region","department":"Stewards","base_salary":"68000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '18298e75-8759-4e92-8ac3-01d8b8370d0a',
   'hire', '2019-11-01', '{"job_title":"Digital Communications Lead","department":"Communications","base_salary":"86000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'df93b6d0-f9b4-4689-a75b-360a8a95c882',
   'hire', '2014-08-01', '{"job_title":"Senior Economist","department":"Research","base_salary":"112000"}'::jsonb, 'Initial hire'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '6b8790dd-ef2c-42d6-8814-f740331ac825',
   'hire', '2024-01-15', '{"job_title":"Systems Analyst","department":"IT","base_salary":"78000"}'::jsonb, 'Initial hire');

-- ============================================================
-- 11. Employment History: Local 123 (initial hire events)
-- ============================================================
INSERT INTO employment_history (organization_id, member_id, change_type, effective_date, new_values, reason)
VALUES
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', 'beb4a1d7-fa51-4622-b118-2eff94decb45',
   'hire', '2019-03-15', '{"job_title":"Community Services Worker","department":"Community Programs","base_salary":"68000"}'::jsonb, 'Initial hire'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '2f5bdfe0-7d87-47b7-b2c3-36242b256a4f',
   'hire', '2017-06-01', '{"job_title":"Maintenance Technician","department":"Facilities","base_salary":"72000"}'::jsonb, 'Initial hire'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '0c00e070-1b4d-4c79-bf25-fa4d9a04bdfc',
   'hire', '2021-09-01', '{"job_title":"Administrative Assistant","department":"Administration","base_salary":"58000"}'::jsonb, 'Initial hire'),
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '8653b21c-9692-49b9-b519-128a7dc52558',
   'hire', '2020-01-20', '{"job_title":"Program Coordinator","department":"Community Programs","base_salary":"74000"}'::jsonb, 'Initial hire');

-- ============================================================
-- 12. Supplementary employment history events (promotions, wage changes)
-- ============================================================
INSERT INTO employment_history (organization_id, member_id, change_type, effective_date, previous_values, new_values, reason)
VALUES
  -- Brian Faulkner promoted to Chief Negotiator (was LRO)
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'e7d6137b-0b4a-4558-9a85-c61ad5c865ab',
   'promotion', '2019-04-01',
   '{"job_title":"Labour Relations Officer","base_salary":"88000"}'::jsonb,
   '{"job_title":"Chief Negotiator","base_salary":"105000"}'::jsonb,
   'Promoted after successful CBA negotiations'),

  -- Pierre Desmarais wage increase
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'df93b6d0-f9b4-4689-a75b-360a8a95c882',
   'wage_change', '2022-01-01',
   '{"base_salary":"105000"}'::jsonb,
   '{"base_salary":"112000"}'::jsonb,
   'Annual increment per CBA schedule'),

  -- Sarah Lefebvre promoted to Chief Steward
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', '4455f87c-5802-4d4d-8e52-f50fce111ffd',
   'promotion', '2020-01-15',
   '{"job_title":"Steward - NCR","base_salary":"74000"}'::jsonb,
   '{"job_title":"Chief Steward - NCR","base_salary":"82000"}'::jsonb,
   'Elected Chief Steward for NCR region'),

  -- Hassan Yussuff wage change
  ('873cf59b-cef5-4d51-9a62-151512810449', '0aa3f40e-e13b-4076-862f-eb1977f86b67',
   'wage_change', '2023-06-01',
   '{"base_salary":"140000"}'::jsonb,
   '{"base_salary":"148000"}'::jsonb,
   'CBA negotiated increase'),

  -- Bob Smith promoted from Helper to Technician
  ('4a20966a-2f17-46b5-9b84-b3efea57b50a', '2f5bdfe0-7d87-47b7-b2c3-36242b256a4f',
   'promotion', '2020-09-01',
   '{"job_title":"Maintenance Helper","base_salary":"58000"}'::jsonb,
   '{"job_title":"Maintenance Technician","base_salary":"66000"}'::jsonb,
   'Completed journeyman certification');

-- ============================================================
-- 13. Pension Contributions (Q4 2025 + Q1 2026)
-- ============================================================

-- CLC contributions (sample: 3 members × 3 periods)
INSERT INTO pension_contributions (organization_id, member_id, member_name, period, amount, payment_status, payment_date)
VALUES
  -- Hassan Yussuff
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Hassan Yussuff' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Hassan Yussuff', '2025-10', 1233.33, 'received', '2025-10-31'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Hassan Yussuff' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Hassan Yussuff', '2025-11', 1233.33, 'received', '2025-11-30'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Hassan Yussuff' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Hassan Yussuff', '2025-12', 1233.33, 'received', '2025-12-31'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Hassan Yussuff' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Hassan Yussuff', '2026-01', 1233.33, 'received', '2026-01-31'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Hassan Yussuff' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Hassan Yussuff', '2026-02', 1233.33, 'received', '2026-02-28'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Hassan Yussuff' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Hassan Yussuff', '2026-03', 1233.33, 'pending', NULL),

  -- James Nguyen
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='James Nguyen' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'James Nguyen', '2026-01', 791.67, 'received', '2026-01-31'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='James Nguyen' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'James Nguyen', '2026-02', 791.67, 'received', '2026-02-28'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='James Nguyen' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'James Nguyen', '2026-03', 791.67, 'pending', NULL),

  -- Fatima Al-Rashid
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Fatima Al-Rashid' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Fatima Al-Rashid', '2026-01', 633.33, 'received', '2026-01-31'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Fatima Al-Rashid' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Fatima Al-Rashid', '2026-02', 633.33, 'received', '2026-02-28'),
  ('873cf59b-cef5-4d51-9a62-151512810449', (SELECT id FROM pension_members WHERE name='Fatima Al-Rashid' AND organization_id='873cf59b-cef5-4d51-9a62-151512810449' LIMIT 1),
   'Fatima Al-Rashid', '2026-03', 633.33, 'pending', NULL);

-- CAPE contributions (sample: 3 members × 3 periods)
INSERT INTO pension_contributions (organization_id, member_id, member_name, period, amount, payment_status, payment_date)
VALUES
  -- Brian Faulkner
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Brian Faulkner' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Brian Faulkner', '2026-01', 958.33, 'received', '2026-01-31'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Brian Faulkner' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Brian Faulkner', '2026-02', 958.33, 'received', '2026-02-28'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Brian Faulkner' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Brian Faulkner', '2026-03', 958.33, 'pending', NULL),

  -- Nadia Ouellet
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Nadia Ouellet' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Nadia Ouellet', '2026-01', 816.67, 'received', '2026-01-31'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Nadia Ouellet' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Nadia Ouellet', '2026-02', 816.67, 'received', '2026-02-28'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Nadia Ouellet' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Nadia Ouellet', '2026-03', 816.67, 'pending', NULL),

  -- Amira Hassan
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Amira Hassan' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Amira Hassan', '2026-01', 650.00, 'received', '2026-01-31'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Amira Hassan' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Amira Hassan', '2026-02', 650.00, 'received', '2026-02-28'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', (SELECT id FROM pension_members WHERE name='Amira Hassan' AND organization_id='c09173ad-5ba4-498e-a483-b371fb5e248e' LIMIT 1),
   'Amira Hassan', '2026-03', 650.00, 'pending', NULL);

COMMIT;

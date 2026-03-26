-- =============================================================================
-- Seed collective agreements for orgs that have none
-- =============================================================================

-- CUPE Local 123 agreements
INSERT INTO collective_agreements (id, organization_id, cba_number, title, jurisdiction, language, employer_name, union_name, union_local, effective_date, expiry_date, signed_date, industry_sector, sector, employee_coverage, bargaining_unit_description, status, is_public, summary_generated, key_terms, created_at, updated_at)
VALUES
  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CBA-2024-001',
   'Collective Agreement between City of Ottawa and CUPE Local 123 (Inside Workers)',
   'ontario', 'en', 'City of Ottawa', 'Canadian Union of Public Employees', 'Local 123',
   '2024-01-01', '2027-12-31', '2024-03-15', 'Public Administration', 'Municipal', 2400,
   'Inside workers including clerical, administrative, technical, and professional employees of the City of Ottawa',
   'active', true,
   'Four-year collective agreement covering inside workers. Includes wage increases of 2.5% per year, improved benefits, remote work provisions, and enhanced job security language.',
   '["wages","benefits","remote work","job security","vacation","sick leave","grievance procedure","overtime"]'::jsonb,
   NOW(), NOW()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CBA-2024-002',
   'Collective Agreement between City of Ottawa and CUPE Local 123 (Outside Workers)',
   'ontario', 'en', 'City of Ottawa', 'Canadian Union of Public Employees', 'Local 123',
   '2024-01-01', '2027-12-31', '2024-03-15', 'Public Administration', 'Municipal', 1800,
   'Outside workers including maintenance, parks, roads, water/wastewater, and transit maintenance employees',
   'active', true,
   'Four-year collective agreement for outside workers. Wage increases matching inside workers at 2.5% annually. New safety equipment provisions and heat stress protocol.',
   '["wages","safety","PPE","heat stress","shift premiums","overtime","call-back pay","tool allowance"]'::jsonb,
   NOW(), NOW()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'SL-2025-001',
   'Side Letter: Remote Work Arrangements for Inside Workers',
   'ontario', 'en', 'City of Ottawa', 'Canadian Union of Public Employees', 'Local 123',
   '2025-06-01', '2027-12-31', '2025-05-20', 'Public Administration', 'Municipal', 2400,
   'Side letter establishing hybrid work arrangements for eligible inside workers',
   'active', true,
   'Establishes framework for hybrid remote work (up to 3 days per week) for eligible inside unit positions. Includes equipment provisions and right to disconnect.',
   '["remote work","hybrid","equipment","right to disconnect","eligibility"]'::jsonb,
   NOW(), NOW()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'MOU-2026-001',
   'Memorandum of Understanding: Joint DEI Committee',
   'ontario', 'en', 'City of Ottawa', 'Canadian Union of Public Employees', 'Local 123',
   '2026-01-01', '2027-12-31', '2025-12-10', 'Public Administration', 'Municipal', 4200,
   'MOU establishing a joint diversity, equity, and inclusion committee with equal union and employer representation',
   'active', true,
   'Creates a joint DEI committee with co-chairs from union and management. Committee reviews hiring practices, accommodation procedures, and workplace culture initiatives.',
   '["diversity","equity","inclusion","accommodation","hiring practices","workplace culture"]'::jsonb,
   NOW(), NOW()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'CBA-2020-001',
   'Collective Agreement between City of Ottawa and CUPE Local 123 (Inside Workers) 2020-2023',
   'ontario', 'en', 'City of Ottawa', 'Canadian Union of Public Employees', 'Local 123',
   '2020-01-01', '2023-12-31', '2020-04-01', 'Public Administration', 'Municipal', 2200,
   'Previous collective agreement for inside workers',
   'expired', true,
   'Previous four-year agreement. Included 1.75% annual wage increases, introduction of mental health benefits, and expanded bereavement leave.',
   '["wages","mental health","bereavement leave","benefits","grievance procedure"]'::jsonb,
   NOW(), NOW()),

  (gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'AMD-2026-001',
   'Amendment to CBA: Updated Overtime Provisions',
   'ontario', 'en', 'City of Ottawa', 'Canadian Union of Public Employees', 'Local 123',
   '2026-03-01', '2027-12-31', '2026-02-20', 'Public Administration', 'Municipal', 4200,
   'Amendment updating overtime calculation and compensation provisions for all bargaining units',
   'active', true,
   'Amends Article 18 (Overtime) to include new banked overtime provisions allowing members to bank up to 80 hours annually and changes overtime threshold calculation.',
   '["overtime","banked time","compensation","Article 18"]'::jsonb,
   NOW(), NOW());

-- CUPE National agreements
INSERT INTO collective_agreements (id, organization_id, cba_number, title, jurisdiction, language, employer_name, union_name, union_local, effective_date, expiry_date, signed_date, industry_sector, sector, employee_coverage, bargaining_unit_description, status, is_public, summary_generated, key_terms, created_at, updated_at)
VALUES
  (gen_random_uuid(), '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'CBA-NAT-2025-001',
   'CUPE National Staff Collective Agreement 2025-2028',
   'federal', 'en', 'CUPE National', 'CUPE Staff Union', 'National', '2025-01-01', '2028-12-31', '2025-02-28',
   'Labour Organizations', 'Non-Profit', 350,
   'National office staff including researchers, communications, organizing, and administrative staff',
   'active', true,
   'Three-year agreement for CUPE national office staff. Includes cost-of-living adjustments, enhanced parental leave, and professional development fund.',
   '["wages","parental leave","professional development","COLA","telework"]'::jsonb,
   NOW(), NOW());

-- CUPE Local 79 agreements
INSERT INTO collective_agreements (id, organization_id, cba_number, title, jurisdiction, language, employer_name, union_name, union_local, effective_date, expiry_date, signed_date, industry_sector, sector, employee_coverage, bargaining_unit_description, status, is_public, summary_generated, key_terms, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'a1b2c3d4-1111-4000-8000-000000000079', 'CBA-79-2024-001',
   'Collective Agreement between City of Toronto and CUPE Local 79 (Full-Time)',
   'ontario', 'en', 'City of Toronto', 'Canadian Union of Public Employees', 'Local 79',
   '2024-01-01', '2027-12-31', '2024-04-01', 'Public Administration', 'Municipal', 18000,
   'Full-time inside and outside workers of the City of Toronto',
   'active', true,
   'Comprehensive four-year agreement covering Toronto municipal workers. Wage increases of 3% in year one, 2.5% in subsequent years. New anti-harassment provisions.',
   '["wages","benefits","anti-harassment","scheduling","vacation","job posting"]'::jsonb,
   NOW(), NOW()),

  (gen_random_uuid(), 'a1b2c3d4-1111-4000-8000-000000000079', 'CBA-79-2024-002',
   'Collective Agreement between City of Toronto and CUPE Local 79 (Part-Time)',
   'ontario', 'en', 'City of Toronto', 'Canadian Union of Public Employees', 'Local 79',
   '2024-01-01', '2027-12-31', '2024-04-01', 'Public Administration', 'Municipal', 8000,
   'Part-time and casual employees of the City of Toronto',
   'active', true,
   'Part-time unit agreement with pro-rated benefits, improved scheduling rights, and pathway to full-time conversion after 24 months.',
   '["wages","scheduling","conversion to full-time","pro-rated benefits","seniority"]'::jsonb,
   NOW(), NOW());

-- CUPE Local 3903 agreements
INSERT INTO collective_agreements (id, organization_id, cba_number, title, jurisdiction, language, employer_name, union_name, union_local, effective_date, expiry_date, signed_date, industry_sector, sector, employee_coverage, bargaining_unit_description, status, is_public, summary_generated, key_terms, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'a1b2c3d4-2222-4000-8000-000000003903', 'CBA-3903-2024-U1',
   'Collective Agreement between York University and CUPE 3903 Unit 1 (Teaching Assistants)',
   'ontario', 'en', 'York University', 'Canadian Union of Public Employees', 'Local 3903',
   '2024-09-01', '2027-08-31', '2024-08-15', 'Education', 'Post-Secondary', 3200,
   'Teaching assistants and graduate assistants at York University',
   'active', true,
   'Three-year agreement for Unit 1 TAs. Includes funding guarantee increases, improved health benefits, and workload protections.',
   '["funding guarantee","tuition indexation","health benefits","workload","class size"]'::jsonb,
   NOW(), NOW()),

  (gen_random_uuid(), 'a1b2c3d4-2222-4000-8000-000000003903', 'CBA-3903-2024-U2',
   'Collective Agreement between York University and CUPE 3903 Unit 2 (Contract Faculty)',
   'ontario', 'en', 'York University', 'Canadian Union of Public Employees', 'Local 3903',
   '2024-09-01', '2027-08-31', '2024-08-15', 'Education', 'Post-Secondary', 1200,
   'Contract faculty and course directors at York University',
   'active', true,
   'Three-year agreement for Unit 2 contract faculty. Includes conversion to continuing appointments after long service, improved per-course rates.',
   '["per-course rates","conversion","continuing appointments","benefits","academic freedom"]'::jsonb,
   NOW(), NOW());

-- CUPE Local 1000 agreements
INSERT INTO collective_agreements (id, organization_id, cba_number, title, jurisdiction, language, employer_name, union_name, union_local, effective_date, expiry_date, signed_date, industry_sector, sector, employee_coverage, bargaining_unit_description, status, is_public, summary_generated, key_terms, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'a1b2c3d4-3333-4000-8000-000000001000', 'CBA-1000-2025-001',
   'Collective Agreement between Regional Municipality and CUPE Local 1000',
   'ontario', 'en', 'Regional Municipality', 'Canadian Union of Public Employees', 'Local 1000',
   '2025-01-01', '2028-12-31', '2025-03-01', 'Public Administration', 'Municipal', 1500,
   'Municipal workers including library, recreation, and public works employees',
   'active', true,
   'Four-year agreement with 2.75% annual increases, new mental health days, expanded dental coverage, and workplace violence prevention measures.',
   '["wages","mental health days","dental","workplace violence prevention","vacation"]'::jsonb,
   NOW(), NOW());

-- NZILA Ventures (corporate, not union - has employment policies instead)
INSERT INTO collective_agreements (id, organization_id, cba_number, title, jurisdiction, language, employer_name, union_name, union_local, effective_date, expiry_date, signed_date, industry_sector, sector, employee_coverage, bargaining_unit_description, status, is_public, summary_generated, key_terms, created_at, updated_at)
VALUES
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'POL-2025-001',
   'NZILA Ventures Employee Handbook and Policies',
   'federal', 'en', 'NZILA Ventures', 'N/A', 'N/A',
   '2025-01-01', '2026-12-31', '2025-01-01', 'Technology', 'Software', 120,
   'All employees of NZILA Ventures',
   'active', true,
   'Company-wide employee handbook covering benefits, conduct policies, remote work, equity compensation, and professional development allowances.',
   '["employee handbook","benefits","remote work","equity","professional development","PTO"]'::jsonb,
   NOW(), NOW());

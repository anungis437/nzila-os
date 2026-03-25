INSERT INTO shared_clause_library (
  id, source_organization_id, clause_number, clause_title, clause_text,
  clause_type, sharing_level, sector, province, effective_date, expiry_date,
  view_count, citation_count, comparison_count, version, created_by, created_at, updated_at
) VALUES
-- CUPE National (union) - 5 clauses
(gen_random_uuid(), '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Art. 12.01',
 'Overtime Compensation – Double Time After 8 Hours',
 'All hours worked in excess of eight (8) hours in any one day or in excess of forty (40) hours in any one week shall be compensated at the rate of double (2x) the employee''s regular hourly rate. Overtime shall be voluntary except in cases of emergency as defined in Article 3.05. The Employer shall make every reasonable effort to distribute overtime equitably among qualified employees in the same classification.',
 'wages', 'public', 'public', 'ON', '2024-01-01', '2027-12-31',
 45, 12, 8, 1, 'system', NOW() - INTERVAL '180 days', NOW() - INTERVAL '10 days'),

(gen_random_uuid(), '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Art. 18.03',
 'Bereavement Leave – Extended Family Definition',
 'An employee shall be granted bereavement leave with pay for a period of five (5) working days upon the death of a spouse, common-law partner, parent, child, sibling, grandparent, or grandchild. Three (3) days shall be granted for aunt, uncle, niece, nephew, or in-law. One (1) additional day of travel leave shall be granted when the funeral is more than 500 km from the employee''s residence.',
 'leaves', 'congress', 'public', NULL, '2024-01-01', '2027-12-31',
 32, 8, 5, 1, 'system', NOW() - INTERVAL '160 days', NOW() - INTERVAL '5 days'),

(gen_random_uuid(), '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Art. 25.01',
 'Workplace Harassment – Zero Tolerance Policy',
 'The Employer and the Union agree that every employee has the right to a workplace free from harassment as defined by the Ontario Human Rights Code and the Occupational Health and Safety Act. All complaints shall be investigated within fifteen (15) working days. The complainant shall be informed of the outcome within five (5) days of the investigation''s completion. No reprisal shall be taken against an employee for filing a complaint in good faith.',
 'health_safety', 'public', 'public', 'ON', '2024-01-01', '2027-12-31',
 67, 22, 15, 1, 'system', NOW() - INTERVAL '200 days', NOW() - INTERVAL '2 days'),

(gen_random_uuid(), '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Art. 9.04',
 'Seniority – Layoff and Recall Rights',
 'In the event of a layoff, employees shall be laid off in reverse order of seniority within their classification. Employees on layoff shall retain recall rights for a period of twenty-four (24) months. Recall shall be in order of seniority. Notice of recall shall be sent by registered mail to the employee''s last known address. The employee must respond within seven (7) calendar days of receipt.',
 'seniority', 'federation', 'public', 'ON', '2024-01-01', '2027-12-31',
 28, 6, 3, 1, 'system', NOW() - INTERVAL '150 days', NOW() - INTERVAL '15 days'),

(gen_random_uuid(), '9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Art. 22.01',
 'Professional Development Fund – Annual Allocation',
 'The Employer shall establish an annual Professional Development Fund of not less than one thousand dollars ($1,000) per full-time employee. Funds may be used for tuition, conference registration, professional certification, or purchase of professional publications. Unused funds shall not carry over. Applications shall be approved by a joint Labour-Management committee.',
 'benefits_insurance', 'congress', 'public', NULL, '2024-01-01', '2027-12-31',
 19, 4, 2, 1, 'system', NOW() - INTERVAL '140 days', NOW() - INTERVAL '20 days'),

-- CUPE Local 123 (local) - 4 clauses
(gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Art. 14.02',
 'Shift Premium – Weekend and Evening Differential',
 'Employees required to work between 1600h and 0800h shall receive a shift premium of two dollars ($2.00) per hour in addition to their regular rate. Employees required to work on Saturday shall receive a premium of one dollar and fifty cents ($1.50) per hour. Sunday premium shall be two dollars and fifty cents ($2.50) per hour. Premiums are cumulative with overtime rates.',
 'wages', 'federation', 'public', 'ON', '2025-01-01', '2027-12-31',
 38, 9, 6, 1, 'system', NOW() - INTERVAL '90 days', NOW() - INTERVAL '8 days'),

(gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Art. 20.05',
 'Personal Protective Equipment – Employer Obligation',
 'The Employer shall provide, at no cost to the employee, all personal protective equipment required by the Occupational Health and Safety Act and any additional equipment identified by the Joint Health and Safety Committee. This includes, but is not limited to, safety footwear (up to $200 annually), high-visibility clothing, hearing protection, and respiratory equipment. Replacement shall be provided when equipment is worn or damaged in the course of duties.',
 'health_safety', 'public', 'public', 'ON', '2025-01-01', '2027-12-31',
 51, 14, 7, 1, 'system', NOW() - INTERVAL '85 days', NOW() - INTERVAL '12 days'),

(gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Art. 7.03',
 'Union Steward – Paid Release Time',
 'Union stewards shall be granted paid release time of up to four (4) hours per week to attend to union business, including grievance meetings, investigations, and member consultations. Additional release time may be requested in writing and shall not be unreasonably denied. The Employer shall maintain the steward''s regular rate of pay during all authorized release time.',
 'union_rights', 'public', 'public', 'ON', '2025-01-01', '2027-12-31',
 43, 11, 9, 1, 'system', NOW() - INTERVAL '80 days', NOW() - INTERVAL '3 days'),

(gen_random_uuid(), '4a20966a-2f17-46b5-9b84-b3efea57b50a', 'Art. 16.01',
 'Vacation Entitlement – Progressive Schedule',
 'Vacation entitlement shall be: less than 1 year - 1 day per month worked; 1-5 years - 3 weeks; 5-10 years - 4 weeks; 10-20 years - 5 weeks; 20+ years - 6 weeks. Vacation pay shall be calculated on gross annual earnings. Vacation scheduling preference shall be by seniority within the department. Vacation requests shall be responded to within ten (10) working days.',
 'leaves', 'federation', 'public', 'ON', '2025-01-01', '2027-12-31',
 55, 18, 10, 1, 'system', NOW() - INTERVAL '75 days', NOW() - INTERVAL '6 days'),

-- CAPE (union) - 4 more clauses (already has 2)
(gen_random_uuid(), 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Art. 33.02',
 'Telework Agreement – Hybrid Model Framework',
 'Employees in classifications designated as telework-eligible may work remotely up to three (3) days per week subject to operational requirements. The Employer shall provide necessary equipment including a laptop, monitor, keyboard, and ergonomic chair or a five hundred dollar ($500) home office allowance. Telework arrangements shall be reviewed annually. Changes require thirty (30) days written notice and consultation with the Union.',
 'working_conditions', 'congress', 'public', 'ON', '2024-06-01', '2027-12-31',
 72, 25, 18, 1, 'system', NOW() - INTERVAL '120 days', NOW() - INTERVAL '1 day'),

(gen_random_uuid(), 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Art. 28.01',
 'Classification Review – Pay Equity Maintenance',
 'The Employer shall conduct a classification review of all positions every three (3) years to ensure compliance with the Pay Equity Act. Employees who believe their position is improperly classified may request a review at any time. Reviews shall be completed within sixty (60) days. Retroactive pay adjustments shall be applied from the date of the request if reclassification is warranted.',
 'wages', 'federation', 'public', NULL, '2024-06-01', '2027-12-31',
 34, 7, 4, 1, 'system', NOW() - INTERVAL '110 days', NOW() - INTERVAL '9 days'),

(gen_random_uuid(), 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Art. 31.05',
 'Bilingual Bonus – Official Languages Premium',
 'Employees in positions designated as bilingual (English/French) shall receive a bilingual bonus of eight hundred dollars ($800) per annum, paid bi-weekly. Bilingual proficiency shall be determined by standardized testing administered by an accredited testing service. Re-testing shall occur every five (5) years. The premium shall be prorated for part-time employees.',
 'wages', 'public', 'public', NULL, '2024-06-01', '2027-12-31',
 26, 5, 3, 1, 'system', NOW() - INTERVAL '100 days', NOW() - INTERVAL '14 days'),

(gen_random_uuid(), 'c09173ad-5ba4-498e-a483-b371fb5e248e', 'Art. 35.01',
 'Duty to Accommodate – Graduated Return to Work',
 'The Employer shall develop a graduated return-to-work program in consultation with the Union, the employee, and the employee''s medical practitioner. The program shall include modified duties, reduced hours, and workplace modifications as necessary. The Employer shall make every reasonable effort to accommodate the employee in their home position before considering alternative positions. Medical information shall be limited to functional limitations and expected duration.',
 'health_safety', 'congress', 'public', NULL, '2024-06-01', '2027-12-31',
 41, 13, 8, 1, 'system', NOW() - INTERVAL '95 days', NOW() - INTERVAL '7 days'),

-- CLC (congress) - 4 more clauses (already has 1)
(gen_random_uuid(), '873cf59b-cef5-4d51-9a62-151512810449', 'Model 5.01',
 'Anti-Scab Legislation – Strike/Lockout Replacement Workers',
 'During a legal strike or lockout, the Employer shall not use replacement workers to perform bargaining unit work. This includes employees from other bargaining units, management personnel performing bargaining unit work beyond emergency and essential services, and contracted workers. Essential services shall be determined by mutual agreement or by the Labour Relations Board.',
 'union_rights', 'public', 'public', NULL, '2024-01-01', NULL,
 89, 31, 20, 1, 'system', NOW() - INTERVAL '250 days', NOW() - INTERVAL '4 days'),

(gen_random_uuid(), '873cf59b-cef5-4d51-9a62-151512810449', 'Model 8.02',
 'Just Cause – Progressive Discipline Framework',
 'No employee shall be disciplined, suspended, or discharged without just cause. Discipline shall be progressive: verbal warning, written warning, suspension, discharge. Each step shall include clear expectations for improvement and a reasonable timeline. Discipline older than eighteen (18) months shall not be relied upon in subsequent proceedings. The employee has the right to Union representation at all disciplinary meetings.',
 'discipline', 'public', 'public', NULL, '2024-01-01', NULL,
 95, 35, 22, 1, 'system', NOW() - INTERVAL '240 days', NOW() - INTERVAL '2 days'),

(gen_random_uuid(), '873cf59b-cef5-4d51-9a62-151512810449', 'Model 15.01',
 'Joint Labour-Management Committee – Terms of Reference',
 'A Joint Labour-Management Committee shall be established consisting of equal representation from the Employer and the Union, with a minimum of two (2) members from each side. The Committee shall meet monthly during regular working hours. Agenda items must be submitted five (5) working days in advance. Minutes shall be circulated within ten (10) working days. The Committee shall address workplace issues, policy changes, and continuous improvement initiatives.',
 'working_conditions', 'public', 'public', NULL, '2024-01-01', NULL,
 61, 17, 11, 1, 'system', NOW() - INTERVAL '220 days', NOW() - INTERVAL '6 days'),

(gen_random_uuid(), '873cf59b-cef5-4d51-9a62-151512810449', 'Model 21.01',
 'Health Benefits – Dental and Vision Coverage',
 'The Employer shall provide comprehensive dental coverage including preventive (100%), basic restorative (90%), major restorative (80%), and orthodontic (50% to lifetime max $3,000). Vision coverage shall include eye exams every two (2) years and three hundred dollars ($300) toward corrective lenses every two (2) years. Coverage extends to eligible dependants. The Employer shall pay one hundred percent (100%) of premiums.',
 'benefits_insurance', 'public', 'public', NULL, '2024-01-01', NULL,
 78, 28, 16, 1, 'system', NOW() - INTERVAL '210 days', NOW() - INTERVAL '8 days'),

-- CUPE Local 79 (local) - 3 clauses
(gen_random_uuid(), 'a1b2c3d4-1111-4000-8000-000000000079', 'Art. 11.04',
 'Contracting Out – Protection of Bargaining Unit Work',
 'The Employer shall not contract out any work presently performed by bargaining unit employees if such contracting out would result in the layoff, displacement, or reduction of hours of any bargaining unit member. Prior to any contracting out, the Employer shall notify the Union sixty (60) days in advance and engage in meaningful consultation. The Union may propose alternatives that maintain service quality while preserving bargaining unit positions.',
 'union_rights', 'federation', 'public', 'ON', '2025-01-01', '2028-06-30',
 37, 10, 5, 1, 'system', NOW() - INTERVAL '70 days', NOW() - INTERVAL '11 days'),

(gen_random_uuid(), 'a1b2c3d4-1111-4000-8000-000000000079', 'Art. 19.02',
 'Workplace Violence Prevention – Risk Assessment Protocol',
 'The Employer shall conduct a workplace violence risk assessment annually and following any violent incident. The assessment shall be reviewed by the Joint Health and Safety Committee. The Employer shall implement all recommendations within thirty (30) days. Training on workplace violence prevention shall be provided to all employees upon hire and annually thereafter. Employees who experience or witness violence shall have access to critical incident stress debriefing at no cost.',
 'health_safety', 'public', 'public', 'ON', '2025-01-01', '2028-06-30',
 44, 15, 9, 1, 'system', NOW() - INTERVAL '65 days', NOW() - INTERVAL '5 days'),

(gen_random_uuid(), 'a1b2c3d4-1111-4000-8000-000000000079', 'Art. 23.06',
 'Parental Leave Top-Up – Supplemental Employment Benefit',
 'Employees on parental leave who are receiving Employment Insurance benefits shall receive a supplemental payment from the Employer equal to the difference between the EI benefit and ninety-three percent (93%) of their regular weekly earnings. This top-up shall be paid for a maximum of twenty-six (26) weeks for birth parents and eighteen (18) weeks for non-birth parents. Employees must have completed twelve (12) months of continuous service to be eligible.',
 'leaves', 'congress', 'public', 'ON', '2025-01-01', '2028-06-30',
 63, 21, 14, 1, 'system', NOW() - INTERVAL '60 days', NOW() - INTERVAL '3 days'),

-- CUPE Local 3903 (local) - 3 clauses
(gen_random_uuid(), 'a1b2c3d4-2222-4000-8000-000000003903', 'Art. 6.01',
 'Workload – Maximum Teaching Hours and Class Size',
 'The maximum teaching assignment shall not exceed ten (10) contact hours per week or two (2) courses per term, whichever is less. Tutorial sections shall not exceed twenty-five (25) students. Where enrollment exceeds the cap, the Employer shall hire additional instructors. Marking time shall be calculated at fifteen (15) minutes per student per assignment for written work.',
 'working_conditions', 'federation', 'education', 'ON', '2024-09-01', '2027-08-31',
 56, 16, 11, 1, 'system', NOW() - INTERVAL '55 days', NOW() - INTERVAL '7 days'),

(gen_random_uuid(), 'a1b2c3d4-2222-4000-8000-000000003903', 'Art. 10.01',
 'Graduate Funding – Minimum Guaranteed Package',
 'All graduate assistants in funded cohorts shall receive a minimum guaranteed funding package of not less than the amount specified in Schedule A, adjusted annually by the Consumer Price Index (CPI). The package shall include a combination of employment income, scholarships, and bursaries. The Employer shall not reduce scholarship or bursary amounts to offset employment income increases negotiated through collective bargaining.',
 'wages', 'federation', 'education', 'ON', '2024-09-01', '2027-08-31',
 48, 12, 7, 1, 'system', NOW() - INTERVAL '50 days', NOW() - INTERVAL '9 days'),

(gen_random_uuid(), 'a1b2c3d4-2222-4000-8000-000000003903', 'Art. 15.03',
 'Trans-Inclusive Benefits – Gender-Affirming Care Coverage',
 'The health benefits plan shall include coverage for gender-affirming care including hormone therapy, surgical procedures, and mental health counselling related to gender identity. Coverage limits shall be consistent with those provided for comparable medical procedures. The plan shall use inclusive language and processes. Name and gender marker changes shall be processed within five (5) business days upon request.',
 'benefits_insurance', 'public', 'education', 'ON', '2024-09-01', '2027-08-31',
 71, 24, 17, 1, 'system', NOW() - INTERVAL '45 days', NOW() - INTERVAL '2 days'),

-- CUPE Local 1000 (local) - 3 clauses
(gen_random_uuid(), 'a1b2c3d4-3333-4000-8000-000000001000', 'Art. 8.01',
 'Sick Leave – Accumulated Credits and Payout',
 'Employees shall accumulate sick leave credits at the rate of one and one-half (1.5) days per month of active service. Unused credits may be accumulated to a maximum of two hundred (200) days. Upon retirement, employees with ten (10) or more years of service shall receive a payout of fifty percent (50%) of accumulated unused sick leave credits at their current rate of pay.',
 'leaves', 'federation', 'public', 'QC', '2025-01-01', '2027-12-31',
 33, 7, 4, 1, 'system', NOW() - INTERVAL '40 days', NOW() - INTERVAL '10 days'),

(gen_random_uuid(), 'a1b2c3d4-3333-4000-8000-000000001000', 'Art. 13.02',
 'Language Rights – Services in Both Official Languages',
 'Employees in designated bilingual positions shall have the right to work in the official language of their choice. All workplace communications, including policies, procedures, and safety instructions, shall be available in both English and French. Labour-management meetings shall provide interpretation services upon request. Collective agreement documents shall be published in both official languages simultaneously.',
 'working_conditions', 'federation', 'public', 'QC', '2025-01-01', '2027-12-31',
 29, 6, 3, 1, 'system', NOW() - INTERVAL '35 days', NOW() - INTERVAL '13 days'),

(gen_random_uuid(), 'a1b2c3d4-3333-4000-8000-000000001000', 'Art. 27.01',
 'Technological Change – Notice and Retraining',
 'The Employer shall provide ninety (90) calendar days written notice to the Union of any technological change that will affect the terms, conditions, or security of employment of bargaining unit members. The notice shall include the nature of the change, affected positions, implementation timeline, and proposed retraining plan. Affected employees shall receive retraining at the Employer''s expense during regular working hours. No employee shall be terminated as a direct result of technological change.',
 'technological_change', 'public', 'public', 'QC', '2025-01-01', '2027-12-31',
 52, 19, 12, 1, 'system', NOW() - INTERVAL '30 days', NOW() - INTERVAL '4 days');

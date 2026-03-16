-- H&S Tables Seed: Update existing stubs + insert new records
-- Organizations: CAPE, CLC, NZILA Ventures

-- ============================================================
-- 1. WORKPLACE INCIDENTS - update existing 5 + insert 1 more
-- ============================================================
UPDATE workplace_incidents SET
  incident_type = 'injury', severity = 'moderate',
  incident_date = '2025-11-15 09:30:00+00', reported_date = '2025-11-15 10:00:00+00',
  location_description = 'Warehouse loading dock, Bay 3',
  workplace_name = 'CAPE Central Office', department_name = 'Operations',
  injured_person_name = 'Jean-Pierre Mbala', injured_person_job_title = 'Warehouse Associate',
  body_part_affected = 'back', injury_nature = 'strain',
  treatment_provided = 'Ice pack applied, referred to clinic', treatment_location = 'On-site first aid room',
  lost_time_days = 3, description = 'Worker strained lower back while lifting heavy pallet without mechanical aid.',
  what_happened = 'Employee attempted to manually lift a 35kg pallet from ground level.',
  task_being_performed = 'Unloading delivery truck',
  investigation_required = true, investigation_report = 'Root cause: insufficient mechanical lifting equipment at dock.',
  root_cause = 'Lack of available pallet jack at loading area',
  corrective_actions_required = true, corrective_actions_summary = 'Install additional pallet jacks at all loading bays.',
  status = 'under_investigation', reported_by_name = 'Fatima Nzuzi',
  metadata = '{"shift":"morning","weather":"clear"}'::jsonb, tags = '["lifting","ergonomic","warehouse"]'::jsonb
WHERE incident_number = (SELECT incident_number FROM workplace_incidents ORDER BY created_at LIMIT 1);

UPDATE workplace_incidents SET
  incident_type = 'near_miss', severity = 'near_miss',
  incident_date = '2025-12-01 14:15:00+00', reported_date = '2025-12-01 14:30:00+00',
  location_description = 'Main stairwell between floors 2 and 3',
  workplace_name = 'CLC Head Office', department_name = 'Administration',
  description = 'Employee nearly fell on wet stairs after cleaning. No signage posted.',
  what_happened = 'Cleaning crew left stairs wet without wet floor signs.',
  investigation_required = false,
  corrective_actions_required = true, corrective_actions_summary = 'Enforce wet floor signage protocol.',
  status = 'closed', closed_date = '2025-12-05 16:00:00+00', closure_notes = 'Protocol updated and staff notified.',
  reported_by_name = 'Amara Diallo',
  tags = '["slip","housekeeping","stairwell"]'::jsonb
WHERE incident_number = (SELECT incident_number FROM workplace_incidents ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE workplace_incidents SET
  incident_type = 'property_damage', severity = 'minor',
  incident_date = '2026-01-10 11:00:00+00', reported_date = '2026-01-10 11:15:00+00',
  location_description = 'Parking lot, section B',
  workplace_name = 'NZILA Ventures Campus', department_name = 'Facilities',
  description = 'Forklift operator struck loading bollard causing damage to bollard and forklift bumper.',
  equipment_involved = 'Toyota forklift #FLT-007',
  investigation_required = true, root_cause = 'Restricted visibility due to oversized load',
  status = 'reported', reported_by_name = 'Kwame Asante',
  tags = '["forklift","property_damage","parking"]'::jsonb
WHERE incident_number = (SELECT incident_number FROM workplace_incidents ORDER BY created_at LIMIT 1 OFFSET 2);

UPDATE workplace_incidents SET
  incident_type = 'exposure', severity = 'serious',
  incident_date = '2026-02-05 08:45:00+00', reported_date = '2026-02-05 09:00:00+00',
  location_description = 'Chemical storage room',
  workplace_name = 'CAPE Central Office', department_name = 'Maintenance',
  injured_person_name = 'Blessing Okafor', body_part_affected = 'eyes',
  treatment_provided = 'Eye wash station used, transported to hospital', hospitalized = true, hospitalized_days = 1,
  lost_time_days = 5, description = 'Maintenance worker exposed to chemical splash while handling cleaning agents without goggles.',
  reportable_to_authority = true, authority_notified = true, authority_name = 'Provincial OHS',
  status = 'under_investigation',
  tags = '["chemical","exposure","ppe_failure"]'::jsonb
WHERE incident_number = (SELECT incident_number FROM workplace_incidents ORDER BY created_at LIMIT 1 OFFSET 3);

UPDATE workplace_incidents SET
  incident_type = 'fall', severity = 'critical',
  incident_date = '2026-02-20 13:30:00+00', reported_date = '2026-02-20 13:35:00+00',
  location_description = 'Roof access area, building A',
  workplace_name = 'CLC Head Office', department_name = 'Maintenance',
  injured_person_name = 'David Mwangi', body_part_affected = 'leg', injury_nature = 'fracture',
  hospitalized = true, hospitalized_days = 7, lost_time_days = 45,
  description = 'Worker fell from ladder while accessing rooftop HVAC unit. Safety harness not worn.',
  investigation_required = true, root_cause = 'Non-compliance with fall protection protocol',
  corrective_actions_required = true, reportable_to_authority = true,
  wsib_claim_number = 'WSIB-2026-0042', wsib_claim_status = 'approved',
  status = 'under_investigation',
  tags = '["fall","ladder","critical","rooftop"]'::jsonb
WHERE incident_number = (SELECT incident_number FROM workplace_incidents ORDER BY created_at LIMIT 1 OFFSET 4);

-- ============================================================
-- 2. SAFETY INSPECTIONS - update existing 4
-- ============================================================
UPDATE safety_inspections SET
  inspection_type = 'routine', status = 'completed',
  scheduled_date = '2025-11-01', started_date = '2025-11-01 09:00:00+00', completed_date = '2025-11-01 12:00:00+00',
  workplace_name = 'CAPE Central Office',
  lead_inspector_name = 'Fatima Nzuzi', inspection_scope = 'Full facility walkthrough',
  checklist_used = 'Monthly General Safety Checklist v3.2',
  total_items_checked = 45, items_passed = 40, items_failed = 3, items_requiring_attention = 2,
  hazards_identified = 3, critical_hazards = 0,
  overall_rating = 'Good', score_percentage = 88.89,
  findings = 'Minor housekeeping issues in warehouse. Emergency exit signage needs replacement on floor 2.',
  recommendations = 'Replace exit signs within 2 weeks. Schedule deep clean of warehouse storage area.',
  follow_up_required = true, follow_up_date = '2025-11-15',
  tags = '["routine","monthly","warehouse"]'::jsonb
WHERE inspection_number = (SELECT inspection_number FROM safety_inspections ORDER BY created_at LIMIT 1);

UPDATE safety_inspections SET
  inspection_type = 'targeted', status = 'completed',
  scheduled_date = '2025-12-10', started_date = '2025-12-10 10:00:00+00', completed_date = '2025-12-10 11:30:00+00',
  workplace_name = 'CLC Head Office',
  lead_inspector_name = 'Amara Diallo', inspection_scope = 'Fire safety equipment and exit routes',
  total_items_checked = 28, items_passed = 26, items_failed = 1, items_requiring_attention = 1,
  hazards_identified = 1,
  overall_rating = 'Very Good', score_percentage = 92.86,
  findings = 'One fire extinguisher past inspection date in kitchen area.',
  corrective_actions_required = true,
  tags = '["fire_safety","targeted"]'::jsonb
WHERE inspection_number = (SELECT inspection_number FROM safety_inspections ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE safety_inspections SET
  inspection_type = 'comprehensive', status = 'requires_followup',
  scheduled_date = '2026-01-15', started_date = '2026-01-15 08:00:00+00', completed_date = '2026-01-16 15:00:00+00',
  workplace_name = 'NZILA Ventures Campus',
  lead_inspector_name = 'Kwame Asante', inspection_scope = 'Annual comprehensive facility audit',
  total_items_checked = 120, items_passed = 105, items_failed = 8, items_requiring_attention = 7,
  hazards_identified = 8, critical_hazards = 2,
  overall_rating = 'Satisfactory', score_percentage = 87.50,
  findings = 'Multiple chemical storage violations in maintenance shed. Fall protection anchor points need recertification.',
  areas_of_concern = 'Chemical storage compliance. Roof access safety. Electrical panel clearance.',
  immediate_action_required = true, corrective_actions_required = true,
  follow_up_required = true, follow_up_date = '2026-02-15',
  tags = '["annual","comprehensive","campus"]'::jsonb
WHERE inspection_number = (SELECT inspection_number FROM safety_inspections ORDER BY created_at LIMIT 1 OFFSET 2);

UPDATE safety_inspections SET
  inspection_type = 'post_incident', status = 'completed',
  scheduled_date = '2026-02-22', started_date = '2026-02-22 09:00:00+00', completed_date = '2026-02-22 14:00:00+00',
  workplace_name = 'CLC Head Office',
  lead_inspector_name = 'External Safety Consultant', inspection_scope = 'Roof and ladder access investigation following fall incident',
  total_items_checked = 15, items_passed = 8, items_failed = 5, items_requiring_attention = 2,
  hazards_identified = 5, critical_hazards = 3,
  overall_rating = 'Unsatisfactory', score_percentage = 53.33,
  findings = 'Multiple fall protection deficiencies. Ladder inspection tags expired. No buddy system enforced.',
  immediate_action_required = true, corrective_actions_required = true,
  regulatory_requirement = true, regulatory_agency = 'Provincial OHS',
  tags = '["post_incident","fall","critical"]'::jsonb
WHERE inspection_number = (SELECT inspection_number FROM safety_inspections ORDER BY created_at LIMIT 1 OFFSET 3);

-- ============================================================
-- 3. HAZARD REPORTS - update existing 3
-- ============================================================
UPDATE hazard_reports SET
  hazard_category = 'safety', hazard_level = 'moderate',
  reported_date = '2025-11-20 10:00:00+00', hazard_date = '2025-11-20 09:45:00+00',
  workplace_name = 'CAPE Central Office', department = 'Warehouse',
  reported_by_name = 'Grace Onyango',
  hazard_description = 'Loose floor tiles near warehouse entrance creating trip hazard for forklift operators and pedestrians.',
  who_is_at_risk = 'All warehouse staff and delivery drivers',
  potential_consequences = 'Trips, falls, forklift instability over uneven surface',
  existing_controls = 'Temporary warning cones placed',
  suggested_corrections = 'Replace damaged floor tiles within one week',
  risk_assessment_completed = true, likelihood_score = 4, severity_score = 3, risk_score = 12,
  status = 'in_progress', assigned_to_name = 'Facilities Team',
  tags = '["trip_hazard","flooring","warehouse"]'::jsonb
WHERE report_number = (SELECT report_number FROM hazard_reports ORDER BY created_at LIMIT 1);

UPDATE hazard_reports SET
  hazard_category = 'chemical', hazard_level = 'high',
  reported_date = '2026-01-05 14:00:00+00', hazard_date = '2026-01-05 13:30:00+00',
  workplace_name = 'NZILA Ventures Campus', department = 'Maintenance',
  reported_by_name = 'Samuel Ndaba',
  hazard_description = 'Unlabelled chemical containers stored on open shelving in maintenance room. WHMIS violations.',
  who_is_at_risk = 'Maintenance staff, cleaning crew',
  potential_consequences = 'Chemical exposure, improper handling, regulatory fines',
  suggested_corrections = 'Label all containers per WHMIS requirements. Install proper chemical storage cabinet.',
  risk_assessment_completed = true, likelihood_score = 4, severity_score = 4, risk_score = 16,
  status = 'reported', corrective_action_required = true,
  tags = '["chemical","whmis","storage","high_risk"]'::jsonb
WHERE report_number = (SELECT report_number FROM hazard_reports ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE hazard_reports SET
  hazard_category = 'electrical', hazard_level = 'critical',
  reported_date = '2026-02-10 08:30:00+00', hazard_date = '2026-02-10 08:15:00+00',
  workplace_name = 'CLC Head Office', department = 'IT',
  reported_by_name = 'Amara Diallo',
  hazard_description = 'Exposed wiring behind server rack in IT closet. Extension cords daisy-chained through ceiling tiles.',
  who_is_at_risk = 'IT staff, building occupants',
  potential_consequences = 'Electrical fire, electrocution',
  existing_controls = 'None currently',
  suggested_corrections = 'Hire licensed electrician to properly route and install dedicated circuits.',
  risk_assessment_completed = true, likelihood_score = 3, severity_score = 5, risk_score = 15,
  status = 'assigned', assigned_to_name = 'External Electrician', corrective_action_required = true,
  tags = '["electrical","fire_risk","critical","IT"]'::jsonb
WHERE report_number = (SELECT report_number FROM hazard_reports ORDER BY created_at LIMIT 1 OFFSET 2);

-- ============================================================
-- 4. SAFETY COMMITTEE MEETINGS - update existing 3
-- ============================================================
UPDATE safety_committee_meetings SET
  meeting_type = 'regular', meeting_date = '2025-11-15',
  start_time = '10:00', end_time = '11:30', duration_minutes = 90,
  location = 'CAPE Boardroom A', committee_name = 'Joint Health & Safety Committee',
  chairperson_name = 'Fatima Nzuzi', secretary_name = 'Grace Onyango',
  quorum_met = true, attendance_count = 8,
  agenda = '1. Review of previous minutes\n2. Incident reports\n3. Inspection findings\n4. Training updates\n5. New business',
  minutes = 'Meeting called to order at 10:05. Previous minutes approved. Two incidents reviewed: back strain and near-miss on stairs. Inspection findings discussed. Training schedule for Q1 2026 approved.',
  discussion_summary = 'Discussed warehouse ergonomics improvements and stairwell safety signage.',
  previous_minutes_approved = true, action_items_reviewed = true,
  recommendations = 'Purchase additional pallet jacks. Install permanent wet floor signage protocol.',
  next_meeting_date = '2025-12-15', status = 'completed', minutes_approved = true,
  tags = '["quarterly","jhsc"]'::jsonb
WHERE meeting_number = (SELECT meeting_number FROM safety_committee_meetings ORDER BY created_at LIMIT 1);

UPDATE safety_committee_meetings SET
  meeting_type = 'regular', meeting_date = '2026-01-20',
  start_time = '14:00', end_time = '15:15', duration_minutes = 75,
  location = 'CLC Conference Room', committee_name = 'CLC Safety Committee',
  chairperson_name = 'Amara Diallo', secretary_name = 'David Mwangi',
  quorum_met = true, attendance_count = 6,
  minutes = 'Reviewed Q4 2025 incident statistics. Chemical storage hazard at NZILA campus flagged. Training budget for 2026 discussed.',
  previous_minutes_approved = true,
  recommendations = 'Increase fall protection training frequency. Budget for new chemical storage cabinets.',
  next_meeting_date = '2026-02-20', status = 'completed', minutes_approved = true
WHERE meeting_number = (SELECT meeting_number FROM safety_committee_meetings ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE safety_committee_meetings SET
  meeting_type = 'special', meeting_date = '2026-02-22',
  start_time = '09:00', end_time = '10:30', duration_minutes = 90,
  location = 'CLC Conference Room', committee_name = 'CLC Safety Committee',
  chairperson_name = 'Amara Diallo',
  quorum_met = true, attendance_count = 10,
  agenda = 'Emergency meeting: Review of critical fall incident on 2026-02-20',
  minutes = 'Emergency session convened following critical fall incident. Investigation findings presented. Immediate corrective actions mandated. All roof access suspended pending review.',
  discussion_summary = 'Fall incident root cause analysis. Immediate safety stand-down for all height-related work.',
  recommendations = 'Mandatory fall protection re-training for all maintenance staff. New PPE procurement. Ladder inspection program.',
  status = 'completed', minutes_approved = true,
  tags = '["emergency","fall_incident","critical"]'::jsonb
WHERE meeting_number = (SELECT meeting_number FROM safety_committee_meetings ORDER BY created_at LIMIT 1 OFFSET 2);

-- ============================================================
-- 5. SAFETY TRAINING RECORDS - update existing 2, insert 4 more
-- ============================================================
UPDATE safety_training_records SET
  course_name = 'WHMIS 2015 Certification', course_code = 'WHMIS-2015',
  course_category = 'Regulatory', training_provider = 'SafeWork Ontario',
  trainee_name = 'Jean-Pierre Mbala', trainee_department = 'Operations',
  training_date = '2025-10-15', completion_date = '2025-10-15', expiry_date = '2028-10-15',
  validity_period_months = 36, status = 'completed',
  instructor_name = 'Certified External Trainer', delivery_method = 'In-person',
  duration_hours = 4.00, assessment_required = true, assessment_score = 88.00, passing_score = 70.00, assessment_passed = true,
  certificate_issued = true, certificate_number = 'WHMIS-2025-0412',
  regulatory_requirement = true, regulatory_body = 'Ontario MOL', is_mandatory = true,
  renewal_required = true, renewal_date = '2028-10-15'
WHERE record_number = (SELECT record_number FROM safety_training_records ORDER BY created_at LIMIT 1);

UPDATE safety_training_records SET
  course_name = 'Working at Heights', course_code = 'WAH-MOL',
  course_category = 'Regulatory', training_provider = 'Heights Safety Inc.',
  trainee_name = 'David Mwangi', trainee_department = 'Maintenance',
  training_date = '2025-09-20', completion_date = '2025-09-20', expiry_date = '2028-09-20',
  validity_period_months = 36, status = 'completed',
  instructor_name = 'Mark Thompson, CSP', delivery_method = 'In-person with practical',
  duration_hours = 8.00, assessment_required = true, assessment_score = 92.00, passing_score = 75.00, assessment_passed = true,
  certificate_issued = true, certificate_number = 'WAH-2025-0089',
  regulatory_requirement = true, regulatory_body = 'Ontario MOL', is_mandatory = true,
  notes = 'Includes theoretical and practical components including harness fitting.'
WHERE record_number = (SELECT record_number FROM safety_training_records ORDER BY created_at LIMIT 1 OFFSET 1);

INSERT INTO safety_training_records (id, organization_id, record_number, course_name, course_code, course_category, training_provider,
  trainee_name, trainee_department, training_date, completion_date, expiry_date, validity_period_months, status,
  instructor_name, delivery_method, duration_hours, assessment_required, assessment_score, passing_score, assessment_passed,
  certificate_issued, certificate_number, regulatory_requirement, is_mandatory, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'STR-2026-003', 'First Aid & CPR Level C', 'FACPR-C',
   'Emergency Response', 'Canadian Red Cross', 'Fatima Nzuzi', 'H&S Committee',
   '2026-01-10', '2026-01-11', '2029-01-11', 36, 'completed',
   'Red Cross Certified Instructor', 'In-person', 16.00, true, 95.00, 80.00, true,
   true, 'RC-FACPR-2026-0155', true, true, NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'STR-2026-004', 'Lockout/Tagout Procedures', 'LOTO-101',
   'Machinery Safety', 'Industrial Safety Training Corp', 'Samuel Ndaba', 'Maintenance',
   '2026-01-25', '2026-01-25', '2029-01-25', 36, 'completed',
   'James Wilson, CRSP', 'In-person with hands-on', 6.00, true, 85.00, 70.00, true,
   true, 'LOTO-2026-0038', true, true, NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'STR-2026-005', 'Confined Space Entry', 'CSE-200',
   'Regulatory', 'SafeWork Ontario', 'Grace Onyango', 'Operations',
   '2026-02-01', '2026-02-02', '2029-02-02', 36, 'completed',
   'External Certified Trainer', 'Blended (online + practical)', 12.00, true, 90.00, 75.00, true,
   true, 'CSE-2026-0071', true, true, NOW(), NOW()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'STR-2026-006', 'Fall Protection Refresher', 'FPR-100',
   'Regulatory', 'Heights Safety Inc.', 'Kwame Asante', 'Facilities',
   '2026-03-01', NULL, NULL, 36, 'scheduled',
   'TBD', 'In-person', 4.00, true, NULL, 75.00, NULL,
   false, NULL, true, true, NOW(), NOW());

-- ============================================================
-- 6. SAFETY AUDITS - update existing 2, insert 1
-- ============================================================
UPDATE safety_audits SET
  audit_type = 'internal', status = 'completed',
  scheduled_start_date = '2025-12-01', scheduled_end_date = '2025-12-03',
  actual_start_date = '2025-12-01', actual_end_date = '2025-12-03',
  audit_scope = 'Annual internal H&S management system audit covering all CAPE facilities.',
  audit_objectives = 'Verify compliance with provincial OHS regulations and internal policies.',
  lead_auditor_name = 'Fatima Nzuzi', lead_auditor_certification = 'CRSP',
  total_findings = 8, critical_findings = 0, major_findings = 2, minor_findings = 4, observations = 2,
  overall_compliance_rating = 'Good', compliance_percentage = 85.00,
  strengths = 'Strong incident reporting culture. Active H&S committee. Good PPE compliance.',
  weaknesses = 'Documentation gaps in inspection records. Training tracking needs improvement.',
  executive_summary = 'CAPE demonstrates overall good safety culture with areas for improvement in documentation and training record-keeping.',
  corrective_actions_required = true, corrective_action_plan = 'Implement digital inspection tracking. Centralize training records.',
  follow_up_audit_required = true, follow_up_audit_date = '2026-06-01',
  notes = 'Annual internal audit per H&S policy requirements.'
WHERE audit_number = (SELECT audit_number FROM safety_audits ORDER BY created_at LIMIT 1);

UPDATE safety_audits SET
  audit_type = 'compliance', status = 'in_progress',
  scheduled_start_date = '2026-02-15', scheduled_end_date = '2026-02-17',
  actual_start_date = '2026-02-15',
  audit_scope = 'Post-incident compliance audit of CLC Head Office fall protection systems.',
  audit_objectives = 'Assess compliance with fall protection regulations following critical incident.',
  lead_auditor_name = 'External Safety Consultant', is_external_audit = true,
  auditing_organization = 'Provincial OHS Inspectorate',
  total_findings = 12, critical_findings = 3, major_findings = 5, minor_findings = 3, observations = 1,
  overall_compliance_rating = 'Unsatisfactory', compliance_percentage = 58.00,
  weaknesses = 'Expired ladder inspection tags. Missing fall protection equipment. No buddy system.',
  corrective_actions_required = true,
  notes = 'Triggered by critical fall incident on 2026-02-20.'
WHERE audit_number = (SELECT audit_number FROM safety_audits ORDER BY created_at LIMIT 1 OFFSET 1);

INSERT INTO safety_audits (id, organization_id, audit_number, audit_type, status,
  scheduled_start_date, scheduled_end_date, audit_scope, audit_objectives,
  lead_auditor_name, is_external_audit, auditing_organization,
  overall_compliance_rating, compliance_percentage,
  strengths, executive_summary, created_at, updated_at)
VALUES (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'SA-2026-003',
  'certification', 'scheduled',
  '2026-04-01', '2026-04-05',
  'ISO 45001:2018 certification audit for NZILA Ventures Campus.',
  'Assess readiness for ISO 45001 occupational health and safety management system certification.',
  'Bureau Veritas Auditor', true, 'Bureau Veritas',
  NULL, NULL,
  NULL, NULL, NOW(), NOW());

-- ============================================================
-- 7. SAFETY POLICIES - update existing 4
-- ============================================================
UPDATE safety_policies SET
  policy_title = 'Workplace Health & Safety Policy',
  policy_category = 'General', policy_type = 'policy',
  purpose = 'To establish the organization commitment to providing a safe and healthy workplace for all employees, contractors, and visitors.',
  scope = 'Applies to all CAPE facilities, operations, and personnel.',
  version = '3.0', effective_date = '2025-01-01', next_review_date = '2026-01-01',
  status = 'active', approved_by_name = 'Executive Director',
  approval_date = '2024-12-15', regulatory_requirement = true,
  training_required = true, acknowledgement_required = true,
  tags = '["general","master_policy"]'::jsonb
WHERE policy_number = (SELECT policy_number FROM safety_policies ORDER BY created_at LIMIT 1);

UPDATE safety_policies SET
  policy_title = 'Hazard Reporting and Assessment Procedure',
  policy_category = 'Hazard Management', policy_type = 'procedure',
  purpose = 'To define the process for reporting, assessing, and resolving workplace hazards.',
  scope = 'All CLC workplaces and personnel.',
  version = '2.1', effective_date = '2025-06-01', next_review_date = '2026-06-01',
  status = 'active', approved_by_name = 'H&S Director',
  regulatory_requirement = true, training_required = true,
  tags = '["hazard","reporting","procedure"]'::jsonb
WHERE policy_number = (SELECT policy_number FROM safety_policies ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE safety_policies SET
  policy_title = 'Personal Protective Equipment (PPE) Policy',
  policy_category = 'PPE', policy_type = 'policy',
  purpose = 'To ensure proper selection, use, maintenance, and replacement of PPE.',
  scope = 'All employees and contractors at NZILA Ventures facilities.',
  version = '1.5', effective_date = '2025-03-01', next_review_date = '2026-03-01',
  status = 'active', approved_by_name = 'Safety Manager',
  regulatory_requirement = true, training_required = true,
  tags = '["ppe","equipment","mandatory"]'::jsonb
WHERE policy_number = (SELECT policy_number FROM safety_policies ORDER BY created_at LIMIT 1 OFFSET 2);

UPDATE safety_policies SET
  policy_title = 'Fall Protection Program',
  policy_category = 'Fall Protection', policy_type = 'procedure',
  purpose = 'To prevent falls from heights and establish procedures for safe work above 3 metres.',
  scope = 'All personnel performing work at heights across all organizations.',
  version = '2.0', effective_date = '2025-09-01', next_review_date = '2026-03-01',
  status = 'under_review', drafted_by_name = 'Safety Committee', reviewed_date = '2026-02-22',
  review_comments = 'Under urgent review following critical fall incident. Strengthening requirements.',
  regulatory_requirement = true, legislation_citation = 'Ontario Reg. 213/91 - Construction Projects, O. Reg. 851 - Industrial Establishments',
  training_required = true,
  tags = '["fall_protection","heights","critical","under_review"]'::jsonb
WHERE policy_number = (SELECT policy_number FROM safety_policies ORDER BY created_at LIMIT 1 OFFSET 3);

-- ============================================================
-- 8. SAFETY CERTIFICATIONS - update existing 2, insert 4
-- ============================================================
UPDATE safety_certifications SET
  holder_name = 'Fatima Nzuzi', holder_job_title = 'H&S Committee Chair', holder_department = 'Health & Safety',
  certification_type = 'health_safety_rep', certification_name = 'Joint Health & Safety Committee Certification Part 1 & 2',
  certification_level = 'advanced',
  issuing_organization = 'Ontario Ministry of Labour', certification_standard = 'OHSA s.9',
  issue_date = '2024-06-15', expiry_date = '2027-06-15', validity_period_years = 3,
  status = 'active', renewal_required = true, renewal_date = '2027-06-15',
  regulatory_requirement = true, legislation_reference = 'Ontario OHS Act, Section 9',
  notes = 'Certified worker member representative.'
WHERE certification_number = (SELECT certification_number FROM safety_certifications ORDER BY created_at LIMIT 1);

UPDATE safety_certifications SET
  holder_name = 'David Mwangi', holder_job_title = 'Maintenance Lead', holder_department = 'Maintenance',
  certification_type = 'fall_protection', certification_name = 'Working at Heights Training',
  certification_level = 'basic',
  issuing_organization = 'Heights Safety Inc.', certification_standard = 'Ontario Reg. 297/13',
  issue_date = '2025-09-20', expiry_date = '2028-09-20', validity_period_years = 3,
  status = 'active', renewal_required = true,
  regulatory_requirement = true,
  notes = 'Certification obtained before fall incident. Under review for supplementary training.'
WHERE certification_number = (SELECT certification_number FROM safety_certifications ORDER BY created_at LIMIT 1 OFFSET 1);

INSERT INTO safety_certifications (id, organization_id, certification_number,
  holder_name, holder_job_title, holder_department,
  certification_type, certification_name, certification_level,
  issuing_organization, certification_standard,
  issue_date, expiry_date, validity_period_years, status,
  renewal_required, regulatory_requirement, created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SC-2026-003',
   'Grace Onyango', 'Operations Supervisor', 'Operations',
   'first_aid', 'Standard First Aid with CPR Level C and AED', 'intermediate',
   'Canadian Red Cross', 'CSA Z1210',
   '2026-01-11', '2029-01-11', 3, 'active',
   true, true, NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'SC-2026-004',
   'Samuel Ndaba', 'Maintenance Technician', 'Maintenance',
   'lockout_tagout', 'Lockout/Tagout Authorized Person Certification', 'basic',
   'Industrial Safety Training Corp', 'CSA Z460',
   '2026-01-25', '2029-01-25', 3, 'active',
   true, true, NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'SC-2026-005',
   'Kwame Asante', 'Facilities Manager', 'Facilities',
   'fire_safety', 'Fire Warden Certification', 'basic',
   'Fire Safety Canada', 'NFPA 101',
   '2025-08-01', '2028-08-01', 3, 'active',
   true, false, NOW(), NOW()),
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'SC-2026-006',
   'Jean-Pierre Mbala', 'Warehouse Associate', 'Operations',
   'whmis', 'WHMIS 2015 Certification', 'basic',
   'SafeWork Ontario', 'GHS/WHMIS 2015',
   '2025-10-15', '2028-10-15', 3, 'active',
   true, true, NOW(), NOW());

-- ============================================================
-- 9. PPE EQUIPMENT - update existing 4, insert 2
-- ============================================================
UPDATE ppe_equipment SET
  ppe_type = 'hard_hat', item_name = 'MSA V-Gard Hard Hat',
  manufacturer = 'MSA Safety', model = 'V-Gard 500', size = 'Standard',
  status = 'issued', storage_location = 'PPE Room A',
  quantity_in_stock = 15, quantity_issued = 8,
  issued_to_name = 'Warehouse Team', issued_date = '2025-06-01',
  purchase_date = '2025-05-15', purchase_cost = 32.50, supplier = 'SafetyFirst Supply Co.',
  expiry_date = '2030-05-15', inspection_required = true, inspection_frequency_days = 90,
  last_inspection_date = '2026-01-15', next_inspection_date = '2026-04-15',
  csa_approved = true, certification_standard = 'CSA Z94.1-15',
  notes = 'Standard issue for all warehouse personnel.'
WHERE item_number = (SELECT item_number FROM ppe_equipment ORDER BY created_at LIMIT 1);

UPDATE ppe_equipment SET
  ppe_type = 'safety_glasses', item_name = '3M SecureFit Safety Glasses',
  manufacturer = '3M', model = 'SecureFit 400', size = 'Universal',
  status = 'in_stock', storage_location = 'PPE Room A',
  quantity_in_stock = 50, quantity_issued = 25,
  purchase_date = '2025-08-01', purchase_cost = 12.99, supplier = 'Industrial Safety Distributors',
  expiry_date = '2028-08-01',
  csa_approved = true, ansi_approved = true, certification_standard = 'CSA Z94.3-15 / ANSI Z87.1',
  notes = 'Anti-fog, anti-scratch lens. Mandatory for all shop floor personnel.'
WHERE item_number = (SELECT item_number FROM ppe_equipment ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE ppe_equipment SET
  ppe_type = 'fall_protection', item_name = 'Miller Revolution Full-Body Harness',
  manufacturer = 'Honeywell Miller', model = 'Revolution R1', size = 'L/XL',
  status = 'issued', storage_location = 'Maintenance Cage',
  quantity_in_stock = 4, quantity_issued = 3,
  issued_to_name = 'Maintenance Team', issued_date = '2025-09-01',
  purchase_date = '2025-07-01', purchase_cost = 195.00, supplier = 'Heights Safety Inc.',
  inspection_required = true, inspection_frequency_days = 180,
  last_inspection_date = '2026-01-10', next_inspection_date = '2026-07-10',
  csa_approved = true, certification_standard = 'CSA Z259.10-18',
  notes = 'Mandatory for all work above 3 metres. Inspect before each use.'
WHERE item_number = (SELECT item_number FROM ppe_equipment ORDER BY created_at LIMIT 1 OFFSET 2);

UPDATE ppe_equipment SET
  ppe_type = 'respirator', item_name = '3M 6200 Half Facepiece Respirator',
  manufacturer = '3M', model = '6200 Series', size = 'M',
  status = 'in_stock', storage_location = 'Chemical Storage Room',
  quantity_in_stock = 10, quantity_issued = 4,
  purchase_date = '2025-10-01', purchase_cost = 28.50, supplier = 'SafetyFirst Supply Co.',
  maintenance_required = true, last_maintenance_date = '2026-01-20', next_maintenance_date = '2026-04-20',
  csa_approved = true, certification_standard = 'CSA Z94.4-18',
  notes = 'For use with P100 and organic vapor cartridges.'
WHERE item_number = (SELECT item_number FROM ppe_equipment ORDER BY created_at LIMIT 1 OFFSET 3);

INSERT INTO ppe_equipment (id, organization_id, item_number, ppe_type, item_name,
  manufacturer, model, status, storage_location, quantity_in_stock, quantity_issued,
  purchase_date, purchase_cost, supplier, csa_approved, certification_standard,
  notes, created_at, updated_at)
VALUES
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'PPE-2026-005',
   'high_vis_vest', 'ML Kishigo Class 2 Safety Vest', 'ML Kishigo', 'P-Series', 'in_stock',
   'PPE Supply Closet', 30, 20, '2025-07-01', 15.99, 'Industrial Safety Distributors',
   true, 'CSA Z96-15 Class 2',
   'High-visibility vests for all outdoor workers.', NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'PPE-2026-006',
   'safety_boots', 'Dakota WorkPro Steel Toe Boot', 'Dakota', 'WorkPro 8" ST', 'in_stock',
   'PPE Room B', 12, 8, '2025-09-15', 165.00, 'Mark''s Work Wearhouse',
   true, 'CSA Z195-14 Grade 1',
   'Steel toe, ESR rated. Required for all site workers.', NOW(), NOW());

-- ============================================================
-- 10. INJURY LOGS - update existing 3
-- ============================================================
UPDATE injury_logs SET
  worker_name = 'Jean-Pierre Mbala', worker_job_title = 'Warehouse Associate', worker_department = 'Operations',
  injury_date = '2025-11-15', injury_time = '09:30', reported_date = '2025-11-15',
  body_parts_affected = '["back"]'::jsonb, injury_types = '["strain"]'::jsonb, injury_severity = 'moderate',
  first_aid_provided = true, first_aid_description = 'Ice pack applied to lower back',
  medical_attention_required = true, treated_at_location = 'Walk-in Clinic',
  lost_time_injury = true, first_day_missed = '2025-11-16', return_to_work_date = '2025-11-19', days_away = 3,
  modified_duties_assigned = true, modified_duties_description = 'Light duties - no lifting over 5kg for 2 weeks',
  wsib_claim_filed = true, wsib_claim_number = 'WSIB-2025-1145', wsib_claim_status = 'approved',
  medical_costs = 450.00, wage_loss_costs = 1200.00, total_costs = 1650.00,
  provincial_report_required = true, provincial_report_filed = true,
  status = 'resolved', closed_date = '2025-12-10', closure_notes = 'Worker returned to full duties.'
WHERE log_number = (SELECT log_number FROM injury_logs ORDER BY created_at LIMIT 1);

UPDATE injury_logs SET
  worker_name = 'Blessing Okafor', worker_job_title = 'Maintenance Worker', worker_department = 'Maintenance',
  injury_date = '2026-02-05', injury_time = '08:45', reported_date = '2026-02-05',
  body_parts_affected = '["eyes"]'::jsonb, injury_types = '["chemical_burn"]'::jsonb, injury_severity = 'serious',
  first_aid_provided = true, first_aid_description = 'Eye wash station used for 15 minutes',
  medical_attention_required = true, treated_at_location = 'Regional Hospital ER',
  hospitalized = true, hospitalization_days = 1,
  lost_time_injury = true, first_day_missed = '2026-02-06', days_away = 5,
  wsib_claim_filed = true, wsib_claim_number = 'WSIB-2026-0205', wsib_claim_status = 'under_review',
  medical_costs = 2800.00, wage_loss_costs = 2000.00, total_costs = 4800.00,
  provincial_report_required = true, provincial_report_filed = true,
  status = 'active', notes = 'Follow-up ophthalmology appointment scheduled.'
WHERE log_number = (SELECT log_number FROM injury_logs ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE injury_logs SET
  worker_name = 'David Mwangi', worker_job_title = 'Maintenance Lead', worker_department = 'Maintenance',
  injury_date = '2026-02-20', injury_time = '13:30', reported_date = '2026-02-20',
  body_parts_affected = '["leg","ankle"]'::jsonb, injury_types = '["fracture"]'::jsonb, injury_severity = 'critical',
  first_aid_provided = true, first_aid_description = 'Immobilized leg, called EMS',
  medical_attention_required = true, treated_at_location = 'Regional Hospital', hospital_name = 'Regional General Hospital',
  hospitalized = true, hospitalization_days = 7,
  lost_time_injury = true, first_day_missed = '2026-02-21', days_away = 45,
  permanent_impairment = false,
  wsib_claim_filed = true, wsib_claim_number = 'WSIB-2026-0042', wsib_claim_status = 'approved',
  benefits_approved = true, benefit_amount = 15000.00,
  medical_costs = 12500.00, wage_loss_costs = 18000.00, rehabilitation_costs = 5000.00, total_costs = 35500.00,
  osha_recordable = true, provincial_report_required = true, provincial_report_filed = true,
  status = 'active', notes = 'Critical fall from ladder. Ongoing rehabilitation. Target return date: April 2026.'
WHERE log_number = (SELECT log_number FROM injury_logs ORDER BY created_at LIMIT 1 OFFSET 2);

-- ============================================================
-- 11. CORRECTIVE ACTIONS - update existing 3, insert 3
-- ============================================================
UPDATE corrective_actions SET
  source_type = 'inspection', source_reference = 'Monthly general safety inspection',
  action_type = 'corrective', priority = 'normal', status = 'in_progress',
  title = 'Replace emergency exit signage on Floor 2',
  description = 'Exit signs on Floor 2 are faded and non-illuminated. Must be replaced with backlit LED signs.',
  proposed_action = 'Purchase and install 4 LED exit signs per building code requirements.',
  assigned_to_name = 'Facilities Team', identified_date = '2025-11-01', due_date = '2025-11-30',
  progress_percentage = 75, progress_notes = 'Signs ordered. Installation scheduled for Nov 28.',
  notes = 'Budget approved. Contractor confirmed.'
WHERE action_number = (SELECT action_number FROM corrective_actions ORDER BY created_at LIMIT 1);

UPDATE corrective_actions SET
  source_type = 'hazard', source_reference = 'Chemical storage hazard report',
  action_type = 'corrective', priority = 'urgent', status = 'assigned',
  title = 'Install proper chemical storage cabinet and label all containers',
  description = 'Unlabelled chemical containers on open shelving violating WHMIS requirements.',
  root_cause = 'No designated chemical storage area. Lack of WHMIS compliance awareness.',
  proposed_action = 'Purchase WHMIS-compliant chemical storage cabinet. Label all containers. Train staff.',
  estimated_cost = 2500.00, assigned_to_name = 'Samuel Ndaba',
  identified_date = '2026-01-05', due_date = '2026-02-05',
  progress_percentage = 10, progress_notes = 'Cabinet specifications reviewed. Quotes pending.'
WHERE action_number = (SELECT action_number FROM corrective_actions ORDER BY created_at LIMIT 1 OFFSET 1);

UPDATE corrective_actions SET
  source_type = 'incident', source_reference = 'Critical fall incident 2026-02-20',
  action_type = 'corrective', priority = 'immediate', status = 'in_progress',
  title = 'Complete fall protection system overhaul',
  description = 'Following critical fall incident, comprehensive overhaul of all fall protection systems required.',
  root_cause = 'Non-compliance with fall protection protocol. Expired equipment. Missing buddy system.',
  proposed_action = 'Replace all fall protection equipment. Implement mandatory buddy system. Re-train all staff.',
  estimated_cost = 15000.00, assigned_to_name = 'Safety Committee',
  identified_date = '2026-02-22', due_date = '2026-03-15',
  progress_percentage = 30, progress_notes = 'Equipment audit completed. New harnesses ordered. Training schedule created.'
WHERE action_number = (SELECT action_number FROM corrective_actions ORDER BY created_at LIMIT 1 OFFSET 2);

INSERT INTO corrective_actions (id, organization_id, action_number,
  source_type, action_type, priority, status,
  title, description, proposed_action,
  assigned_to_name, identified_date, due_date, progress_percentage,
  created_at, updated_at)
VALUES
  (gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CA-2026-004',
   'inspection', 'preventive', 'normal', 'open',
   'Install additional pallet jacks at loading bays',
   'Warehouse back strain incident linked to insufficient mechanical lifting aids.',
   'Purchase 3 additional electric pallet jacks for loading bays 1-3.',
   'Operations Manager', '2025-11-20', '2026-01-15', 0,
   NOW(), NOW()),
  (gen_random_uuid(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CA-2026-005',
   'hazard', 'corrective', 'urgent', 'assigned',
   'Rewire IT server closet electrical circuits',
   'Exposed wiring and daisy-chained extension cords creating fire hazard.',
   'Engage licensed electrician to install dedicated circuits and proper cable management.',
   'IT Manager', '2026-02-10', '2026-03-01', 0,
   NOW(), NOW()),
  (gen_random_uuid(), '458a56cb-251a-4c91-a0b5-81bb8ac39087', 'CA-2026-006',
   'audit', 'improvement', 'normal', 'open',
   'Implement digital safety inspection tracking system',
   'Paper-based inspection records difficult to track and analyze.',
   'Deploy digital inspection platform with mobile app for field inspectors.',
   'IT & Safety Joint Team', '2025-12-03', '2026-06-01', 0,
   NOW(), NOW());

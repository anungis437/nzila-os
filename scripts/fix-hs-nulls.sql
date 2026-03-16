-- Fix all remaining unpopulated records across all H&S tables

-- Workplace incidents: fill any with NULL incident_type
UPDATE workplace_incidents SET
  incident_type = 'near_miss', severity = 'minor',
  incident_date = NOW() - interval '30 days', reported_date = NOW() - interval '30 days',
  workplace_name = 'NZILA Ventures Campus', department_name = 'General',
  description = 'Near miss: unsecured shelving unit swayed when bumped by cart.',
  status = 'closed', closed_date = NOW() - interval '25 days',
  tags = '["shelving","near_miss"]'::jsonb
WHERE incident_type IS NULL;

-- Safety inspections: fill any with NULL inspection_type
UPDATE safety_inspections SET
  inspection_type = 'routine', status = 'completed',
  scheduled_date = NOW() - interval '45 days',
  started_date = NOW() - interval '45 days', completed_date = NOW() - interval '45 days',
  workplace_name = 'CLC Head Office',
  lead_inspector_name = 'Safety Team Lead',
  inspection_scope = 'Monthly walkthrough inspection',
  total_items_checked = 30, items_passed = 28, items_failed = 1, items_requiring_attention = 1,
  overall_rating = 'Good', score_percentage = 93.33,
  findings = 'Minor housekeeping issues in break room. Otherwise all clear.',
  tags = '["routine","monthly"]'::jsonb
WHERE inspection_type IS NULL;

-- Hazard reports: fill any with NULL hazard_category
UPDATE hazard_reports SET
  hazard_category = 'ergonomic', hazard_level = 'moderate',
  reported_date = NOW() - interval '20 days', hazard_date = NOW() - interval '20 days',
  workplace_name = 'CAPE Central Office', department = 'Administration',
  reported_by_name = 'Office Staff',
  hazard_description = 'Workstation chairs in admin area are worn and lack proper lumbar support.',
  who_is_at_risk = 'Administrative staff',
  potential_consequences = 'Back pain, repetitive strain injuries',
  suggested_corrections = 'Replace chairs with ergonomic models.',
  status = 'reported',
  tags = '["ergonomic","office","furniture"]'::jsonb
WHERE hazard_category IS NULL;

-- Safety committee meetings: fill any with NULL meeting_type
UPDATE safety_committee_meetings SET
  meeting_type = 'regular', meeting_date = NOW() - interval '60 days',
  start_time = '10:00', end_time = '11:00', duration_minutes = 60,
  location = 'NZILA Conference Room', committee_name = 'NZILA Safety Committee',
  chairperson_name = 'Kwame Asante',
  quorum_met = true, attendance_count = 5,
  minutes = 'Regular monthly safety committee meeting. No major incidents to report. Training schedule reviewed.',
  status = 'completed', minutes_approved = true
WHERE meeting_type IS NULL;

-- Safety training records: fill any with NULL course_name
UPDATE safety_training_records SET
  course_name = 'Fire Extinguisher Training', course_code = 'FIRE-101',
  course_category = 'Emergency Response',
  trainee_name = 'All Staff', trainee_department = 'General',
  training_date = NOW() - interval '90 days', completion_date = NOW() - interval '90 days',
  status = 'completed', delivery_method = 'In-person',
  duration_hours = 2.00, is_mandatory = true
WHERE course_name IS NULL;

-- Safety audits: fill any with NULL audit_type
UPDATE safety_audits SET
  audit_type = 'internal', status = 'completed',
  scheduled_start_date = NOW() - interval '90 days',
  actual_start_date = NOW() - interval '90 days', actual_end_date = NOW() - interval '88 days',
  audit_scope = 'Quarterly internal safety management review.',
  lead_auditor_name = 'Internal Auditor',
  total_findings = 3, critical_findings = 0, major_findings = 0, minor_findings = 2, observations = 1,
  overall_compliance_rating = 'Good', compliance_percentage = 90.00,
  executive_summary = 'Positive quarterly review. Minor items noted for follow-up.',
  notes = 'Routine quarterly audit.'
WHERE audit_type IS NULL;

-- Safety policies: fill any with NULL policy_title
UPDATE safety_policies SET
  policy_title = 'Emergency Response Plan',
  policy_category = 'Emergency', policy_type = 'procedure',
  purpose = 'Establish procedures for responding to workplace emergencies.',
  scope = 'All staff and visitors.',
  version = '2.0', effective_date = NOW() - interval '180 days',
  next_review_date = NOW() + interval '180 days',
  status = 'active', approved_by_name = 'Executive Director',
  regulatory_requirement = true, training_required = true,
  tags = '["emergency","evacuation","mandatory"]'::jsonb
WHERE policy_title IS NULL;

-- Safety certifications: fill any with NULL certification_type
UPDATE safety_certifications SET
  holder_name = 'Amara Diallo', holder_job_title = 'Safety Officer', holder_department = 'Health & Safety',
  certification_type = 'health_safety_rep',
  certification_name = 'Joint Health & Safety Committee Certification Part 1',
  certification_level = 'basic',
  issuing_organization = 'Ontario Ministry of Labour',
  issue_date = NOW() - interval '365 days', expiry_date = NOW() + interval '730 days',
  validity_period_years = 3, status = 'active',
  renewal_required = true, regulatory_requirement = true
WHERE certification_type IS NULL;

-- PPE equipment: fill any with NULL ppe_type
UPDATE ppe_equipment SET
  ppe_type = 'hearing_protection', item_name = '3M E-A-R Earplugs',
  manufacturer = '3M', model = 'Classic Series',
  status = 'in_stock', storage_location = 'PPE Dispenser - Shop Floor',
  quantity_in_stock = 200, quantity_issued = 50,
  purchase_date = NOW() - interval '60 days', purchase_cost = 0.45,
  supplier = 'Industrial Safety Distributors',
  csa_approved = true, certification_standard = 'CSA Z94.2-14',
  notes = 'Disposable foam earplugs. NRR 29 dB.'
WHERE ppe_type IS NULL;

-- Injury logs: fill any with NULL injury_severity
UPDATE injury_logs SET
  worker_name = 'Grace Onyango', worker_job_title = 'Operations Supervisor', worker_department = 'Operations',
  injury_date = NOW() - interval '40 days', injury_time = '11:15', reported_date = NOW() - interval '40 days',
  body_parts_affected = '["hand"]'::jsonb, injury_types = '["cut"]'::jsonb, injury_severity = 'minor',
  first_aid_provided = true, first_aid_description = 'Bandage applied to cut on left hand.',
  lost_time_injury = false,
  status = 'resolved', closed_date = NOW() - interval '38 days',
  notes = 'Minor cut from box cutter. No stitches required.'
WHERE injury_severity IS NULL;

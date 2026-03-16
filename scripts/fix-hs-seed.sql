ALTER TABLE safety_committee_meetings ADD COLUMN IF NOT EXISTS tags jsonb;

UPDATE safety_committee_meetings SET
  tags = '["quarterly","jhsc"]'::jsonb
WHERE meeting_number = (SELECT meeting_number FROM safety_committee_meetings ORDER BY created_at LIMIT 1);

UPDATE safety_committee_meetings SET
  tags = '["emergency","fall_incident","critical"]'::jsonb
WHERE meeting_number = (SELECT meeting_number FROM safety_committee_meetings ORDER BY created_at LIMIT 1 OFFSET 2);

-- Fix the UPDATE 0s: re-run the committee meeting updates for records 2 and 3
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
WHERE meeting_number = (SELECT meeting_number FROM safety_committee_meetings ORDER BY created_at LIMIT 1 OFFSET 1)
  AND meeting_type IS NULL;

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
WHERE meeting_number = (SELECT meeting_number FROM safety_committee_meetings ORDER BY created_at LIMIT 1 OFFSET 2)
  AND meeting_type IS NULL;

-- Fix training records that may have missed
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
WHERE record_number = (SELECT record_number FROM safety_training_records ORDER BY created_at LIMIT 1)
  AND course_name IS NULL;

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
WHERE record_number = (SELECT record_number FROM safety_training_records ORDER BY created_at LIMIT 1 OFFSET 1)
  AND course_name IS NULL;

-- Fix safety audits that may have missed (UPDATE 0 for offset records)
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
WHERE audit_number = (SELECT audit_number FROM safety_audits ORDER BY created_at LIMIT 1)
  AND audit_type IS NULL;

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
WHERE audit_number = (SELECT audit_number FROM safety_audits ORDER BY created_at LIMIT 1 OFFSET 1)
  AND audit_type IS NULL;

-- Fix safety certifications that may have missed
UPDATE safety_certifications SET
  holder_name = 'Fatima Nzuzi', holder_job_title = 'H&S Committee Chair', holder_department = 'Health & Safety',
  certification_type = 'health_safety_rep', certification_name = 'Joint Health & Safety Committee Certification Part 1 & 2',
  certification_level = 'advanced',
  issuing_organization = 'Ontario Ministry of Labour', certification_standard = 'OHSA s.9',
  issue_date = '2024-06-15', expiry_date = '2027-06-15', validity_period_years = 3,
  status = 'active', renewal_required = true, renewal_date = '2027-06-15',
  regulatory_requirement = true, legislation_reference = 'Ontario OHS Act, Section 9',
  notes = 'Certified worker member representative.'
WHERE certification_number = (SELECT certification_number FROM safety_certifications ORDER BY created_at LIMIT 1)
  AND holder_name IS NULL;

UPDATE safety_certifications SET
  holder_name = 'David Mwangi', holder_job_title = 'Maintenance Lead', holder_department = 'Maintenance',
  certification_type = 'fall_protection', certification_name = 'Working at Heights Training',
  certification_level = 'basic',
  issuing_organization = 'Heights Safety Inc.', certification_standard = 'Ontario Reg. 297/13',
  issue_date = '2025-09-20', expiry_date = '2028-09-20', validity_period_years = 3,
  status = 'active', renewal_required = true,
  regulatory_requirement = true,
  notes = 'Certification obtained before fall incident. Under review for supplementary training.'
WHERE certification_number = (SELECT certification_number FROM safety_certifications ORDER BY created_at LIMIT 1 OFFSET 1)
  AND holder_name IS NULL;

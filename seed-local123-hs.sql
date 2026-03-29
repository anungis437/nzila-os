BEGIN;

-- Fix empty status on existing Local 123 incidents
UPDATE workplace_incidents SET status = 'investigating' WHERE id = 'a13e3624-847c-4b74-8a56-c54c34092f24' AND (status IS NULL OR status = '');
UPDATE workplace_incidents SET status = 'reported' WHERE id = '9681b582-b460-4118-aeb8-389ff6b98fbf' AND (status IS NULL OR status = '');
UPDATE workplace_incidents SET status = 'closed' WHERE id = 'f97cfb21-d1ad-4ebf-aa0d-353f21c5b959' AND (status IS NULL OR status = '');

-- Additional incidents for Local 123
INSERT INTO workplace_incidents (
  id, organization_id, incident_number, incident_type, severity,
  incident_date, reported_date, location_description,
  workplace_name, department_name,
  description, what_happened, task_being_performed,
  witnesses_present, reported_by_name, reported_by_job_title,
  is_anonymous, status, created_at, updated_at
) VALUES
(
  'c1230001-0001-4000-8000-000000000001',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-INC-2026-004', 'ergonomic', 'minor',
  '2026-03-10 10:00:00+00', '2026-03-10 14:00:00+00',
  'Municipal Works Yard — Office Trailer',
  'City Works Yard', 'Public Works',
  'Worker reported repetitive strain in wrists after 6 hours of data entry on a non-ergonomic keyboard. No adjustable desk or wrist rest provided in the trailer office.',
  'Worker spent full shift entering winter pothole repair data into the tracking system. Old desk has no keyboard tray.',
  'Data entry for road maintenance tracking',
  false, 'Bob Smith', 'Steward',
  false, 'reported',
  '2026-03-10 14:00:00+00', '2026-03-10 14:00:00+00'
),
(
  'c1230001-0002-4000-8000-000000000002',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-INC-2026-005', 'near_miss', 'near_miss',
  '2026-03-20 07:45:00+00', '2026-03-20 08:30:00+00',
  'Snow Plow Garage — Bay 3',
  'Municipal Garage', 'Fleet Services',
  'Hydraulic line on plow unit #7 burst during pre-trip inspection. Hydraulic fluid sprayed across the bay floor. No injuries — operator had not yet entered the cab. If failure occurred during operation, could have caused loss of steering control.',
  'Operator was performing pre-trip walk-around when they heard a loud pop. Hydraulic fluid sprayed from a cracked fitting on the left plow arm.',
  'Pre-trip vehicle inspection',
  true, null, null,
  true, 'investigating',
  '2026-03-20 08:30:00+00', '2026-03-21 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- Hazard Reports for Local 123
INSERT INTO hazard_reports (
  id, organization_id, report_number, hazard_category, hazard_level,
  reported_date, hazard_date,
  workplace_name, department, specific_location,
  reported_by_name, is_anonymous,
  hazard_description, who_is_at_risk, potential_consequences,
  existing_controls, suggested_corrections,
  likelihood_score, severity_score, risk_score,
  status, created_at, updated_at
) VALUES
(
  'c1230002-0001-4000-8000-000000000001',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-HAZ-2026-001', 'safety', 'high',
  '2026-02-28 09:00:00+00', '2026-02-25 00:00:00+00',
  'Municipal Garage', 'Fleet Services',
  'Snow plow bay — hydraulic maintenance area',
  'Bob Smith', false,
  'Hydraulic fittings on 4 of 12 plow units are past recommended replacement intervals. Fleet maintenance budget was cut last year and replacements were deferred. With heavy winter usage, failure risk is elevated.',
  'All plow operators and garage mechanics (approx. 20 people)',
  'Hydraulic failure during operation — loss of steering/braking, spray burns, collision',
  'Pre-trip inspections catch visible leaks but cannot detect internal fatigue',
  'Replace all overdue hydraulic fittings before next winter season. Add hydraulic line age tracking to the fleet management system.',
  4, 4, 16,
  'assessed', '2026-02-28 09:00:00+00', '2026-03-02 14:00:00+00'
),
(
  'c1230002-0002-4000-8000-000000000002',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-HAZ-2026-002', 'ergonomic', 'moderate',
  '2026-03-12 10:00:00+00', '2026-03-10 00:00:00+00',
  'City Works Yard', 'Public Works',
  'Office trailer — all workstations',
  null, true,
  'Office trailer workstations lack ergonomic equipment. No adjustable desks, chairs are 10+ years old with broken lumbar support, and keyboards are standard flat type. Workers doing data entry shifts report wrist and back pain.',
  'All administrative and data entry staff using the trailer office (6 people)',
  'Repetitive strain injuries, chronic back pain, carpal tunnel syndrome',
  'None — standard office furniture only',
  'Procure ergonomic keyboards, adjustable monitor arms, and replace chairs with CSA-approved ergonomic models. Consider sit-stand desk converters.',
  3, 3, 9,
  'reported', '2026-03-12 10:00:00+00', '2026-03-12 10:00:00+00'
),
(
  'c1230002-0003-4000-8000-000000000003',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-HAZ-2026-003', 'chemical', 'moderate',
  '2026-03-15 14:00:00+00', '2026-03-14 00:00:00+00',
  'Municipal Garage', 'Fleet Services',
  'Wash bay and de-icing chemical storage',
  'Marie-Claire Dubois', false,
  'De-icing chemical (calcium chloride solution) stored in unlabelled containers next to the vehicle wash bay. SDS sheets are in the office, not posted at the storage location. Splash exposure possible when transferring solution.',
  'Wash bay operators, mechanics, and anyone accessing the area',
  'Skin and eye irritation from splash exposure, respiratory issues in enclosed space',
  'Gloves available but no goggles or face shields provided at the storage location',
  'Label all containers per WHMIS requirements. Post SDS at point of use. Provide goggles and face shields at the storage location. Install an eye wash station within 10 seconds travel distance.',
  3, 3, 9,
  'assigned', '2026-03-15 14:00:00+00', '2026-03-16 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- Safety Inspections for Local 123
INSERT INTO safety_inspections (
  id, organization_id, inspection_number, inspection_type, status,
  scheduled_date, started_date, completed_date,
  workplace_name, areas_inspected, specific_location,
  lead_inspector_name, inspector_names,
  inspection_scope, total_items_checked, items_passed, items_failed,
  items_requiring_attention, hazards_identified, critical_hazards,
  overall_rating, score_percentage,
  findings, recommendations,
  follow_up_required, follow_up_date,
  created_at, updated_at
) VALUES
(
  'c1230003-0001-4000-8000-000000000001',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-INSP-2026-001', 'routine', 'completed',
  '2026-02-01 09:00:00+00', '2026-02-01 09:15:00+00', '2026-02-01 13:00:00+00',
  'Municipal Garage', '["Plow bay", "Wash bay", "Tool crib", "Chemical storage", "Break room", "First aid"]',
  'Municipal Garage — All Areas',
  'Bob Smith', '["Bob Smith", "Marie-Claire Dubois"]',
  'Quarterly routine workplace inspection per JHSC schedule',
  40, 32, 4, 4, 3, 0,
  'Needs Improvement', 80,
  'Plow bay generally tidy. Hydraulic fittings on 4 units overdue (see HAZ-2026-001). Wash bay chemical storage unlabelled. Tool crib organized. Break room adequate. First aid kit stocked but AED battery expired last month. Emergency exit in wash bay partially blocked by pallets.',
  'Replace overdue hydraulic fittings. Label chemical containers per WHMIS. Replace AED battery. Clear emergency exit in wash bay. Add eye wash station near chemical storage.',
  true, '2026-03-01 09:00:00+00',
  '2026-02-01 13:00:00+00', '2026-02-02 08:00:00+00'
),
(
  'c1230003-0002-4000-8000-000000000002',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-INSP-2026-002', 'post_incident', 'requires_followup',
  '2026-03-21 08:00:00+00', '2026-03-21 08:30:00+00', '2026-03-21 14:00:00+00',
  'Municipal Garage', '["Plow bay 3", "Hydraulic systems", "PPE stations", "Spill kits"]',
  'Plow Bay 3 — Post-Incident (Hydraulic Burst)',
  'Bob Smith', '["Bob Smith", "Fleet Supervisor Tony Nguyen"]',
  'Post-incident inspection following hydraulic line burst on plow unit #7 (CUPE123-INC-2026-005)',
  25, 18, 5, 2, 2, 1,
  'Unsatisfactory', 72,
  'Critical: Hydraulic fitting on unit #7 showed metal fatigue — last replaced 2022. Three additional units (#3, #9, #11) have fittings from the same batch and age. Spill kit in bay 3 was depleted from the incident and not restocked. PPE (face shields) available but stored in the tool crib, not at the bay.',
  'IMMEDIATE: Ground units #3, #9, #11 until hydraulic fittings inspected/replaced. Restock spill kit in bay 3. Relocate face shields to each bay. Add hydraulic fitting inspection to monthly checklist.',
  true, '2026-03-28 08:00:00+00',
  '2026-03-21 14:00:00+00', '2026-03-22 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- Corrective Actions for Local 123
INSERT INTO corrective_actions (
  id, organization_id, action_number, source_type, source_reference,
  priority, status, title, description,
  assigned_to_name, assigned_date, due_date,
  progress_percentage,
  created_at, updated_at
) VALUES
(
  'c1230004-0001-4000-8000-000000000001',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-CA-2026-001', 'incident', 'CUPE123-INC-2026-001',
  'high', 'in_progress', 'Fall prevention — loading dock guardrails',
  'Install permanent guardrails on loading dock where the fall incident occurred. Current chain barrier is insufficient. Obtain quotes for steel guardrails meeting OH&S requirements.',
  'Facilities Coordinator', '2026-02-15 09:00:00+00', '2026-03-31',
  40,
  '2026-02-15 09:00:00+00', '2026-03-10 14:00:00+00'
),
(
  'c1230004-0002-4000-8000-000000000002',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-CA-2026-002', 'hazard', 'CUPE123-HAZ-2026-001',
  'urgent', 'in_progress', 'Replace overdue hydraulic fittings on plow fleet',
  'Replace hydraulic fittings on units #3, #7, #9, #11. Units grounded until replacement completed. Source OEM-spec fittings. Priority: unit #7 first (incident unit).',
  'Fleet Supervisor Tony Nguyen', '2026-03-22 09:00:00+00', '2026-04-07',
  25,
  '2026-03-22 09:00:00+00', '2026-03-25 14:00:00+00'
),
(
  'c1230004-0003-4000-8000-000000000003',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-CA-2026-003', 'hazard', 'CUPE123-HAZ-2026-003',
  'high', 'assigned', 'WHMIS compliance — chemical storage labelling',
  'Label all de-icing chemical containers per WHMIS 2015 requirements. Post SDS sheets at point of use near wash bay chemical storage. Procure and install goggles, face shields, and an eye wash station.',
  'H&S Committee', '2026-03-16 09:00:00+00', '2026-04-15',
  0,
  '2026-03-16 09:00:00+00', '2026-03-16 09:00:00+00'
),
(
  'c1230004-0004-4000-8000-000000000004',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-CA-2026-004', 'inspection', 'CUPE123-INSP-2026-001',
  'normal', 'verified', 'Replace expired AED battery',
  'AED battery in the municipal garage expired January 2026. Replace with compatible battery and verify unit passes self-test.',
  'First Aid Officer', '2026-02-02 09:00:00+00', '2026-02-15',
  100,
  '2026-02-02 09:00:00+00', '2026-02-10 14:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- Safety Training Records for Local 123
INSERT INTO safety_training_records (
  id, organization_id, record_number, course_name, course_category,
  trainee_name, trainee_job_title, trainee_department,
  training_date, completion_date, expiry_date,
  status, delivery_method, duration_hours,
  assessment_required, assessment_score, passing_score, passed,
  certificate_issued, certificate_number,
  is_mandatory, renewal_required,
  created_at, updated_at
) VALUES
(
  'c1230005-0001-4000-8000-000000000001',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-TR-2026-001', 'WHMIS 2015 Refresher', 'whmis',
  'Bob Smith', 'Steward', 'Public Works',
  '2026-01-20', '2026-01-20', '2027-01-20',
  'completed', 'in_person', 3,
  true, 88, 70, true,
  true, 'WHMIS-123-2026-001',
  true, true,
  '2026-01-20 12:00:00+00', '2026-01-20 12:00:00+00'
),
(
  'c1230005-0002-4000-8000-000000000002',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-TR-2026-002', 'WHMIS 2015 Refresher', 'whmis',
  'Marie-Claire Dubois', 'Member', 'Public Works',
  '2026-01-20', '2026-01-20', '2027-01-20',
  'completed', 'in_person', 3,
  true, 91, 70, true,
  true, 'WHMIS-123-2026-002',
  true, true,
  '2026-01-20 12:00:00+00', '2026-01-20 12:00:00+00'
),
(
  'c1230005-0003-4000-8000-000000000003',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-TR-2026-003', 'H&S Rep Certification — Part 1', 'health_safety',
  'Bob Smith', 'Steward', 'Public Works',
  '2026-02-10', '2026-02-12', '2029-02-12',
  'completed', 'in_person', 16,
  true, 85, 75, true,
  true, 'HSR1-123-2026-001',
  false, true,
  '2026-02-12 16:00:00+00', '2026-02-12 16:00:00+00'
),
(
  'c1230005-0004-4000-8000-000000000004',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-TR-2026-004', 'Fall Protection Awareness', 'fall_protection',
  'Marie-Claire Dubois', 'Member', 'Public Works',
  '2026-03-05', '2026-03-05', '2028-03-05',
  'completed', 'online', 2,
  true, 80, 70, true,
  false, null,
  true, true,
  '2026-03-05 14:00:00+00', '2026-03-05 14:00:00+00'
),
(
  'c1230005-0005-4000-8000-000000000005',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-TR-2026-005', 'Defensive Driving — Snow Plow Operations', 'driving',
  'Tony Nguyen', 'Fleet Supervisor', 'Fleet Services',
  '2026-04-01', null, null,
  'scheduled', 'in_person', 8,
  true, null, 75, null,
  false, null,
  true, true,
  '2026-03-20 10:00:00+00', '2026-03-20 10:00:00+00'
),
(
  'c1230005-0006-4000-8000-000000000006',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-TR-2026-006', 'Spill Response & Cleanup', 'spill_response',
  'Bob Smith', 'Steward', 'Public Works',
  '2026-03-25', '2026-03-25', '2028-03-25',
  'completed', 'in_person', 4,
  true, 92, 70, true,
  true, 'SPILL-123-2026-001',
  true, true,
  '2026-03-25 16:00:00+00', '2026-03-25 16:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- Safety Committee Meetings for Local 123
INSERT INTO safety_committee_meetings (
  id, organization_id, meeting_number, meeting_type, meeting_date,
  start_time, end_time, duration_minutes,
  location, committee_name,
  chairperson_name, secretary_name,
  member_names, attendee_names, attendance_count,
  quorum_met,
  agenda, discussion_summary,
  key_points,
  action_items_created,
  next_meeting_date, status,
  created_at, updated_at
) VALUES
(
  'c1230006-0001-4000-8000-000000000001',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-JHSC-2026-02', 'regular', '2026-02-07 13:00:00+00',
  '2026-02-07T13:00:00', '2026-02-07T14:15:00', 75,
  'Municipal Garage — Break Room', 'CUPE Local 123 Joint H&S Committee',
  'Bob Smith', 'Marie-Claire Dubois',
  '["Bob Smith", "Marie-Claire Dubois", "Tony Nguyen", "Mgmt Rep: Sarah Chen", "Mgmt Rep: Derek Williams"]',
  '["Bob Smith", "Marie-Claire Dubois", "Tony Nguyen", "Sarah Chen", "Derek Williams"]',
  5, true,
  'Review of Q4 2025 incident stats. February inspection planning. Hydraulic fitting replacement budget request. New member orientation. Old business.',
  'Reviewed Q4 stats: 2 incidents, 1 near-miss. February inspection of full garage scheduled for Feb 1. Bob raised hydraulic fitting replacements — management confirmed budget request submitted but not yet approved. Marie-Claire Dubois appointed as new committee secretary. Tony flagged that 3 plow operators need WHMIS refresher before spring.',
  '["Hydraulic fitting budget request pending — Bob to escalate if not approved by March", "Feb 1 inspection: Bob and Marie-Claire to lead", "WHMIS refresher for 3 plow operators to be scheduled by end of Feb", "AED battery expired — needs immediate replacement"]',
  '["Replace AED battery (Due: Feb 15)", "Schedule WHMIS refresher for 3 plow operators (Due: Feb 28)", "Follow up on hydraulic fitting budget (Due: March 7)"]',
  '2026-03-07 13:00:00+00', 'completed',
  '2026-02-07 14:15:00+00', '2026-02-08 09:00:00+00'
),
(
  'c1230006-0002-4000-8000-000000000002',
  '4a20966a-2f17-46b5-9b84-b3efea57b50a',
  'CUPE123-JHSC-2026-03', 'incident_review', '2026-03-24 13:00:00+00',
  '2026-03-24T13:00:00', '2026-03-24T14:45:00', 105,
  'Municipal Garage — Break Room', 'CUPE Local 123 Joint H&S Committee',
  'Bob Smith', 'Marie-Claire Dubois',
  '["Bob Smith", "Marie-Claire Dubois", "Tony Nguyen", "Mgmt Rep: Sarah Chen", "Mgmt Rep: Derek Williams"]',
  '["Bob Smith", "Marie-Claire Dubois", "Tony Nguyen", "Sarah Chen", "Derek Williams"]',
  5, true,
  'Emergency meeting: hydraulic line burst incident debrief. Post-incident inspection results. Fleet grounding decision. Chemical storage WHMIS compliance. Ergonomic assessment for office trailer.',
  'Detailed review of March 20 hydraulic burst incident on unit #7. Tony confirmed the fitting was from 2022 batch — same batch on 3 other units. Committee unanimously voted to ground units #3, #9, #11 until fittings replaced. Management agreed to emergency procurement. Bob presented post-incident inspection findings (72% score). Chemical storage labelling deficiency discussed — assigned to H&S committee. Ergonomic concerns in office trailer acknowledged — Bob to compile formal request with supporting incident report.',
  '["Units #3, #9, #11 grounded immediately — unanimous", "Emergency procurement approved for hydraulic fittings", "WHMIS labelling corrective action assigned to committee", "Ergonomic assessment request to be formalized", "Anonymous near-miss reporting praised — culture improving"]',
  '["Complete hydraulic fitting replacements on all 4 units (Due: April 7)", "WHMIS-compliant labelling of all chemical containers (Due: April 15)", "Submit ergonomic assessment request for office trailer (Due: March 31)", "Restock bay 3 spill kit (Due: March 28)"]',
  '2026-04-04 13:00:00+00', 'completed',
  '2026-03-24 14:45:00+00', '2026-03-25 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

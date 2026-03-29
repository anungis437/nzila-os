-- =============================================================================
-- Health & Safety Seed Data
-- Covers: workplace_incidents, hazard_reports, safety_inspections,
--         safety_training_records, corrective_actions, safety_committee_meetings
-- Orgs:   CUPE Local 79 + CAPE
-- Idempotent: ON CONFLICT DO NOTHING
-- =============================================================================
BEGIN;

-- ─── 0. Add is_anonymous column if missing ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workplace_incidents' AND column_name = 'is_anonymous'
  ) THEN
    ALTER TABLE workplace_incidents ADD COLUMN is_anonymous boolean DEFAULT false;
  END IF;
END $$;

-- ─── 1. Workplace Incidents ────────────────────────────────────────────────
-- Org: CUPE Local 79
INSERT INTO workplace_incidents (
  id, organization_id, incident_number, incident_type, severity,
  incident_date, reported_date, location_description,
  workplace_name, department_name,
  description, what_happened, task_being_performed,
  witnesses_present, witness_names,
  reported_by_name, reported_by_job_title,
  is_anonymous, status, created_at, updated_at
) VALUES
(
  'b1a00001-0001-4000-8000-000000000001',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-INC-2026-001', 'injury', 'moderate',
  '2026-02-14 09:30:00+00', '2026-02-14 10:15:00+00',
  'Parks and Recreation Depot — Loading Bay 2',
  'City of Toronto — Parks Depot', 'Parks & Recreation',
  'Worker sustained a pulled back muscle while lifting heavy bags of salt from a delivery pallet without using the mechanical lift assist available nearby. The worker was performing the task alone despite the two-person requirement listed on the SOP.',
  'During morning salt delivery, the worker lifted 40kg bags manually instead of using the electric pallet jack. After the 6th bag, they felt a sharp pain in their lower back and could not continue.',
  'Unloading road salt from delivery truck',
  true, '["Maria Santos", "David Chen"]',
  'Jean-Pierre Bouchard', 'Seasonal Parks Maintenance Worker',
  false, 'investigating',
  '2026-02-14 10:15:00+00', '2026-02-15 08:00:00+00'
),
(
  'b1a00001-0002-4000-8000-000000000002',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-INC-2026-002', 'near_miss', 'near_miss',
  '2026-03-01 14:20:00+00', '2026-03-01 14:45:00+00',
  'Community Centre — Gymnasium Storage Room',
  'Scarborough Civic Centre', 'Recreation',
  'Unsecured shelving unit nearly toppled when a worker opened the storage room door. The unit was overloaded with gymnastics mats stacked higher than the top shelf. No injuries occurred but the area was barricaded immediately.',
  'Worker opened storage room door and felt the shelving unit lean forward. They jumped back in time. Several mats fell from the top shelf.',
  'Retrieving equipment for after-school program',
  false, null,
  null, null,
  true, 'reported',
  '2026-03-01 14:45:00+00', '2026-03-01 14:45:00+00'
),
(
  'b1a00001-0003-4000-8000-000000000003',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-INC-2026-003', 'exposure', 'serious',
  '2026-03-10 11:00:00+00', '2026-03-10 11:30:00+00',
  'Water Treatment Plant — Chemical Storage Area',
  'Ashbridges Bay Treatment Plant', 'Water Treatment',
  'Chlorine gas leak from a faulty valve detected by a worker entering the chemical storage area. The worker experienced throat irritation and was evacuated. The area was sealed and the hazmat team was dispatched. The valve gasket had degraded beyond its replacement schedule.',
  'Worker entered chemical storage for routine inventory check and noticed strong chlorine smell. They activated the emergency alarm and evacuated the floor. Three workers were assessed by paramedics on-site.',
  'Routine chemical inventory check',
  true, '["Frank Okafor", "Sophie Laurent", "Ahmed Hassan"]',
  'Frank Okafor', 'Water Treatment Operator',
  false, 'investigating',
  '2026-03-10 11:30:00+00', '2026-03-12 09:00:00+00'
),
(
  'b1a00001-0004-4000-8000-000000000004',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-INC-2026-004', 'fall', 'minor',
  '2026-03-18 08:15:00+00', '2026-03-18 09:00:00+00',
  'City Hall — North Stairwell B',
  'Toronto City Hall', 'Facilities',
  'Custodial worker slipped on wet floor in stairwell that had been mopped but lacked a wet floor sign. Worker caught themselves on the handrail and sustained a bruised knee. No lost time.',
  'The stairwell had been mopped 10 minutes prior but the wet floor sign was missing from the supply closet. The worker was descending from the 3rd floor when they slipped on the 2nd floor landing.',
  'Moving between floors for cleaning duties',
  false, null,
  'Priya Sharma', 'Custodial Worker',
  false, 'closed',
  '2026-03-18 09:00:00+00', '2026-03-20 16:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- Org: CAPE
INSERT INTO workplace_incidents (
  id, organization_id, incident_number, incident_type, severity,
  incident_date, reported_date, location_description,
  workplace_name, department_name,
  description, what_happened, task_being_performed,
  witnesses_present,
  reported_by_name, reported_by_job_title,
  is_anonymous, status, created_at, updated_at
) VALUES
(
  'b1a00001-0005-4000-8000-000000000005',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-INC-2026-003', 'ergonomic', 'minor',
  '2026-03-05 13:00:00+00', '2026-03-05 16:30:00+00',
  'Place du Portage Phase III — 4th Floor Open Office',
  'ESDC — Service Canada', 'Policy Analysis',
  'Employee reported persistent wrist pain from prolonged keyboard use on a non-ergonomic workstation. The employee had requested an ergonomic assessment three months prior but it was not completed. WSIB precautionary form filed.',
  'Employee had been working at a temporary desk for 3 months after office renovation displaced their ergonomic setup. Their original sit-stand desk and split keyboard were moved to storage and never reinstalled.',
  'Data entry and policy document drafting',
  false,
  null, null,
  true, 'reported',
  '2026-03-05 16:30:00+00', '2026-03-05 16:30:00+00'
),
(
  'b1a00001-0006-4000-8000-000000000006',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-INC-2026-004', 'other', 'moderate',
  '2026-03-22 10:30:00+00', '2026-03-22 11:00:00+00',
  'Immigration, Refugees and Citizenship Canada — Interview Room 3',
  'IRCC — Case Processing Centre', 'Client Services',
  'Employee was verbally threatened by an applicant during an interview for a refugee claim. The applicant became agitated and threw paperwork across the table. The worker pressed the duress button and security responded within 90 seconds. Worker was shaken but not physically harmed.',
  'During a scheduled interview, the applicant became increasingly hostile when informed of additional documentation requirements. The applicant stood up, threw papers, and made verbal threats before security intervened.',
  'Conducting refugee claimant interview',
  true,
  'Sandra Williams', 'Case Processing Officer',
  false, 'investigating',
  '2026-03-22 11:00:00+00', '2026-03-23 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Hazard Reports ────────────────────────────────────────────────────
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
  'b2a00001-0001-4000-8000-000000000001',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-HAZ-2026-001', 'ergonomic', 'moderate',
  '2026-02-20 09:00:00+00', '2026-02-18 00:00:00+00',
  'City of Toronto — Parks Depot', 'Parks & Recreation',
  'Salt storage shed — entrance ramp',
  null, true,
  'The entrance ramp to the salt storage shed is cracked and uneven, creating a trip hazard when pushing loaded carts. The surface also becomes very slippery when wet or icy. Multiple workers have stumbled but no one has fallen yet.',
  'All parks maintenance workers who access the salt shed (approx. 15 people)',
  'Trips, falls, potential back injuries from falling with loaded carts',
  'Rubber mats placed on ramp (worn out and curling at edges)',
  'Resurface the ramp with textured concrete. Install handrails on both sides.',
  4, 3, 12,
  'assessed', '2026-02-20 09:00:00+00', '2026-02-22 14:00:00+00'
),
(
  'b2a00001-0002-4000-8000-000000000002',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-HAZ-2026-002', 'chemical', 'high',
  '2026-03-12 10:00:00+00', '2026-03-10 00:00:00+00',
  'Ashbridges Bay Treatment Plant', 'Water Treatment',
  'Chemical storage room — valve bank section',
  'Frank Okafor', false,
  'Following the chlorine gas leak incident (L79-INC-2026-003), inspection revealed that 4 of 12 valve gaskets in the storage area are past their replacement date. The valve replacement schedule has not been followed since budget cuts last year.',
  'All water treatment operators and maintenance staff (approx. 25 people)',
  'Chlorine gas exposure — respiratory damage, potential fatality in confined space',
  'Emergency ventilation system, gas detectors at entrance. However, gaskets are the primary containment.',
  'Replace all overdue gaskets immediately. Reinstate the quarterly gasket replacement schedule. Add gasket age to daily visual inspection checklist.',
  5, 5, 25,
  'assigned', '2026-03-12 10:00:00+00', '2026-03-13 09:00:00+00'
),
(
  'b2a00001-0003-4000-8000-000000000003',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-HAZ-2026-001', 'psychosocial', 'moderate',
  '2026-03-15 14:00:00+00', '2026-03-01 00:00:00+00',
  'IRCC — Case Processing Centre', 'Client Services',
  'First floor interview rooms and waiting area',
  null, true,
  'Interview rooms used for refugee claimant processing lack adequate security features. The duress button is under the desk and hard to reach discreetly. There is no barrier between the officer and the client. The exit door opens inward, blocking quick egress. Following a recent threat incident, staff feel unsafe.',
  'All case processing officers who conduct in-person interviews (approx. 40 staff)',
  'Workplace violence, physical assault, psychological harm',
  'Duress buttons in each room, security guard at building entrance (not on floor)',
  'Install transparent barriers in interview rooms. Relocate duress buttons to be within discreet reach. Change doors to open outward. Station security on the interview floor during operating hours.',
  4, 4, 16,
  'reported', '2026-03-15 14:00:00+00', '2026-03-15 14:00:00+00'
),
(
  'b2a00001-0004-4000-8000-000000000004',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-HAZ-2026-003', 'fire', 'critical',
  '2026-03-25 08:00:00+00', '2026-03-24 00:00:00+00',
  'Scarborough Civic Centre', 'Facilities',
  'Basement electrical panel room',
  'Priya Sharma', false,
  'Burn marks observed on the main electrical panel cover. Burning smell reported intermittently over the past week. The panel is from 1985 and past its lifecycle. Emergency lighting in the adjacent corridor is also non-functional.',
  'All building occupants and custodial staff working in the basement area',
  'Electrical fire, smoke inhalation, building evacuation',
  'Fire extinguisher in hallway, smoke detectors in panel room',
  'Emergency electrical inspection by a licensed electrician. Replace the panel if recommended. Fix emergency lighting immediately.',
  4, 5, 20,
  'assigned', '2026-03-25 08:00:00+00', '2026-03-26 10:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Safety Inspections ────────────────────────────────────────────────
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
  'b3a00001-0001-4000-8000-000000000001',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-INSP-2026-001', 'routine', 'completed',
  '2026-02-15 09:00:00+00', '2026-02-15 09:15:00+00', '2026-02-15 12:30:00+00',
  'City of Toronto — Parks Depot', '["Loading bay", "Salt storage", "Vehicle garage", "Break room", "First aid station"]',
  'Parks and Recreation Depot — All Areas',
  'Steward Michelle Cooper', '["Michelle Cooper", "David Chen"]',
  'Quarterly routine inspection of depot facilities per JHSC schedule',
  45, 38, 3, 4, 2, 0,
  'Satisfactory', 84,
  'Loading bay lighting adequate. Salt storage ramp deteriorated (see HAZ-2026-001). Fire extinguisher in garage due for annual servicing. First aid kit complete and stocked. Break room microwave has exposed wiring — removed from service. Vehicle pre-trip checklists being completed consistently.',
  'Resurface salt storage ramp. Schedule fire extinguisher servicing. Replace break room microwave. Add anti-fatigue mats to loading bay.',
  true, '2026-03-15 09:00:00+00',
  '2026-02-15 12:30:00+00', '2026-02-16 08:00:00+00'
),
(
  'b3a00001-0002-4000-8000-000000000002',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-INSP-2026-002', 'post_incident', 'requires_followup',
  '2026-03-11 08:00:00+00', '2026-03-11 08:30:00+00', '2026-03-11 16:00:00+00',
  'Ashbridges Bay Treatment Plant', '["Chemical storage", "Valve bank", "Emergency systems", "PPE stations", "Ventilation"]',
  'Water Treatment — Chemical Storage Area',
  'Chief Steward Karen White', '["Karen White", "Frank Okafor", "External: SafetyFirst Consulting"]',
  'Post-incident inspection following chlorine gas leak (L79-INC-2026-003). Focus on chemical containment, emergency response systems, and PPE adequacy.',
  32, 20, 8, 4, 3, 2,
  'Unsatisfactory', 62,
  'Critical: 4 of 12 valve gaskets past replacement date. Critical: Emergency shower station water supply was shut off (discovered during test). Gas detection system functional but calibration overdue by 6 weeks. Ventilation backup system operational. PPE inventory adequate but 2 SCBA units need hydrostatic testing. SDS binder present but 3 sheets outdated.',
  'IMMEDIATE: Replace all overdue valve gaskets. IMMEDIATE: Restore emergency shower water supply. Within 7 days: Calibrate gas detectors. Within 30 days: Service SCBA units. Update SDS binder.',
  true, '2026-03-18 08:00:00+00',
  '2026-03-11 16:00:00+00', '2026-03-12 10:00:00+00'
),
(
  'b3a00001-0003-4000-8000-000000000003',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-INSP-2026-001', 'joint_committee', 'completed',
  '2026-03-01 10:00:00+00', '2026-03-01 10:15:00+00', '2026-03-01 14:00:00+00',
  'Place du Portage Phase III', '["Open office 4th floor", "Interview rooms", "Kitchen", "Server room", "Emergency exits"]',
  'Place du Portage Phase III — All Floors',
  'H&S Rep Kathryn Tremblay', '["Kathryn Tremblay", "Management Rep: Lisa Park"]',
  'Semi-annual JHSC workplace inspection per Canada Labour Code Part II',
  50, 42, 4, 4, 2, 0,
  'Satisfactory', 84,
  'Office ergonomics: 6 workstations missing ergonomic assessments post-renovation. Interview rooms: Security concerns flagged (see HAZ-CAPE-2026-001). Kitchen: adequate. Server room: temperature within range. Emergency exits clear but 2 exit signs have burnt-out bulbs. First aid kits on floors 2 and 5 need restocking.',
  'Complete pending ergonomic assessments within 30 days. Address interview room security. Replace exit sign bulbs. Restock first aid kits.',
  true, '2026-04-01 10:00:00+00',
  '2026-03-01 14:00:00+00', '2026-03-02 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Corrective Actions ────────────────────────────────────────────────
INSERT INTO corrective_actions (
  id, organization_id, action_number, source_type, source_reference,
  priority, status, title, description,
  assigned_to_name, assigned_date, due_date,
  progress_percentage,
  created_at, updated_at
) VALUES
(
  'b4a00001-0001-4000-8000-000000000001',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-CA-2026-001', 'inspection', 'L79-INSP-2026-002',
  'immediate', 'in_progress', 'Replace overdue valve gaskets in chemical storage',
  'Replace all 4 overdue valve gaskets in the chemical storage valve bank. Source CSA-approved gaskets matching valve specifications. Requires facility shutdown of affected valve line during replacement.',
  'Maintenance Supervisor James Wilson', '2026-03-12 09:00:00+00', '2026-03-19',
  60,
  '2026-03-12 09:00:00+00', '2026-03-15 14:00:00+00'
),
(
  'b4a00001-0002-4000-8000-000000000002',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-CA-2026-002', 'inspection', 'L79-INSP-2026-002',
  'immediate', 'verified', 'Restore emergency shower water supply',
  'Emergency shower station in chemical storage area was found with water supply shut off during post-incident inspection. Restore water supply and verify flow rate meets ANSI Z358.1 standard (76 L/min for 15 minutes).',
  'Facilities Manager Robert Kim', '2026-03-11 17:00:00+00', '2026-03-12',
  100,
  '2026-03-11 17:00:00+00', '2026-03-12 10:00:00+00'
),
(
  'b4a00001-0003-4000-8000-000000000003',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-CA-2026-003', 'hazard', 'L79-HAZ-2026-003',
  'urgent', 'assigned', 'Emergency electrical panel inspection — Scarborough Civic Centre',
  'Burn marks and burning smell reported on 1985-era main electrical panel in basement. Schedule emergency inspection by a licensed electrician. If panel is compromised, plan replacement.',
  'Building Operations Lead', '2026-03-26 10:00:00+00', '2026-03-31',
  0,
  '2026-03-26 10:00:00+00', '2026-03-26 10:00:00+00'
),
(
  'b4a00001-0004-4000-8000-000000000004',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-CA-2026-001', 'hazard', 'CAPE-HAZ-2026-001',
  'high', 'open', 'Interview room security improvements — IRCC',
  'Install transparent barriers, relocate duress buttons to within discreet reach, change interview room doors to open outward, station security on interview floor during operating hours. Follow up on recent workplace violence incident (CAPE-INC-2026-004).',
  'IRCC Facilities Security Manager', '2026-03-16 09:00:00+00', '2026-04-30',
  0,
  '2026-03-16 09:00:00+00', '2026-03-16 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Safety Training Records ──────────────────────────────────────────
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
  'b5a00001-0001-4000-8000-000000000001',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-TR-2026-001', 'WHMIS 2015 Refresher', 'whmis',
  'Frank Okafor', 'Water Treatment Operator', 'Water Treatment',
  '2026-01-15', '2026-01-15', '2027-01-15',
  'completed', 'in_person', 3,
  true, 92, 70, true,
  true, 'WHMIS-L79-2026-001',
  true, true,
  '2026-01-15 12:00:00+00', '2026-01-15 12:00:00+00'
),
(
  'b5a00001-0002-4000-8000-000000000002',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-TR-2026-002', 'Confined Space Entry & Rescue', 'confined_space',
  'Frank Okafor', 'Water Treatment Operator', 'Water Treatment',
  '2026-02-01', '2026-02-02', '2029-02-02',
  'completed', 'in_person', 16,
  true, 88, 75, true,
  true, 'CSE-L79-2026-001',
  true, true,
  '2026-02-02 16:00:00+00', '2026-02-02 16:00:00+00'
),
(
  'b5a00001-0003-4000-8000-000000000003',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-TR-2026-003', 'Working at Heights', 'working_at_heights',
  'Jean-Pierre Bouchard', 'Seasonal Parks Maintenance Worker', 'Parks & Recreation',
  '2026-03-20', null, null,
  'scheduled', 'in_person', 8,
  true, null, 75, null,
  false, null,
  true, true,
  '2026-03-15 10:00:00+00', '2026-03-15 10:00:00+00'
),
(
  'b5a00001-0004-4000-8000-000000000004',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-TR-2026-001', 'Workplace Violence Prevention', 'workplace_violence',
  'Sandra Williams', 'Case Processing Officer', 'Client Services',
  '2026-03-25', '2026-03-25', '2028-03-25',
  'completed', 'in_person', 3,
  true, 95, 70, true,
  true, 'WVP-CAPE-2026-001',
  true, true,
  '2026-03-25 16:00:00+00', '2026-03-25 16:00:00+00'
),
(
  'b5a00001-0005-4000-8000-000000000005',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-TR-2026-002', 'Ergonomic Workstation Assessment — Self-Led', 'ergonomics',
  'Kathryn Tremblay', 'H&S Representative', 'Policy Analysis',
  '2026-01-10', '2026-01-10', '2027-01-10',
  'completed', 'online', 1.5,
  false, null, null, null,
  false, null,
  false, false,
  '2026-01-10 11:30:00+00', '2026-01-10 11:30:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 6. Safety Committee Meetings ────────────────────────────────────────
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
  'b6a00001-0001-4000-8000-000000000001',
  'a1b2c3d4-1111-4000-8000-000000000079',
  'L79-JHSC-2026-03', 'regular', '2026-03-14 13:00:00+00',
  '2026-03-14T13:00:00', '2026-03-14T14:30:00', 90,
  'Parks Depot — Meeting Room', 'CUPE Local 79 JHSC — Parks Division',
  'Chief Steward Karen White', 'Michelle Cooper',
  '["Karen White", "Michelle Cooper", "David Chen", "Mgmt Rep: Tom Fraser", "Mgmt Rep: Diane Xu"]',
  '["Karen White", "Michelle Cooper", "David Chen", "Tom Fraser", "Diane Xu"]',
  5, true,
  'Review of Feb inspection findings. Chlorine leak incident debrief. Salt shed ramp hazard report status. Training schedule Q2. New business.',
  'Detailed discussion of chlorine leak at Ashbridges Bay. Karen emphasized that overdue maintenance was a direct cause and requested management commit to funding the replacement schedule. Management agreed to expedite gasket replacements. Salt shed ramp resurfacing approved for April. Q2 training schedule reviewed — all water treatment staff to complete WHMIS refresher by June.',
  '["Gasket replacements approved as immediate priority", "Salt shed ramp resurfacing budgeted for April", "Anonymous incident near-miss at gym storage — shelving securements to be audited", "Next inspection: Scarborough Civic Centre electrical panel"]',
  '["Audit all shelving units in recreation storage rooms (Due: March 28)", "Obtain quotes for salt shed ramp resurfacing (Due: March 21)", "Schedule electrical panel inspection at Scarborough (Due: March 31)"]',
  '2026-04-11 13:00:00+00', 'completed',
  '2026-03-14 14:30:00+00', '2026-03-15 10:00:00+00'
),
(
  'b6a00001-0002-4000-8000-000000000002',
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-JHSC-2026-Q1', 'regular', '2026-03-20 10:00:00+00',
  '2026-03-20T10:00:00', '2026-03-20T11:30:00', 90,
  'Virtual — MS Teams', 'CAPE National H&S Committee',
  'H&S Rep Kathryn Tremblay', 'Policy Analyst Marc Dubois',
  '["Kathryn Tremblay", "Marc Dubois", "Sandra Williams", "Mgmt Rep: Lisa Park", "Mgmt Rep: Derek Chang"]',
  '["Kathryn Tremblay", "Marc Dubois", "Sandra Williams", "Lisa Park", "Derek Chang"]',
  5, true,
  'Q1 inspection results review. IRCC interview room security concerns. Ergonomic assessment backlog. Workplace violence incident debrief. Mental health resources update.',
  'March 1 inspection results presented — overall satisfactory but ergonomic backlog and interview room security flagged as priorities. Sandra described the March 22 threat incident in detail. Committee unanimously recommended immediate security improvements to interview rooms. Management committed to fast-tracking barrier installation. Ergonomic assessments for 6 displaced workstations to be completed by end of April.',
  '["Interview room security improvements prioritized — barriers, duress button relocation, door direction change", "Ergonomic assessment backlog to be cleared by April 30", "Workplace violence prevention training mandatory for all client-facing staff", "Mental health support: EAP usage up 15% — additional resources requested"]',
  '["Fast-track interview room barrier installation (Due: April 15)", "Complete 6 pending ergonomic assessments (Due: April 30)", "Schedule workplace violence prevention training for all CPC staff (Due: April 15)"]',
  '2026-06-19 10:00:00+00', 'completed',
  '2026-03-20 11:30:00+00', '2026-03-21 09:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;

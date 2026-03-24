-- Seed: Pilot enrollments and milestones for the 3 pilot orgs + NZILA Ventures
-- Idempotent: uses ON CONFLICT DO NOTHING

-- NZILA Ventures (internal)
INSERT INTO pilot_enrollments (organization_id, pilot_id, status, enrolled_at, organizer_adoption_rate, member_engagement_rate, cases_managed, avg_time_to_resolution, health_score, last_calculated_at)
VALUES ('458a56cb-251a-4c91-a0b5-81bb8ac39087', 'PILOT-2026-001', 'active', NOW() - INTERVAL '45 days', 72.5, 58.3, 12, 18.5, 74.0, NOW())
ON CONFLICT (organization_id) DO NOTHING;

-- CUPE
INSERT INTO pilot_enrollments (organization_id, pilot_id, status, enrolled_at, organizer_adoption_rate, member_engagement_rate, cases_managed, avg_time_to_resolution, health_score, last_calculated_at)
VALUES ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'PILOT-2026-002', 'active', NOW() - INTERVAL '38 days', 65.0, 42.7, 8, 24.2, 62.0, NOW())
ON CONFLICT (organization_id) DO NOTHING;

-- CAPE (local UUID — staging uses 885aa4e0-5dc1-45bf-ad32-86477868e8ea)
INSERT INTO pilot_enrollments (organization_id, pilot_id, status, enrolled_at, organizer_adoption_rate, member_engagement_rate, cases_managed, avg_time_to_resolution, health_score, last_calculated_at)
VALUES ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'PILOT-2026-003', 'active', NOW() - INTERVAL '30 days', 80.0, 55.1, 15, 12.8, 78.0, NOW())
ON CONFLICT (organization_id) DO NOTHING;

-- CLC (local UUID — staging uses 5ecb17ab-b5de-442e-a46f-93778ee496aa)
INSERT INTO pilot_enrollments (organization_id, pilot_id, status, enrolled_at, organizer_adoption_rate, member_engagement_rate, cases_managed, avg_time_to_resolution, health_score, last_calculated_at)
VALUES ('873cf59b-cef5-4d51-9a62-151512810449', 'PILOT-2026-004', 'active', NOW() - INTERVAL '25 days', 45.0, 38.5, 5, 30.0, 55.0, NOW())
ON CONFLICT (organization_id) DO NOTHING;

-- Milestones (5 per org)
-- NZILA Ventures
INSERT INTO pilot_milestones (organization_id, name, description, status, target_date, completed_at) VALUES
  ('458a56cb-251a-4c91-a0b5-81bb8ac39087', 'Platform Onboarding', 'Complete initial platform setup and user onboarding', 'completed', NOW() - INTERVAL '30 days', NOW() - INTERVAL '32 days'),
  ('458a56cb-251a-4c91-a0b5-81bb8ac39087', 'First Grievance Filed', 'File and process the first grievance through the system', 'completed', NOW() - INTERVAL '20 days', NOW() - INTERVAL '22 days'),
  ('458a56cb-251a-4c91-a0b5-81bb8ac39087', 'Organizer Training', 'Complete training for all organizers on platform usage', 'in_progress', NOW() + INTERVAL '15 days', NULL),
  ('458a56cb-251a-4c91-a0b5-81bb8ac39087', 'Full Member Rollout', 'Roll out platform access to all union members', 'pending', NOW() + INTERVAL '45 days', NULL),
  ('458a56cb-251a-4c91-a0b5-81bb8ac39087', 'Pilot Review', 'Conduct 90-day pilot review with stakeholders', 'pending', NOW() + INTERVAL '45 days', NULL);

-- CUPE
INSERT INTO pilot_milestones (organization_id, name, description, status, target_date, completed_at) VALUES
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Platform Onboarding', 'Complete initial platform setup and user onboarding', 'completed', NOW() - INTERVAL '25 days', NOW() - INTERVAL '27 days'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'First Grievance Filed', 'File and process the first grievance through the system', 'completed', NOW() - INTERVAL '15 days', NOW() - INTERVAL '16 days'),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Organizer Training', 'Complete training for all organizers on platform usage', 'in_progress', NOW() + INTERVAL '20 days', NULL),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Full Member Rollout', 'Roll out platform access to all union members', 'pending', NOW() + INTERVAL '50 days', NULL),
  ('9210418f-6a4f-4dab-a7d2-4450d581dc81', 'Pilot Review', 'Conduct 90-day pilot review with stakeholders', 'pending', NOW() + INTERVAL '52 days', NULL);

-- CAPE
INSERT INTO pilot_milestones (organization_id, name, description, status, target_date, completed_at) VALUES
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Platform Onboarding', 'Complete initial platform setup and user onboarding', 'completed', NOW() - INTERVAL '20 days', NOW() - INTERVAL '21 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'First Grievance Filed', 'File and process the first grievance through the system', 'completed', NOW() - INTERVAL '10 days', NOW() - INTERVAL '11 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Organizer Training', 'Complete training for all organizers on platform usage', 'completed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Full Member Rollout', 'Roll out platform access to all union members', 'in_progress', NOW() + INTERVAL '30 days', NULL),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Pilot Review', 'Conduct 90-day pilot review with stakeholders', 'pending', NOW() + INTERVAL '60 days', NULL);

-- CLC
INSERT INTO pilot_milestones (organization_id, name, description, status, target_date, completed_at) VALUES
  ('873cf59b-cef5-4d51-9a62-151512810449', 'Platform Onboarding', 'Complete initial platform setup and user onboarding', 'completed', NOW() - INTERVAL '15 days', NOW() - INTERVAL '17 days'),
  ('873cf59b-cef5-4d51-9a62-151512810449', 'First Grievance Filed', 'File and process the first grievance through the system', 'in_progress', NOW() + INTERVAL '5 days', NULL),
  ('873cf59b-cef5-4d51-9a62-151512810449', 'Organizer Training', 'Complete training for all organizers on platform usage', 'pending', NOW() + INTERVAL '30 days', NULL),
  ('873cf59b-cef5-4d51-9a62-151512810449', 'Full Member Rollout', 'Roll out platform access to all union members', 'pending', NOW() + INTERVAL '60 days', NULL),
  ('873cf59b-cef5-4d51-9a62-151512810449', 'Pilot Review', 'Conduct 90-day pilot review with stakeholders', 'pending', NOW() + INTERVAL '65 days', NULL);

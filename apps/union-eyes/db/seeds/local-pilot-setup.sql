-- Seed pilot enrollment and milestones for local development
-- Run after 0025_pilot_enrollments.sql migration

-- Seed pilot enrollment for CAPE
INSERT INTO pilot_enrollments (
  organization_id, pilot_id, status, enrolled_at, enrolled_by,
  organizer_adoption_rate, member_engagement_rate,
  cases_managed, avg_time_to_resolution, health_score
) VALUES (
  'c09173ad-5ba4-498e-a483-b371fb5e248e',
  'CAPE-CLC-2026',
  'active',
  NOW() - INTERVAL '45 days',
  'user_35NlrrNcfTv0DMh2kzBHyXZRtpb',
  72.5, 38.2, 23, 168, 71
) ON CONFLICT (organization_id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

-- Seed milestones for CAPE pilot
INSERT INTO pilot_milestones (organization_id, name, description, status, target_date, completed_at) VALUES
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Platform Onboarding',
   'Complete initial platform setup and user provisioning',
   'complete', NOW() - INTERVAL '40 days', NOW() - INTERVAL '42 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Data Migration',
   'Import existing member records and employer data',
   'complete', NOW() - INTERVAL '30 days', NOW() - INTERVAL '33 days'),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Organizer Training',
   'Train all stewards and organizers on grievance workflows',
   'in-progress', NOW() + INTERVAL '15 days', NULL),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'First Grievance Cycle',
   'Process at least 10 grievances end-to-end through the system',
   'in-progress', NOW() + INTERVAL '30 days', NULL),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Member Portal Launch',
   'Enable self-service portal for all members',
   'pending', NOW() + INTERVAL '60 days', NULL),
  ('c09173ad-5ba4-498e-a483-b371fb5e248e', 'Go-Live Decision',
   'Executive review and decision to proceed to full deployment',
   'pending', NOW() + INTERVAL '90 days', NULL)
ON CONFLICT DO NOTHING;

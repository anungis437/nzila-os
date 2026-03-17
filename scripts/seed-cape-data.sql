-- Seed comprehensive CAPE data for staging DB
-- CAPE org: 885aa4e0-5dc1-45bf-ad32-86477868e8ea

-- =============================================
-- AI Insight Reports (currently 0 rows)
-- =============================================
INSERT INTO ai_insight_reports (id, organization_id, report_type, timeframe, title, summary, insights_json, predictions_json, recommendations_json, confidence, explanation, data_sources_used, model_version, generated_at, valid_until, created_at) VALUES
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'grievance_trends', '30d', 'CAPE Grievance Trends Analysis',
 'Analysis of grievance patterns over the past 30 days shows a moderate increase in workplace safety complaints.',
 '[{"insight":"Safety-related grievances increased 15% month-over-month","severity":"medium"},{"insight":"Average resolution time improved by 2 days","severity":"positive"},{"insight":"3 repeat grievances identified from same department","severity":"high"}]'::jsonb,
 '[{"prediction":"Expected 8-12 new grievances next month","confidence":0.78},{"prediction":"Resolution backlog may grow if current steward capacity unchanged","confidence":0.65}]'::jsonb,
 '[{"action":"Assign additional steward to Logistics department","priority":"high"},{"action":"Schedule safety training refresher for Q2","priority":"medium"},{"action":"Review PPE compliance in warehouse section","priority":"medium"}]'::jsonb,
 0.82, 'Analysis based on 5 active grievances and historical resolution data.',
 '["grievances","claims","organization_members"]'::jsonb, 'nzila-ai-v2.1', NOW() - interval '2 days', NOW() + interval '28 days', NOW() - interval '2 days'),

(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'safety_compliance', '90d', 'Safety Compliance Overview Q1',
 'Quarterly safety compliance assessment shows overall improvement with some areas requiring attention.',
 '[{"insight":"Inspection completion rate at 92%","severity":"positive"},{"insight":"2 PPE items below reorder threshold","severity":"medium"},{"insight":"Zero critical incidents this quarter","severity":"positive"}]'::jsonb,
 '[{"prediction":"Compliance rate expected to reach 95% by end of Q2","confidence":0.71}]'::jsonb,
 '[{"action":"Restock PPE inventory for hardhats and safety vests","priority":"high"},{"action":"Complete outstanding safety inspection for Building C","priority":"medium"}]'::jsonb,
 0.88, 'Comprehensive safety analysis across all CAPE facilities.',
 '["safety_inspections","workplace_incidents","ppe_equipment","safety_training_records"]'::jsonb, 'nzila-ai-v2.1', NOW() - interval '5 days', NOW() + interval '85 days', NOW() - interval '5 days'),

(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'member_engagement', '30d', 'Member Engagement Insights',
 'Member participation metrics show healthy engagement across CAPE union activities.',
 '[{"insight":"22 active members with 3 designated stewards","severity":"positive"},{"insight":"Meeting attendance at 78%","severity":"medium"},{"insight":"New member onboarding completed for 4 members this month","severity":"positive"}]'::jsonb,
 null,
 '[{"action":"Schedule steward training for upcoming contract negotiations","priority":"medium"},{"action":"Send engagement survey to inactive members","priority":"low"}]'::jsonb,
 0.75, 'Based on organization membership and activity logs.',
 '["organization_members","audit_logs"]'::jsonb, 'nzila-ai-v2.1', NOW() - interval '1 day', NOW() + interval '29 days', NOW() - interval '1 day')
ON CONFLICT DO NOTHING;

-- =============================================
-- Additional Analytics Metrics (currently 1 row)
-- =============================================
INSERT INTO analytics_metrics (id, organization_id, metric_type, metric_name, metric_value, metric_unit, period_start, period_end, created_at, updated_at) VALUES
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'safety', 'workplace_incidents_count', 3, 'count', NOW() - interval '30 days', NOW(), NOW(), NOW()),
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'safety', 'hazard_reports_open', 2, 'count', NOW() - interval '30 days', NOW(), NOW(), NOW()),
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'membership', 'active_members', 22, 'count', NOW() - interval '30 days', NOW(), NOW(), NOW()),
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'grievance', 'total_grievances', 5, 'count', NOW() - interval '30 days', NOW(), NOW(), NOW()),
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'claims', 'total_claims', 5, 'count', NOW() - interval '30 days', NOW(), NOW(), NOW()),
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'compliance', 'inspection_compliance_rate', 92, 'percent', NOW() - interval '30 days', NOW(), NOW(), NOW()),
(gen_random_uuid(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'training', 'training_completion', 85, 'percent', NOW() - interval '30 days', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- =============================================
-- Additional Audit Logs (currently 1 row)
-- =============================================
INSERT INTO audit_logs (id, audit_id, user_id, organization_id, action, resource_type, resource_id, details, created_at, updated_at) VALUES
(gen_random_uuid(), gen_random_uuid(), 'persona_steward_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'grievance.filed', 'grievance', 'b7133e06-6709-4bdd-9eb4-3e5183845629', '{"description":"New grievance filed for workplace safety concern"}', NOW() - interval '10 days', NOW() - interval '10 days'),
(gen_random_uuid(), gen_random_uuid(), 'persona_cs_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'claim.created', 'claim', 'a22ab1a8-24cf-4430-b1b9-12622ad3cbbd', '{"description":"Workers compensation claim submitted"}', NOW() - interval '8 days', NOW() - interval '8 days'),
(gen_random_uuid(), gen_random_uuid(), 'persona_officer_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'member.added', 'organization_member', null, '{"description":"New member added to CAPE"}', NOW() - interval '5 days', NOW() - interval '5 days'),
(gen_random_uuid(), gen_random_uuid(), 'persona_hsr_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'inspection.completed', 'safety_inspection', null, '{"description":"Monthly safety inspection completed for Building A"}', NOW() - interval '3 days', NOW() - interval '3 days'),
(gen_random_uuid(), gen_random_uuid(), 'persona_bc_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'meeting.scheduled', 'meeting', null, '{"description":"Bargaining committee meeting scheduled for next week"}', NOW() - interval '1 day', NOW() - interval '1 day'),
(gen_random_uuid(), gen_random_uuid(), 'persona_steward_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'hazard.reported', 'hazard_report', null, '{"description":"Chemical storage hazard reported in warehouse"}', NOW() - interval '12 hours', NOW() - interval '12 hours'),
(gen_random_uuid(), gen_random_uuid(), 'persona_officer_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'report.generated', 'report', null, '{"description":"Monthly H&S report generated"}', NOW() - interval '6 hours', NOW() - interval '6 hours')
ON CONFLICT DO NOTHING;

-- =============================================
-- Additional In-App Notifications (currently 3 rows)
-- =============================================
INSERT INTO in_app_notifications (id, user_id, organization_id, title, message, type, read, action_url, created_at, updated_at) VALUES
(gen_random_uuid(), 'persona_steward_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'New Grievance Assigned', 'A new workplace safety grievance has been assigned to you for review.', 'task', false, '/dashboard/grievances', NOW() - interval '2 days', NOW() - interval '2 days'),
(gen_random_uuid(), 'persona_cs_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Deadline Approaching', 'The mediation hearing deadline for case #CAPE-002 is in 5 days.', 'warning', false, '/dashboard/deadlines', NOW() - interval '1 day', NOW() - interval '1 day'),
(gen_random_uuid(), 'persona_hsr_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'Safety Inspection Due', 'Monthly safety inspection for Building C is due this week.', 'reminder', false, '/dashboard/health-safety', NOW() - interval '12 hours', NOW() - interval '12 hours'),
(gen_random_uuid(), 'persona_officer_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'New Member Registration', 'A new member application has been submitted and requires approval.', 'info', true, '/dashboard/members', NOW() - interval '3 days', NOW() - interval '3 days'),
(gen_random_uuid(), 'persona_bc_cape', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CBA Review Complete', 'The AI analysis of Section 12.3 has been completed.', 'success', true, '/dashboard/clauses', NOW() - interval '4 days', NOW() - interval '4 days')
ON CONFLICT DO NOTHING;

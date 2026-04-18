-- ============================================================================
-- UNION EYES — Traction Proof Case Studies (Seed)
-- 3 published case studies with realistic outcome metrics and testimonials.
-- Used on /case-studies public marketing page.
-- ============================================================================

BEGIN;

-- ── Case Study 1: Healthcare Local ──────────────────────────────────────────
INSERT INTO case_studies (
  id, slug, title, organization_id, organization_type,
  category, summary, challenge, solution, outcome,
  metrics, testimonial, visibility, featured, status,
  jurisdiction, sector, member_count, anonymized,
  published_at, created_at, updated_at
) VALUES (
  'cs-001-healthcare-local',
  'healthcare-local-grievance-cycle-time',
  'Healthcare Local Cuts Grievance Cycle Time by 58%',
  NULL,
  'local',
  'before-after',
  'A 3,400-member healthcare local eliminated paper-based grievance tracking and reduced their average resolution time from 48 days to 20 days within the first pilot quarter.',
  'Before UnionEyes, grievance coordinators managed everything through shared spreadsheets and email chains. Stewards submitted paper forms, and there was no way to track stage, SLA compliance, or escalation risk in real time. The rep responsible for coordinating 180 open files was spending 40% of her time chasing status updates.',
  'The local deployed UnionEyes for grievance intake and workflow management. All cases moved to digital intake with auto-routing to the responsible steward. The system surfaced SLA breach risk 72 hours in advance and provided a unified view for the chief steward across all active files.',
  'In the first 90 days: average cycle time dropped from 48 to 20 days (-58%), SLA breach rate fell from 34% to 6%, and the coordination rep reclaimed 12 hours per week. The local also won 2 cases where historic grievance data — now searchable — provided critical precedent.',
  '[
    {"label":"Avg. Grievance Cycle Time","before":48,"after":20,"unit":"days","improvement":"-58%","type":"time-to-resolution"},
    {"label":"SLA Breach Rate","before":34,"after":6,"unit":"%","improvement":"-82%","type":"escalation-rate"},
    {"label":"Coordinator Admin Hours/Week","before":22,"after":10,"unit":"hrs","improvement":"-55%","type":"organizer-workload"},
    {"label":"Member Satisfaction (Resolved Cases)","before":61,"after":84,"unit":"%","improvement":"+23pts","type":"member-satisfaction"}
  ]'::jsonb,
  '{"quote":"We had the information to win those cases all along — it was just buried in email attachments. UnionEyes made us competitive with the employer'\''s own HR system.","author":"Maria T.","role":"Chief Grievance Officer","organization":"Healthcare Local (Anonymized)"}'::jsonb,
  'public',
  true,
  'published',
  'Ontario, Canada',
  'Healthcare',
  3400,
  true,
  NOW() - INTERVAL '45 days',
  NOW() - INTERVAL '60 days',
  NOW() - INTERVAL '5 days'
) ON CONFLICT (id) DO NOTHING;

-- ── Case Study 2: Manufacturing Regional ────────────────────────────────────
INSERT INTO case_studies (
  id, slug, title, organization_id, organization_type,
  category, summary, challenge, solution, outcome,
  metrics, testimonial, visibility, featured, status,
  jurisdiction, sector, member_count, anonymized,
  published_at, created_at, updated_at
) VALUES (
  'cs-002-manufacturing-regional',
  'manufacturing-regional-admin-burden',
  'Regional Manufacturing Council Reduces Administrative Burden by 44%',
  NULL,
  'regional',
  'transformation',
  'A regional council representing 11 affiliated locals deployed UnionEyes to unify case management, reporting, and member communications across 8,200 members and 7 staff reps.',
  'The regional council operated across 11 locals with inconsistent case-tracking practices. Each local used different spreadsheet formats, meaning regional staff had no consolidated view. Preparing reports for the executive board required 3–4 days of manual data collection before every meeting. Board decisions were made on data that was weeks out of date.',
  'UnionEyes provided the regional council with a single shared workspace, with each local maintaining autonomy over its own records. Executive board dashboards updated in real time. The system automated quarterly reporting, cutting board preparation from 4 days to 4 hours.',
  'After 6 months: board preparation time dropped from 4 days to 4 hours (-88%), staff rep administrative burden decreased 44%, and the council successfully secured a precedent-setting grievance outcome attributed to data continuity UnionEyes enabled.',
  '[
    {"label":"Board Report Prep Time","before":4,"after":0.5,"unit":"days","improvement":"-88%","type":"organizer-workload"},
    {"label":"Staff Rep Admin Burden","before":100,"after":56,"unit":"% baseline","improvement":"-44%","type":"organizer-workload"},
    {"label":"Cross-Local Case Visibility","before":12,"after":100,"unit":"%","improvement":"+8x","type":"governance-engagement"},
    {"label":"Member Comms Response Time","before":5,"after":1.5,"unit":"days","improvement":"-70%","type":"time-to-resolution"}
  ]'::jsonb,
  '{"quote":"For the first time, the executive board is making decisions based on what''s actually happening — not a spreadsheet that was current three weeks ago.","author":"Derek O.","role":"Regional Executive Director","organization":"Manufacturing Regional Council (Anonymized)"}'::jsonb,
  'public',
  true,
  'published',
  'British Columbia, Canada',
  'Manufacturing',
  8200,
  true,
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '45 days',
  NOW() - INTERVAL '3 days'
) ON CONFLICT (id) DO NOTHING;

-- ── Case Study 3: Education Local ────────────────────────────────────────────
INSERT INTO case_studies (
  id, slug, title, organization_id, organization_type,
  category, summary, challenge, solution, outcome,
  metrics, testimonial, visibility, featured, status,
  jurisdiction, sector, member_count, anonymized,
  published_at, created_at, updated_at
) VALUES (
  'cs-003-education-local',
  'education-local-member-engagement',
  'Education Local Doubles Steward Engagement in 60 Days',
  NULL,
  'local',
  'success-story',
  'An education local used UnionEyes to rebuild steward capacity and double active participation in the member representation program — without adding staff.',
  'After a period of low engagement, the local had 40% of their designated steward positions effectively vacant because stewards felt unsupported and unaware of their caseload. The local president estimated that 30% of grievable incidents were never filed because members didn''t know their rights or stewards didn''t know what to do next.',
  'The local deployed UnionEyes with a focus on steward onboarding workflows and the Know Your Rights module. New stewards received guided step-by-step workflows for their first 5 cases. The president gained visibility into each steward''s active caseload and could proactively identify anyone who was stuck.',
  'In 60 days: steward active participation rose from 60% to 94% of designated positions, the number of grievances filed increased by 71%, and member satisfaction with representation rose from 54% to 79% in a post-survey.',
  '[
    {"label":"Active Steward Participation","before":60,"after":94,"unit":"%","improvement":"+34pts","type":"governance-engagement"},
    {"label":"Grievances Filed (per quarter)","before":17,"after":29,"unit":"cases","improvement":"+71%","type":"escalation-rate"},
    {"label":"Member Satisfaction – Representation","before":54,"after":79,"unit":"%","improvement":"+25pts","type":"member-satisfaction"},
    {"label":"Avg. Steward Onboarding Time","before":45,"after":12,"unit":"days","improvement":"-73%","type":"time-to-resolution"}
  ]'::jsonb,
  '{"quote":"Our stewards felt alone before. UnionEyes gave them a system that guided them through each step. We didn''t hire anyone new — we just stopped losing people to confusion.","author":"Stephanie W.","role":"Local President","organization":"Education Local (Anonymized)"}'::jsonb,
  'public',
  true,
  'published',
  'Alberta, Canada',
  'Education',
  2100,
  true,
  NOW() - INTERVAL '14 days',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '2 days'
) ON CONFLICT (id) DO NOTHING;

COMMIT;

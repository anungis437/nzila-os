-- 0027_seed_healthcare_unit_92.sql
-- Seed first target campaign: UNA Local 115 - Unit 92 Short Stay Cardiology

INSERT INTO healthcare_surveys (
  campaign_key,
  campaign_name,
  unit_name,
  site_name,
  local_name,
  champion_label,
  title,
  description,
  audience,
  status,
  anonymous,
  allow_free_text,
  purpose_statement,
  privacy_notice,
  internal_notes,
  distribution_message,
  template_key,
  created_by
)
VALUES (
  'una-local-115-unit-92',
  'UNA Local 115 - Unit 92 Short Stay Cardiology Discovery',
  'Unit 92, Short Stay Cardiology',
  'Foothills Medical Centre',
  'UNA Local 115',
  'Heather Haberli',
  'Unit 92 Scheduling Experience Survey',
  'Healthcare discovery survey for one unit-level scheduling campaign.',
  'Nurses and eligible unit members on Unit 92',
  'draft',
  true,
  true,
  'This short anonymous survey is intended to understand scheduling clarity, communication friction, schedule-change issues, open-shift transparency, shift-exchange confusion, and documentation gaps on Unit 92.',
  'This discovery survey is for workflow discovery only. Do not include patient information, employee names, manager names, grievance details, or identifying details.',
  'Initial discovery target confirmed after UNA conversation. Scope is intentionally small: one unit, anonymous survey, no real scheduling documents, no patient data, no employer integration. Goal is to identify one tiny workflow wedge for a future governed Nzila Healthcare / UnionEyes Healthcare pilot.',
  'Hi everyone,\n\nWe are doing a short anonymous survey to better understand scheduling experiences on Unit 92.\n\nThe goal is to learn where scheduling processes create confusion, friction, or documentation gaps - for example around schedule changes, open shifts, shift exchanges, communication, and follow-up when questions arise.\n\nThis is not a grievance form and not an employer audit. Please do not include patient names, employee names, manager names, or identifying details.\n\nThe survey should take about 5 minutes.\n\nThank you for sharing your perspective.',
  'unit-scheduling',
  'system:seed'
)
ON CONFLICT (campaign_key) DO NOTHING;

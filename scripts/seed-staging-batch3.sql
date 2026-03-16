-- Seed Staging Batch 3: Tables A-D
-- Orgs: CAPE=885aa4e0-5dc1-45bf-ad32-86477868e8ea, CLC=5ecb17ab-b5de-442e-a46f-93778ee496aa, NZILA=458a56cb-251a-4c91-a0b5-81bb8ac39087
BEGIN;

-- ============================================================
-- A/B Testing
-- ============================================================
INSERT INTO ab_tests (id, created_at, updated_at, organization_id) VALUES
  ('ab000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ab000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO ab_test_variants (id, created_at, updated_at, test_id) VALUES
  ('ab100001-0001-4000-a000-000000000001', now(), now(), 'ab000001-0001-4000-a000-000000000001'),
  ('ab100001-0001-4000-a000-000000000002', now(), now(), 'ab000001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO ab_test_assignments (id, created_at, updated_at, test_id) VALUES
  ('ab200001-0001-4000-a000-000000000001', now(), now(), 'ab000001-0001-4000-a000-000000000001'),
  ('ab200001-0001-4000-a000-000000000002', now(), now(), 'ab000001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO ab_test_events (id, created_at, updated_at, test_id) VALUES
  ('ab300001-0001-4000-a000-000000000001', now(), now(), 'ab000001-0001-4000-a000-000000000001'),
  ('ab300001-0001-4000-a000-000000000002', now(), now(), 'ab000001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Access & RBAC
-- ============================================================
INSERT INTO access_justification_requests (id, created_at, updated_at, user_id) VALUES
  ('ac100001-0001-4000-a000-000000000001', now(), now(), 'c66bf357-4282-46f1-a237-2b5085448803'),
  ('ac100001-0001-4000-a000-000000000002', now(), now(), '5707857c-48d8-4023-9744-0140e362bd6a')
ON CONFLICT DO NOTHING;

INSERT INTO accessibility_audits (id, created_at, updated_at, organization_id) VALUES
  ('ac200001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ac200001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO accessibility_configs (id, created_at, updated_at, organization_id) VALUES
  ('ac300001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ac300001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO accessibility_issues (id, created_at, updated_at, audit_id) VALUES
  ('ac400001-0001-4000-a000-000000000001', now(), now(), 'ac200001-0001-4000-a000-000000000001'),
  ('ac400001-0001-4000-a000-000000000002', now(), now(), 'ac200001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO accessibility_preferences (id, created_at, updated_at, user_id) VALUES
  ('ac500001-0001-4000-a000-000000000001', now(), now(), 'c66bf357-4282-46f1-a237-2b5085448803'),
  ('ac500001-0001-4000-a000-000000000002', now(), now(), '5707857c-48d8-4023-9744-0140e362bd6a')
ON CONFLICT DO NOTHING;

INSERT INTO accessibility_violations (id, created_at, updated_at, audit_id) VALUES
  ('ac600001-0001-4000-a000-000000000001', now(), now(), 'ac200001-0001-4000-a000-000000000001'),
  ('ac600001-0001-4000-a000-000000000002', now(), now(), 'ac200001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Account & Banking
-- ============================================================
INSERT INTO account_reconciliations (id, created_at, updated_at, organization_id) VALUES
  ('ac700001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ac700001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO account_separation_policies (id, created_at, updated_at, organization_id) VALUES
  ('ac800001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ac800001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO alert_configs (id, created_at, updated_at, organization_id) VALUES
  ('ad000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO alert_escalations (id, created_at, updated_at, alert_id) VALUES
  ('ad100001-0001-4000-a000-000000000001', now(), now(), 'ad000001-0001-4000-a000-000000000001'),
  ('ad100001-0001-4000-a000-000000000002', now(), now(), 'ad000001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO alert_rules (id, created_at, updated_at, organization_id) VALUES
  ('ad200001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad200001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Analytics
-- ============================================================
INSERT INTO analytics_dashboards (id, created_at, updated_at, organization_id) VALUES
  ('ad300001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad300001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO analytics_events (id, created_at, updated_at, organization_id) VALUES
  ('ad400001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad400001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO analytics_segments (id, created_at, updated_at, organization_id) VALUES
  ('ad500001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad500001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- API & Rate Limiting
-- ============================================================
INSERT INTO api_keys (id, created_at, updated_at, organization_id) VALUES
  ('ad600001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad600001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO api_rate_limits (id, created_at, updated_at, organization_id) VALUES
  ('ad700001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad700001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO api_usage_logs (id, created_at, updated_at, organization_id) VALUES
  ('ad800001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ad800001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Arbitration
-- ============================================================
INSERT INTO arbitration_decisions (id, created_at, updated_at, organization_id) VALUES
  ('ae000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ae000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO arbitration_precedents (id, created_at, updated_at, organization_id) VALUES
  ('ae100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ae100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Assets & Automation
-- ============================================================
INSERT INTO assets (id, created_at, updated_at, organization_id) VALUES
  ('ae200001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ae200001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO automation_logs (id, created_at, updated_at, organization_id) VALUES
  ('ae300001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ae300001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO automation_rules (id, created_at, updated_at, organization_id) VALUES
  ('ae400001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ae400001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO automation_triggers (id, created_at, updated_at, rule_id) VALUES
  ('ae500001-0001-4000-a000-000000000001', now(), now(), 'ae400001-0001-4000-a000-000000000001'),
  ('ae500001-0001-4000-a000-000000000002', now(), now(), 'ae400001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Banking & Finance
-- ============================================================
INSERT INTO bank_accounts (id, created_at, updated_at, organization_id) VALUES
  ('ba000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ba000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO bank_reconciliation_items (id, created_at, updated_at, reconciliation_id) VALUES
  ('ba100001-0001-4000-a000-000000000001', now(), now(), 'ac700001-0001-4000-a000-000000000001'),
  ('ba100001-0001-4000-a000-000000000002', now(), now(), 'ac700001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO bank_statements (id, created_at, updated_at, organization_id) VALUES
  ('ba200001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ba200001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO bank_transactions (id, created_at, updated_at, organization_id) VALUES
  ('ba300001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ba300001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Benchmarks
-- ============================================================
INSERT INTO benchmark_data_points (id, created_at, updated_at, benchmark_id) VALUES
  ('be000001-0001-4000-a000-000000000001', now(), now(), 'ae200001-0001-4000-a000-000000000001'),
  ('be000001-0001-4000-a000-000000000002', now(), now(), 'ae200001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO benchmark_goals (id, created_at, updated_at, organization_id) VALUES
  ('be100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('be100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Board & Governance
-- ============================================================
INSERT INTO board_packets (id, created_at, updated_at, organization_id) VALUES
  ('bf000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('bf000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Budget
-- ============================================================
INSERT INTO budget_actuals (id, created_at, updated_at, organization_id) VALUES
  ('bf100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('bf100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO budget_approvals (id, created_at, updated_at, budget_id) VALUES
  ('bf200001-0001-4000-a000-000000000001', now(), now(), 'bf100001-0001-4000-a000-000000000001'),
  ('bf200001-0001-4000-a000-000000000002', now(), now(), 'bf100001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO budget_line_items (id, created_at, updated_at, budget_id) VALUES
  ('bf300001-0001-4000-a000-000000000001', now(), now(), 'bf100001-0001-4000-a000-000000000001'),
  ('bf300001-0001-4000-a000-000000000002', now(), now(), 'bf100001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO budget_transfers (id, created_at, updated_at, organization_id) VALUES
  ('bf400001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('bf400001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Campaigns
-- ============================================================
INSERT INTO campaigns (id, created_at, updated_at, organization_id) VALUES
  ('ca000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Cap Table & Shares
-- ============================================================
INSERT INTO cap_table_snapshots (id, created_at, updated_at, organization_id) VALUES
  ('ca100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ca100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CBA (Collective Bargaining)
-- ============================================================
INSERT INTO cba_footnotes (id, created_at, updated_at, cba_id) VALUES
  ('cb000001-0001-4000-a000-000000000001', now(), now(), 'ae200001-0001-4000-a000-000000000001'),
  ('cb000001-0001-4000-a000-000000000002', now(), now(), 'ae200001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Certifications
-- ============================================================
INSERT INTO certification_records (id, created_at, updated_at, organization_id) VALUES
  ('ce000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ce000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO certification_renewals (id, created_at, updated_at, certification_id) VALUES
  ('ce100001-0001-4000-a000-000000000001', now(), now(), 'ce000001-0001-4000-a000-000000000001'),
  ('ce100001-0001-4000-a000-000000000002', now(), now(), 'ce000001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Chart of Accounts & GL
-- ============================================================
INSERT INTO chart_of_accounts (id, entity_id, account_code, display_name, account_type, normal_balance, currency, created_at, updated_at) VALUES
  ('cf000001-0001-4000-a000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '1000', 'Cash', 'asset', 'debit', 'CAD', now(), now()),
  ('cf000001-0001-4000-a000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2000', 'Accounts Payable', 'liability', 'credit', 'CAD', now(), now()),
  ('cf000001-0001-4000-a000-000000000003', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '1000', 'Cash', 'asset', 'debit', 'CAD', now(), now()),
  ('cf000001-0001-4000-a000-000000000004', '5ecb17ab-b5de-442e-a46f-93778ee496aa', '2000', 'Accounts Payable', 'liability', 'credit', 'CAD', now(), now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- Chat & Messaging
-- ============================================================
INSERT INTO chat_channels (id, created_at, updated_at, organization_id) VALUES
  ('cc000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cc000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO chat_messages (id, created_at, updated_at, channel_id) VALUES
  ('cc100001-0001-4000-a000-000000000001', now(), now(), 'cc000001-0001-4000-a000-000000000001'),
  ('cc100001-0001-4000-a000-000000000002', now(), now(), 'cc000001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO chat_participants (id, created_at, updated_at, channel_id) VALUES
  ('cc200001-0001-4000-a000-000000000001', now(), now(), 'cc000001-0001-4000-a000-000000000001'),
  ('cc200001-0001-4000-a000-000000000002', now(), now(), 'cc000001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO chat_reactions (id, created_at, updated_at, message_id) VALUES
  ('cc300001-0001-4000-a000-000000000001', now(), now(), 'cc100001-0001-4000-a000-000000000001'),
  ('cc300001-0001-4000-a000-000000000002', now(), now(), 'cc100001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Claims
-- ============================================================
INSERT INTO claims (id, created_at, updated_at, organization_id) VALUES
  ('cd000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cd000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Clause Library
-- ============================================================
INSERT INTO clause_library (id, created_at, updated_at, organization_id) VALUES
  ('cd100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cd100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO clause_versions (id, created_at, updated_at, clause_id) VALUES
  ('cd200001-0001-4000-a000-000000000001', now(), now(), 'cd100001-0001-4000-a000-000000000001'),
  ('cd200001-0001-4000-a000-000000000002', now(), now(), 'cd100001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CLC specific
-- ============================================================
INSERT INTO clc_affiliate_compliance (id, created_at, updated_at, organization_id) VALUES
  ('cd300001-0001-4000-a000-000000000001', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('cd300001-0001-4000-a000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea')
ON CONFLICT DO NOTHING;

INSERT INTO clc_policy_submissions (id, created_at, updated_at, organization_id) VALUES
  ('cd400001-0001-4000-a000-000000000001', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa'),
  ('cd400001-0001-4000-a000-000000000002', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Close Period / Month-End
-- ============================================================
INSERT INTO close_checklists (id, created_at, updated_at, organization_id) VALUES
  ('cd500001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cd500001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO close_periods (id, entity_id, fiscal_year, period_number, start_date, end_date, status, created_at, updated_at) VALUES
  ('cd600001-0001-4000-a000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 2025, 1, '2025-01-01', '2025-01-31', 'closed', now(), now()),
  ('cd600001-0001-4000-a000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 2025, 1, '2025-01-01', '2025-01-31', 'closed', now(), now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- CMS
-- ============================================================
INSERT INTO cms_media (id, created_at, updated_at, organization_id) VALUES
  ('ce200001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ce200001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO cms_pages (id, created_at, updated_at, organization_id) VALUES
  ('ce300001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ce300001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO cms_posts (id, created_at, updated_at, organization_id) VALUES
  ('ce400001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ce400001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO cms_templates (id, created_at, updated_at, organization_id) VALUES
  ('ce500001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ce500001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Commerce
-- ============================================================
INSERT INTO commerce_carts (id, created_at, updated_at, organization_id) VALUES
  ('cf100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO commerce_categories (id, created_at, updated_at, organization_id) VALUES
  ('cf200001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf200001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO commerce_discounts (id, created_at, updated_at, organization_id) VALUES
  ('cf300001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf300001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO commerce_orders (id, created_at, updated_at, organization_id) VALUES
  ('cf400001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf400001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO commerce_products (id, created_at, updated_at, organization_id) VALUES
  ('cf500001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf500001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO commerce_returns (id, created_at, updated_at, organization_id) VALUES
  ('cf600001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf600001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO commerce_shipping (id, created_at, updated_at, organization_id) VALUES
  ('cf700001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf700001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Communication Analytics
-- ============================================================
INSERT INTO communication_analytics (id, created_at, updated_at, organization_id) VALUES
  ('cf800001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf800001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Compliance
-- ============================================================
INSERT INTO compliance_tasks (id, created_at, updated_at, organization_id) VALUES
  ('cf900001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf900001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Conflict of Interest
-- ============================================================
INSERT INTO conflict_of_interest_disclosures (id, created_at, updated_at, user_id) VALUES
  ('cf900002-0001-4000-a000-000000000001', now(), now(), 'c66bf357-4282-46f1-a237-2b5085448803'),
  ('cf900002-0001-4000-a000-000000000002', now(), now(), '5707857c-48d8-4023-9744-0140e362bd6a')
ON CONFLICT DO NOTHING;

INSERT INTO conflict_of_interest_reviews (id, created_at, updated_at, disclosure_id) VALUES
  ('cf900003-0001-4000-a000-000000000001', now(), now(), 'cf900002-0001-4000-a000-000000000001'),
  ('cf900003-0001-4000-a000-000000000002', now(), now(), 'cf900002-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Consent & Privacy
-- ============================================================
INSERT INTO consent_records (id, created_at, updated_at, user_id) VALUES
  ('cf900004-0001-4000-a000-000000000001', now(), now(), 'c66bf357-4282-46f1-a237-2b5085448803'),
  ('cf900004-0001-4000-a000-000000000002', now(), now(), '5707857c-48d8-4023-9744-0140e362bd6a')
ON CONFLICT DO NOTHING;

INSERT INTO continuing_education (id, created_at, updated_at, organization_id) VALUES
  ('cf900005-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf900005-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO contribution_rates (id, created_at, updated_at, organization_id) VALUES
  ('cf900006-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf900006-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Cost Centers
-- ============================================================
INSERT INTO cost_centers (id, entity_id, code, display_name, is_active, created_at, updated_at) VALUES
  ('cf900007-0001-4000-a000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CC-ADMIN', 'Administration', true, now(), now()),
  ('cf900007-0001-4000-a000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'CC-OPS', 'Operations', true, now(), now()),
  ('cf900007-0001-4000-a000-000000000003', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'CC-ADMIN', 'Administration', true, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- CPI & Inflation
-- ============================================================
INSERT INTO cpi_data (id, created_at, updated_at, province) VALUES
  ('cf900008-0001-4000-a000-000000000001', now(), now(), 'ON'),
  ('cf900008-0001-4000-a000-000000000002', now(), now(), 'BC')
ON CONFLICT DO NOTHING;

INSERT INTO cpi_escalation_schedules (id, created_at, updated_at, organization_id) VALUES
  ('cf900009-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf900009-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Cross Border & Currency
-- ============================================================
INSERT INTO cross_border_transactions (id, created_at, updated_at, organization_id) VALUES
  ('cf900010-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf900010-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO currency_accounts (id, created_at, updated_at, organization_id) VALUES
  ('cf900011-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf900011-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO currency_positions (id, created_at, updated_at, organization_id) VALUES
  ('cf900012-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('cf900012-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Data & Compliance
-- ============================================================
INSERT INTO data_classifications (id, created_at, updated_at, organization_id) VALUES
  ('da000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('da000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO data_export_requests (id, created_at, updated_at, organization_id) VALUES
  ('da100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('da100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO data_retention_configs (id, created_at, updated_at, organization_id) VALUES
  ('da200001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('da200001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Deadlines
-- ============================================================
INSERT INTO deadline_configs (id, created_at, updated_at, organization_id) VALUES
  ('da300001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('da300001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO deadline_reminders (id, created_at, updated_at, deadline_id) VALUES
  ('da400001-0001-4000-a000-000000000001', now(), now(), 'da300001-0001-4000-a000-000000000001'),
  ('da400001-0001-4000-a000-000000000002', now(), now(), 'da300001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Deals & Donations
-- ============================================================
INSERT INTO deals (id, created_at, updated_at, organization_id) VALUES
  ('da500001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('da500001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO document_signers (id, created_at, updated_at, document_id) VALUES
  ('da600001-0001-4000-a000-000000000001', now(), now(), 'd2100001-0001-4000-a000-000000000001'),
  ('da600001-0001-4000-a000-000000000002', now(), now(), 'd2100001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO donations (id, created_at, updated_at, organization_id) VALUES
  ('da700001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('da700001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DSR (Data Subject Requests)
-- ============================================================
INSERT INTO dsr_requests (id, created_at, updated_at, organization_id) VALUES
  ('da800001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('da800001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO dsr_tracking (id, created_at, updated_at, request_id) VALUES
  ('da900001-0001-4000-a000-000000000001', now(), now(), 'da800001-0001-4000-a000-000000000001'),
  ('da900001-0001-4000-a000-000000000002', now(), now(), 'da800001-0001-4000-a000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Dues
-- ============================================================
INSERT INTO dues_assignments (id, created_at, updated_at, organization_id) VALUES
  ('db000001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('db000001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

INSERT INTO dues_rates (id, created_at, updated_at, organization_id) VALUES
  ('db100001-0001-4000-a000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('db100001-0001-4000-a000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

COMMIT;

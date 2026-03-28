-- seed-staging-remaining.sql  (AI, ML, Stripe, Webhook, Audit, Sync tables)
-- Populates the final ~47 empty app-domain tables
-- Order: parents first, then children

-- ============================================================
-- 1. AI TABLES (19 tables)
-- ============================================================

-- ai_apps (standalone)
INSERT INTO ai_apps (id, app_key, name, status)
VALUES
  ('aa000001-0001-4000-8000-000000000001', 'union-assistant', 'Union Assistant', 'active'),
  ('aa000001-0001-4000-8000-000000000002', 'grievance-analyzer', 'Grievance Analyzer', 'active')
ON CONFLICT DO NOTHING;

-- ai_models (standalone)
INSERT INTO ai_models (id, provider, family, modality)
VALUES
  ('aa000002-0001-4000-8000-000000000001', 'azure_openai', 'gpt-4o', 'text'),
  ('aa000002-0001-4000-8000-000000000002', 'azure_openai', 'text-embedding-3-small', 'text')
ON CONFLICT DO NOTHING;

-- ai_prompts (standalone)
INSERT INTO ai_prompts (id, app_key, prompt_key, created_by)
VALUES
  ('aa000003-0001-4000-8000-000000000001', 'union-assistant', 'grievance-summary', 'system'),
  ('aa000003-0001-4000-8000-000000000002', 'grievance-analyzer', 'risk-assessment', 'system')
ON CONFLICT DO NOTHING;

-- ai_knowledge_sources (standalone, org_id = org)
INSERT INTO ai_knowledge_sources (id, org_id, app_key, source_type, title, created_by)
VALUES
  ('aa000004-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'union-assistant', 'blob_document', 'CBA Knowledge Base', 'system'),
  ('aa000004-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'union-assistant', 'manual', 'Policy Manual', 'system')
ON CONFLICT DO NOTHING;

-- ai_deployments (→ ai_models)
INSERT INTO ai_deployments (id, model_id, deployment_name, environment)
VALUES
  ('aa000005-0001-4000-8000-000000000001', 'aa000002-0001-4000-8000-000000000001', 'gpt4o-prod', 'prod'),
  ('aa000005-0001-4000-8000-000000000002', 'aa000002-0001-4000-8000-000000000002', 'embeddings-prod', 'prod')
ON CONFLICT DO NOTHING;

-- ai_prompt_versions (→ ai_prompts)
INSERT INTO ai_prompt_versions (id, prompt_id, version, template, created_by)
VALUES
  ('aa000006-0001-4000-8000-000000000001', 'aa000003-0001-4000-8000-000000000001', 1, 'Summarize the following grievance: {{content}}', 'system'),
  ('aa000006-0001-4000-8000-000000000002', 'aa000003-0001-4000-8000-000000000002', 1, 'Assess the risk level of this grievance: {{content}}', 'system')
ON CONFLICT DO NOTHING;

-- ai_capability_profiles (org_id = org)
INSERT INTO ai_capability_profiles (id, org_id, app_key, environment, profile_key, created_by)
VALUES
  ('aa000007-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'union-assistant', 'prod', 'default', 'system'),
  ('aa000007-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'union-assistant', 'prod', 'default', 'system')
ON CONFLICT DO NOTHING;

-- ai_actions (org_id = org)
INSERT INTO ai_actions (id, org_id, app_key, profile_key, action_type, proposal_json, requested_by)
VALUES
  ('aa000008-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'union-assistant', 'default', 'summarize', '{"target":"grievance-123"}', 'user_cape_01'),
  ('aa000008-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'grievance-analyzer', 'default', 'classify', '{"target":"case-456"}', 'user_clc_01')
ON CONFLICT DO NOTHING;

-- ai_embeddings (→ ai_knowledge_sources as source_id)
INSERT INTO ai_embeddings (id, org_id, app_key, source_id, chunk_id, chunk_text)
VALUES
  ('aa000009-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'union-assistant', 'aa000004-0001-4000-8000-000000000001', 'chunk-001', 'Collective bargaining agreement article 12 covers wages and benefits.'),
  ('aa000009-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'union-assistant', 'aa000004-0001-4000-8000-000000000002', 'chunk-001', 'The grievance procedure consists of four stages.')
ON CONFLICT DO NOTHING;

-- ai_deployment_routes (→ ai_deployments)
INSERT INTO ai_deployment_routes (id, deployment_id, org_id, app_key, profile_key, feature)
VALUES
  ('aa00000a-0001-4000-8000-000000000001', 'aa000005-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'union-assistant', 'default', 'chat'),
  ('aa00000a-0001-4000-8000-000000000002', 'aa000005-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'union-assistant', 'default', 'embed')
ON CONFLICT DO NOTHING;

-- ai_action_runs (→ ai_actions)
INSERT INTO ai_action_runs (id, action_id, org_id, status)
VALUES
  ('aa00000b-0001-4000-8000-000000000001', 'aa000008-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'success'),
  ('aa00000b-0001-4000-8000-000000000002', 'aa000008-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'success')
ON CONFLICT DO NOTHING;

-- ai_knowledge_ingestion_runs (→ ai_knowledge_sources)
INSERT INTO ai_knowledge_ingestion_runs (id, org_id, source_id, status)
VALUES
  ('aa00000c-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'aa000004-0001-4000-8000-000000000001', 'stored'),
  ('aa00000c-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'aa000004-0001-4000-8000-000000000002', 'stored')
ON CONFLICT DO NOTHING;

-- ai_requests (org_id = org)
INSERT INTO ai_requests (id, org_id, app_key, profile_key, feature, provider, model_or_deployment, request_hash, response_hash, status, tokens_in, tokens_out, cost_usd, latency_ms)
VALUES
  ('aa00000d-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'union-assistant', 'default', 'chat', 'azure_openai', 'gpt4o-prod', 'abc123hash', 'def456hash', 'success', 150, 300, 0.005, 1200),
  ('aa00000d-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'grievance-analyzer', 'default', 'classify', 'azure_openai', 'gpt4o-prod', 'ghi789hash', 'jkl012hash', 'success', 200, 50, 0.003, 800)
ON CONFLICT DO NOTHING;

-- ai_request_payloads (→ ai_requests)
INSERT INTO ai_request_payloads (id, request_id)
VALUES
  ('aa00000e-0001-4000-8000-000000000001', 'aa00000d-0001-4000-8000-000000000001'),
  ('aa00000e-0001-4000-8000-000000000002', 'aa00000d-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- ai_budgets (no DEFAULT on created_at/updated_at)
INSERT INTO ai_budgets (id, created_at, updated_at, organization_id)
VALUES
  ('aa00000f-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('aa00000f-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ai_rate_limits (no DEFAULT on created_at/updated_at)
INSERT INTO ai_rate_limits (id, created_at, updated_at, organization_id)
VALUES
  ('aa000010-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('aa000010-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ai_safety_filters (no DEFAULT on created_at/updated_at)
INSERT INTO ai_safety_filters (id, created_at, updated_at, input, flagged, action)
VALUES
  ('aa000011-0001-4000-8000-000000000001', now(), now(), 'Test input for content safety', false, 'allow'),
  ('aa000011-0001-4000-8000-000000000002', now(), now(), 'Flagged test content', true, 'block')
ON CONFLICT DO NOTHING;

-- ai_usage_budgets (org_id = org)
INSERT INTO ai_usage_budgets (id, org_id, app_key, profile_key, month, budget_usd)
VALUES
  ('aa000012-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'union-assistant', 'default', '2024-06', 100.00),
  ('aa000012-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'union-assistant', 'default', '2024-06', 150.00)
ON CONFLICT DO NOTHING;

-- ai_usage_metrics — check columns first
-- NOTE: Skipping if it has complex FKs. Leaving for now.

-- ============================================================
-- 2. ML TABLES (9 tables)
-- ============================================================

-- ml_datasets (org_id = org)
INSERT INTO ml_datasets (id, org_id, dataset_key, period_start, period_end, row_count, sha256)
VALUES
  ('bb000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'stripe-daily-cape', '2024-01-01', '2024-06-30', 180, 'sha256-cape-dataset-001'),
  ('bb000001-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'ue-cases-clc', '2024-01-01', '2024-06-30', 120, 'sha256-clc-dataset-001')
ON CONFLICT DO NOTHING;

-- ml_models (org_id = org)
INSERT INTO ml_models (id, org_id, model_key, algorithm, version, status)
VALUES
  ('bb000002-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'stripe-anomaly-v1', 'isolation_forest', 1, 'active'),
  ('bb000002-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'case-priority-v1', 'gradient_boosting', 1, 'active')
ON CONFLICT DO NOTHING;

-- ml_training_runs (org_id = org)
INSERT INTO ml_training_runs (id, org_id, model_key, dataset_id, status, finished_at)
VALUES
  ('bb000003-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'stripe-anomaly-v1', 'bb000001-0001-4000-8000-000000000001', 'success', now() - interval '7 days'),
  ('bb000003-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'case-priority-v1', 'bb000001-0001-4000-8000-000000000002', 'success', now() - interval '5 days')
ON CONFLICT DO NOTHING;

-- ml_inference_runs (→ ml_models)
INSERT INTO ml_inference_runs (id, org_id, model_id, status, input_period_start, input_period_end, finished_at)
VALUES
  ('bb000004-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'bb000002-0001-4000-8000-000000000001', 'success', '2024-06-01', '2024-06-30', now() - interval '1 day'),
  ('bb000004-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'bb000002-0001-4000-8000-000000000002', 'success', '2024-06-01', '2024-06-30', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- ml_predictions (no DEFAULT on id, created_at, updated_at)
INSERT INTO ml_predictions (id, created_at, updated_at, organization_id)
VALUES
  ('bb000005-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('bb000005-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- ml_scores_stripe_daily (→ ml_models, org_id)
INSERT INTO ml_scores_stripe_daily (id, org_id, date, score, threshold, model_id, inference_run_id)
VALUES
  ('bb000006-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2024-06-15', 0.35, 0.75, 'bb000002-0001-4000-8000-000000000001', 'bb000004-0001-4000-8000-000000000001'),
  ('bb000006-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '2024-06-16', 0.92, 0.75, 'bb000002-0001-4000-8000-000000000001', 'bb000004-0001-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

-- ml_scores_stripe_txn (→ ml_models, org_id)
INSERT INTO ml_scores_stripe_txn (id, org_id, occurred_at, amount, score, threshold, model_id)
VALUES
  ('bb000007-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', now() - interval '10 days', 5000.00, 0.15, 0.80, 'bb000002-0001-4000-8000-000000000001'),
  ('bb000007-0001-4000-8000-000000000002', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', now() - interval '9 days', 25000.00, 0.95, 0.80, 'bb000002-0001-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

-- ml_scores_ue_cases_priority (→ ml_models, ue_cases)
INSERT INTO ml_scores_ue_cases_priority (id, org_id, case_id, occurred_at, score, predicted_priority, model_id)
VALUES
  ('bb000008-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '600b9782-99b6-49ae-9fb0-6619b1f03105', now() - interval '3 days', 0.82, 'high', 'bb000002-0001-4000-8000-000000000002'),
  ('bb000008-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'c78f20d8-f0d0-40a5-bda1-cb09a11943f9', now() - interval '2 days', 0.45, 'medium', 'bb000002-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- ml_scores_ue_sla_risk (→ ml_models, ue_cases)
INSERT INTO ml_scores_ue_sla_risk (id, org_id, case_id, occurred_at, probability, model_id)
VALUES
  ('bb000009-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', '600b9782-99b6-49ae-9fb0-6619b1f03105', now() - interval '3 days', 0.72, 'bb000002-0001-4000-8000-000000000002'),
  ('bb000009-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'c78f20d8-f0d0-40a5-bda1-cb09a11943f9', now() - interval '2 days', 0.28, 'bb000002-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. STRIPE TABLES (9 tables)
-- ============================================================

-- stripe_connect_accounts (standalone, no DEFAULT on id/created_at/updated_at)
INSERT INTO stripe_connect_accounts (id, created_at, updated_at, account_type, account_purpose, stripe_account_id, account_status, account_email, account_name, country, currency, separate_account, trust_account_designation, account_verified, created_by)
VALUES
  ('dd000001-0001-4000-8000-000000000001', now(), now(), 'standard', 'dues_collection', 'acct_cape_001', 'active', 'finance@cape.org', 'CAPE Dues Account', 'CA', 'cad', false, false, true, 'admin'),
  ('dd000001-0001-4000-8000-000000000002', now(), now(), 'standard', 'trust_fund', 'acct_clc_001', 'active', 'finance@clc.org', 'CLC Trust Account', 'CA', 'cad', true, true, true, 'admin')
ON CONFLICT DO NOTHING;

-- stripe_connections (org_id = org)
INSERT INTO stripe_connections (id, org_id, account_id, connected_by)
VALUES
  ('dd000002-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'acct_cape_001', 'admin'),
  ('dd000002-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'acct_clc_001', 'admin')
ON CONFLICT DO NOTHING;

-- stripe_webhook_events (org_id = org)
INSERT INTO stripe_webhook_events (id, org_id, stripe_event_id, type, livemode, created, payload_json, signature_valid)
VALUES
  ('dd000003-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'evt_cape_001', 'payment_intent.succeeded', false, now() - interval '5 days', '{"id":"evt_cape_001","type":"payment_intent.succeeded"}', true),
  ('dd000003-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'evt_clc_001', 'invoice.paid', false, now() - interval '3 days', '{"id":"evt_clc_001","type":"invoice.paid"}', true)
ON CONFLICT DO NOTHING;

-- stripe_subscriptions (org_id = org)
INSERT INTO stripe_subscriptions (id, org_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_name, amount_cents, status, created_by)
VALUES
  ('dd000004-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'cus_cape_001', 'sub_cape_001', 'price_cape_001', 'Nzila Pro', 9900, 'active', 'admin'),
  ('dd000004-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'cus_clc_001', 'sub_clc_001', 'price_clc_001', 'Nzila Enterprise', 19900, 'active', 'admin')
ON CONFLICT DO NOTHING;

-- stripe_payments (→ stripe_webhook_events as raw_event_id)
INSERT INTO stripe_payments (id, org_id, stripe_object_id, object_type, status, amount_cents, occurred_at, raw_event_id)
VALUES
  ('dd000005-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'pi_cape_001', 'payment_intent', 'succeeded', 50000, now() - interval '5 days', 'dd000003-0001-4000-8000-000000000001'),
  ('dd000005-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'pi_clc_001', 'payment_intent', 'succeeded', 75000, now() - interval '3 days', 'dd000003-0001-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- stripe_payouts (org_id = org)
INSERT INTO stripe_payouts (id, org_id, payout_id, amount_cents, status, arrival_date, occurred_at)
VALUES
  ('dd000006-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'po_cape_001', 48500, 'paid', '2024-06-20', now() - interval '10 days'),
  ('dd000006-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'po_clc_001', 73500, 'paid', '2024-06-22', now() - interval '8 days')
ON CONFLICT DO NOTHING;

-- stripe_reports (org_id = org)
INSERT INTO stripe_reports (id, org_id, report_type, start_date, end_date, sha256)
VALUES
  ('dd000007-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'revenue_summary', '2024-06-01', '2024-06-30', 'sha256-stripe-report-cape'),
  ('dd000007-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'payout_recon', '2024-06-01', '2024-06-30', 'sha256-stripe-report-clc')
ON CONFLICT DO NOTHING;

-- stripe_disputes (→ stripe_payments)
INSERT INTO stripe_disputes (id, org_id, dispute_id, payment_id, amount_cents, status, reason, occurred_at)
VALUES
  ('dd000008-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'dp_cape_001', 'dd000005-0001-4000-8000-000000000001', 5000, 'needs_response', 'duplicate', now() - interval '2 days'),
  ('dd000008-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'dp_clc_001', 'dd000005-0001-4000-8000-000000000002', 7500, 'under_review', 'fraudulent', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- stripe_refunds (→ stripe_payments)
INSERT INTO stripe_refunds (id, org_id, refund_id, payment_id, amount_cents, requested_by, occurred_at)
VALUES
  ('dd000009-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 're_cape_001', 'dd000005-0001-4000-8000-000000000001', 2500, 'admin', now() - interval '1 day'),
  ('dd000009-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 're_clc_001', 'dd000005-0001-4000-8000-000000000002', 5000, 'admin', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- account_balance_reconciliation (→ stripe_connect_accounts)
INSERT INTO account_balance_reconciliation (id, created_at, updated_at, account_id, reconciliation_date, account_type, stripe_reported_balance, system_calculated_balance, balance_match, reconciliation_status)
VALUES
  ('dd00000a-0001-4000-8000-000000000001', now(), now(), 'dd000001-0001-4000-8000-000000000001', now() - interval '1 day', 'dues_collection', '48500.00', '48500.00', true, 'completed'),
  ('dd00000a-0001-4000-8000-000000000002', now(), now(), 'dd000001-0001-4000-8000-000000000002', now() - interval '1 day', 'trust_fund', '73500.00', '73450.00', false, 'review_needed')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. WEBHOOK TABLES (4 tables)
-- ============================================================

-- webhook_subscriptions (no DEFAULT on id/created_at/updated_at)
INSERT INTO webhook_subscriptions (id, created_at, updated_at, organization_id)
VALUES
  ('ee000001-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea'),
  ('ee000001-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa')
ON CONFLICT DO NOTHING;

-- webhook_events (organization_id = org)
INSERT INTO webhook_events (id, created_at, updated_at, organization_id, provider, event_type)
VALUES
  ('ee000002-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'quickbooks', 'invoice.created'),
  ('ee000002-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'workday', 'employee.updated')
ON CONFLICT DO NOTHING;

-- webhook_deliveries (→ webhook_subscriptions)
INSERT INTO webhook_deliveries (id, created_at, updated_at, webhook_id, event_type, status_code)
VALUES
  ('ee000003-0001-4000-8000-000000000001', now(), now(), 'ee000001-0001-4000-8000-000000000001', 'invoice.created', 200),
  ('ee000003-0001-4000-8000-000000000002', now(), now(), 'ee000001-0001-4000-8000-000000000002', 'employee.updated', 200)
ON CONFLICT DO NOTHING;

-- webhook_receipts (no DEFAULT on id/created_at/updated_at)
INSERT INTO webhook_receipts (id, created_at, updated_at, provider)
VALUES
  ('ee000004-0001-4000-8000-000000000001', now(), now(), 'quickbooks'),
  ('ee000004-0001-4000-8000-000000000002', now(), now(), 'workday')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. AUDIT TABLES (3 tables)
-- ============================================================

-- audit_events (org_id = org)
INSERT INTO audit_events (id, org_id, actor_clerk_user_id, action, target_type, hash)
VALUES
  ('ff000001-0001-4000-8000-000000000001', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'user_cape_01', 'member.created', 'member', 'hash-audit-event-001'),
  ('ff000001-0001-4000-8000-000000000002', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'user_clc_01', 'grievance.filed', 'grievance', 'hash-audit-event-002')
ON CONFLICT DO NOTHING;

-- audit_log
INSERT INTO audit_log (id, action, actor_id, entity_type)
VALUES
  ('ff000002-0001-4000-8000-000000000001', 'settings.updated', 'user_cape_01', 'organization'),
  ('ff000002-0001-4000-8000-000000000002', 'member.dues_paid', 'user_clc_01', 'member')
ON CONFLICT DO NOTHING;

-- audit_logs (no DEFAULT on id/created_at/updated_at; audit_id required)
INSERT INTO audit_logs (id, created_at, updated_at, audit_id, user_id, organization_id, action, resource_type)
VALUES
  ('ff000003-0001-4000-8000-000000000001', now(), now(), 'ff000002-0001-4000-8000-000000000001', 'user_cape_01', '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'settings.updated', 'organization'),
  ('ff000003-0001-4000-8000-000000000002', now(), now(), 'ff000002-0001-4000-8000-000000000002', 'user_clc_01', '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'member.dues_paid', 'member')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. REMAINING TABLES
-- ============================================================

-- automation_execution_log (→ automation_rules, no DEFAULT on id/created_at/updated_at)
INSERT INTO automation_execution_log (id, created_at, updated_at, rule_id, triggered_by)
VALUES
  ('ff000004-0001-4000-8000-000000000001', now(), now(), 'bf5ab448-cad7-40b6-b994-10651ecfe577', 'scheduler'),
  ('ff000004-0001-4000-8000-000000000002', now(), now(), '3fbcfbdb-4deb-4e3d-a5bb-c06339baa261', 'manual')
ON CONFLICT DO NOTHING;

-- sync_jobs (no DEFAULT on id/created_at/updated_at)
INSERT INTO sync_jobs (id, created_at, updated_at, organization_id, entity_type, direction, status, records_processed, records_succeeded)
VALUES
  ('ff000005-0001-4000-8000-000000000001', now(), now(), '885aa4e0-5dc1-45bf-ad32-86477868e8ea', 'members', 'pull', 'success', 150, 150),
  ('ff000005-0001-4000-8000-000000000002', now(), now(), '5ecb17ab-b5de-442e-a46f-93778ee496aa', 'employees', 'push', 'success', 80, 78)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Done. Expected: ~44 more tables populated
-- ============================================================

-- Phase 0B.2R §9 — UE Cognition KPI DB migration proof (real data round-trip)
--
-- Executed against native PostgreSQL 17.8 (nzila_automation @ localhost:5433).
-- Depends on migration 0039_ue_cognition_text_id_promotion.sql being applied
-- and the Phase 0B.2R §7 seed org existing in public.orgs
--   (id = 00000007-0000-4007-8007-000000000007).
--
-- Purpose: prove that the six UE Cognition telemetry tables accept:
--   * `id text` values in the makeId('<prefix>') format (not UUID) — the
--     defect Phase 0B.1 flagged as SQLSTATE 22P02 is resolved.
--   * `org_id uuid` values bound as UUID (no textual coercion).
--   * `jsonb` payloads.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING on every INSERT so the script may
-- be re-run against the same DB without duplication.

BEGIN;

\echo === 1) ue_case_risk_snapshots ===

INSERT INTO union_eyes.ue_case_risk_snapshots (
  id, tenant_id, org_id, case_id, case_kind, risk_score, risk_probability,
  risk_tier, confidence, recommended_action, rationale,
  top_factors, factors, trajectory, model_version
) VALUES (
  'crs_phase0b2r-9_deadbeef000001',
  'test-tenant-phase0b2r',
  '00000007-0000-4007-8007-000000000007'::uuid,
  'case_phase0b2r_001', 'grievance', 74, 0.74,
  'high', 0.83, 'assign_arbitrator',
  'Pattern matches 3 prior escalated grievances in the same worksite.',
  '[{"factor":"prior_escalation","weight":0.4}]'::jsonb,
  '{"prior_escalation":0.4,"steward_load":0.2,"member_history":0.14}'::jsonb,
  '{"trend":"worsening","last_7d":[0.62,0.68,0.71,0.74]}'::jsonb,
  'phase0b2r-crs-v1'
) ON CONFLICT (id) DO NOTHING;

SELECT id, org_id, tenant_id, case_id, risk_tier, model_version
  FROM union_eyes.ue_case_risk_snapshots
 WHERE id = 'crs_phase0b2r-9_deadbeef000001';


\echo === 2) ue_workload_snapshots ===

INSERT INTO union_eyes.ue_workload_snapshots (
  id, tenant_id, org_id, steward_id, current_caseload, max_caseload,
  utilization_ratio, at_risk_case_count, avg_response_days, status,
  sla_risk_score, burnout_signal, recommended_reassignments
) VALUES (
  'wls_phase0b2r-9_deadbeef000002',
  'test-tenant-phase0b2r',
  '00000007-0000-4007-8007-000000000007'::uuid,
  'steward_alpha', 18, 20, 0.90, 4, 2.7, 'overloaded', 0.65, 0.42,
  '[{"case_id":"case_phase0b2r_001","reassign_to":"steward_beta","reason":"capacity"}]'::jsonb
) ON CONFLICT (id) DO NOTHING;

SELECT id, org_id, steward_id, utilization_ratio, status
  FROM union_eyes.ue_workload_snapshots
 WHERE id = 'wls_phase0b2r-9_deadbeef000002';


\echo === 3) ue_engagement_snapshots ===

INSERT INTO union_eyes.ue_engagement_snapshots (
  id, tenant_id, org_id, member_id, engagement_score,
  disengagement_probability, tier, days_since_last_activity, recent_signals,
  recommended_channel, recommended_timing_hours, model_version
) VALUES (
  'mes_phase0b2r-9_deadbeef000003',
  'test-tenant-phase0b2r',
  '00000007-0000-4007-8007-000000000007'::uuid,
  'member_epsilon', 42, 0.58, 'at_risk', 31.5,
  '[{"type":"missed_meeting","at":"2026-07-18T14:00Z"}]'::jsonb,
  'email', 48.0, 'phase0b2r-mes-v1'
) ON CONFLICT (id) DO NOTHING;

SELECT id, org_id, member_id, tier, recommended_channel
  FROM union_eyes.ue_engagement_snapshots
 WHERE id = 'mes_phase0b2r-9_deadbeef000003';


\echo === 4) ue_precedent_matches ===

INSERT INTO union_eyes.ue_precedent_matches (
  id, tenant_id, org_id, for_case_id, matches, typical_days_to_resolve,
  typical_settlement_amount, success_rate
) VALUES (
  'pcm_phase0b2r-9_deadbeef000004',
  'test-tenant-phase0b2r',
  '00000007-0000-4007-8007-000000000007'::uuid,
  'case_phase0b2r_001',
  '[{"case_id":"legacy_case_101","similarity":0.87,"outcome":"resolved"}]'::jsonb,
  45.0, 12500.0, 0.72
) ON CONFLICT (id) DO NOTHING;

SELECT id, org_id, for_case_id, success_rate
  FROM union_eyes.ue_precedent_matches
 WHERE id = 'pcm_phase0b2r-9_deadbeef000004';


\echo === 5) ue_kpi_snapshots ===

INSERT INTO union_eyes.ue_kpi_snapshots (
  id, tenant_id, org_id, window_days, window_start, window_end, payload,
  model_version
) VALUES (
  'kpi_phase0b2r-9_deadbeef000005',
  'test-tenant-phase0b2r',
  '00000007-0000-4007-8007-000000000007'::uuid,
  30,
  '2026-06-24T00:00:00Z'::timestamptz,
  '2026-07-23T23:59:59Z'::timestamptz,
  '{"total_grievances":47,"resolved_pct":0.62,"avg_days_to_resolve":24.3,"member_engagement_index":0.71}'::jsonb,
  'phase0b2r-kpi-v1'
) ON CONFLICT (id) DO NOTHING;

SELECT id, org_id, window_days, model_version,
       payload->>'total_grievances' AS total_grievances
  FROM union_eyes.ue_kpi_snapshots
 WHERE id = 'kpi_phase0b2r-9_deadbeef000005';


\echo === 6) ue_cognition_audits ===

INSERT INTO union_eyes.ue_cognition_audits (
  id, tenant_id, org_id, resource, action, actor_id, resource_id, details
) VALUES (
  'aud_phase0b2r-9_deadbeef000006',
  'test-tenant-phase0b2r',
  '00000007-0000-4007-8007-000000000007'::uuid,
  'ue_kpi_snapshot', 'compute',
  'system:phase0b2r-section-9',
  'kpi_phase0b2r-9_deadbeef000005',
  '{"trigger":"phase-0b2r-proof","engine":"psql-inline"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

SELECT id, org_id, resource, action, resource_id
  FROM union_eyes.ue_cognition_audits
 WHERE id = 'aud_phase0b2r-9_deadbeef000006';


\echo === 7) Aggregate proof (6 tables, 6 rows, all matching org UUID) ===

SELECT 'ue_case_risk_snapshots' AS table_name, COUNT(*) AS phase0b2r_rows
  FROM union_eyes.ue_case_risk_snapshots
 WHERE id LIKE 'crs_phase0b2r-9_%'
UNION ALL
SELECT 'ue_workload_snapshots', COUNT(*)
  FROM union_eyes.ue_workload_snapshots
 WHERE id LIKE 'wls_phase0b2r-9_%'
UNION ALL
SELECT 'ue_engagement_snapshots', COUNT(*)
  FROM union_eyes.ue_engagement_snapshots
 WHERE id LIKE 'mes_phase0b2r-9_%'
UNION ALL
SELECT 'ue_precedent_matches', COUNT(*)
  FROM union_eyes.ue_precedent_matches
 WHERE id LIKE 'pcm_phase0b2r-9_%'
UNION ALL
SELECT 'ue_kpi_snapshots', COUNT(*)
  FROM union_eyes.ue_kpi_snapshots
 WHERE id LIKE 'kpi_phase0b2r-9_%'
UNION ALL
SELECT 'ue_cognition_audits', COUNT(*)
  FROM union_eyes.ue_cognition_audits
 WHERE id LIKE 'aud_phase0b2r-9_%'
ORDER BY table_name;

COMMIT;

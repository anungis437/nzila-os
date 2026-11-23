-- SAGE B-005 fictional institutional bootstrap (isolated DB only).
-- FICTIONAL_ONLY — do not apply to production.
-- Prerequisite: SAGE migration chain 0032 → 0052 applied.

BEGIN;

-- ── Workspaces ───────────────────────────────────────────────────────────────
INSERT INTO sage_workspace (id, org_id, name, status, institution_type, risk_surface, boundary_profile, created_by)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'org-alder-civic', 'Alder Civic Services — Workflow Redesign (fictional)', 'active', 'other_public_institution', 'general_governance', '{}'::jsonb, 'b005-bootstrap'),
  ('11111111-1111-4111-8111-111111111102', 'org-regulator-alpha', 'Regulator Alpha (fictional)', 'active', 'regulator', 'regulatory_boundary', '{}'::jsonb, 'b005-bootstrap'),
  ('11111111-1111-4111-8111-111111111103', 'org-regulator-beta', 'Regulator Beta (fictional)', 'active', 'regulator', 'regulatory_boundary', '{}'::jsonb, 'b005-bootstrap'),
  ('11111111-1111-4111-8111-111111111104', 'org-secretariat-north', 'Secretariat North (fictional)', 'active', 'crown_corporation', 'general_governance', '{}'::jsonb, 'b005-bootstrap'),
  ('11111111-1111-4111-8111-111111111105', 'org-exec-accountability', 'Executive Accountability Desk (fictional)', 'active', 'crown_corporation', 'general_governance', '{}'::jsonb, 'b005-bootstrap')
ON CONFLICT (id) DO NOTHING;

-- ── Mandates (P01 historic 40k revoked; current 30k active; T01 80k) ──────────
INSERT INTO sage_institutional_mandate (
  id, org_id, workspace_id, principal_actor_id, position_id, resource_id,
  permitted_actions, instrument_ref, instrument_version, issuer_actor_id,
  monetary_limit_minor, currency, verification_status, attested_at, accepted_at,
  effective_at, expires_at, revoked_at, status, created_by
) VALUES
  (
    '22222222-2222-4222-8222-222222222201',
    'org-alder-civic', '11111111-1111-4111-8111-111111111101',
    'officer-alder-1', 'pos-procurement', 'procurement.alder.workflow-redesign',
    '["resource.commit"]'::jsonb, 'FICT-ALDER-MANDATE-2024', '1', 'issuer-alder',
    4000000, 'CAD', 'verified', timestamptz '2024-01-01T00:00:00Z', timestamptz '2024-01-02T00:00:00Z',
    timestamptz '2024-01-01T00:00:00Z', timestamptz '2025-12-31T23:59:59Z',
    timestamptz '2026-01-01T00:00:00Z', 'revoked', 'b005-bootstrap'
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    'org-alder-civic', '11111111-1111-4111-8111-111111111101',
    'officer-alder-1', 'pos-procurement', 'procurement.alder.workflow-redesign',
    '["resource.commit"]'::jsonb, 'FICT-ALDER-MANDATE-2026', '2', 'issuer-alder',
    3000000, 'CAD', 'verified', timestamptz '2026-01-01T00:00:00Z', timestamptz '2026-01-02T00:00:00Z',
    timestamptz '2026-01-01T00:00:00Z', timestamptz '2027-12-31T23:59:59Z',
    NULL, 'active', 'b005-bootstrap'
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    'org-exec-accountability', '11111111-1111-4111-8111-111111111105',
    'exec-accountability-1', 'pos-executive', 'accountability.exec.program-t01',
    '["question.adopt","decision.ratify"]'::jsonb, 'FICT-EXEC-MANDATE-2026', '1', 'issuer-exec',
    8000000, 'CAD', 'verified', timestamptz '2026-01-01T00:00:00Z', timestamptz '2026-01-02T00:00:00Z',
    timestamptz '2026-01-01T00:00:00Z', timestamptz '2027-12-31T23:59:59Z',
    NULL, 'active', 'b005-bootstrap'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Office holdings ──────────────────────────────────────────────────────────
INSERT INTO sage_institutional_office_holding (
  id, org_id, workspace_id, actor_id, position_id, instrument_ref, instrument_version,
  status, effective_at, expires_at, revoked_at, created_by
) VALUES
  (
    '33333333-3333-4333-8333-333333333301',
    'org-alder-civic', '11111111-1111-4111-8111-111111111101',
    'officer-alder-1', 'pos-procurement', 'FICT-HOLDING-ALDER', '1',
    'active', timestamptz '2026-01-01T00:00:00Z', timestamptz '2027-12-31T23:59:59Z', NULL, 'b005-bootstrap'
  ),
  (
    '33333333-3333-4333-8333-333333333302',
    'org-alder-civic', '11111111-1111-4111-8111-111111111101',
    'officer-alder-conflicted', 'pos-procurement', 'FICT-HOLDING-ALDER-C', '1',
    'active', timestamptz '2026-01-01T00:00:00Z', timestamptz '2027-12-31T23:59:59Z', NULL, 'b005-bootstrap'
  ),
  (
    '33333333-3333-4333-8333-333333333303',
    'org-secretariat-north', '11111111-1111-4111-8111-111111111104',
    'sec-predecessor', 'pos-secretariat', 'FICT-HOLDING-SEC-PRED', '1',
    'expired', timestamptz '2024-01-01T00:00:00Z', timestamptz '2025-12-31T23:59:59Z', NULL, 'b005-bootstrap'
  ),
  (
    '33333333-3333-4333-8333-333333333304',
    'org-secretariat-north', '11111111-1111-4111-8111-111111111104',
    'sec-successor', 'pos-secretariat', 'FICT-HOLDING-SEC-SUCC', '1',
    'active', timestamptz '2026-01-01T00:00:00Z', timestamptz '2027-12-31T23:59:59Z', NULL, 'b005-bootstrap'
  )
ON CONFLICT (id) DO NOTHING;

-- ── Conflict / recusal attestations ──────────────────────────────────────────
INSERT INTO sage_institutional_conflict_attestation (
  id, org_id, workspace_id, actor_id, resource_id, action_scope, conflicted,
  instrument_ref, instrument_version, attested_by, attested_at, effective_at, expires_at, revoked_at
) VALUES
  (
    '44444444-4444-4444-8444-444444444401',
    'org-alder-civic', '11111111-1111-4111-8111-111111111101',
    'officer-alder-1', 'procurement.alder.workflow-redesign', 'resource.commit', false,
    'FICT-CLEAR-ALDER', '1', 'attestor-alder', timestamptz '2026-01-01T00:00:00Z',
    timestamptz '2026-01-01T00:00:00Z', timestamptz '2027-12-31T23:59:59Z', NULL
  ),
  (
    '44444444-4444-4444-8444-444444444402',
    'org-alder-civic', '11111111-1111-4111-8111-111111111101',
    'officer-alder-conflicted', 'procurement.alder.workflow-redesign', '*', true,
    'FICT-RECUSAL-ALDER', '1', 'attestor-alder', timestamptz '2026-01-01T00:00:00Z',
    timestamptz '2026-01-01T00:00:00Z', timestamptz '2027-12-31T23:59:59Z', NULL
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- Nzila OS — R6 Seeded Persona Corpus
-- ============================================================================
-- Doctrine: docs/nzila-residual-closure/r6-seeded-persona-corpus-completion.md
--
-- Deterministic, idempotent persona seed for staging + pilot. Personas are
-- namespaced under @persona.unioneyes.app (synthetic, never deliverable),
-- attributed to 'r6-seed-corpus' as the audit author, and inserted with
-- ON CONFLICT DO NOTHING so re-runs are no-ops.
--
-- Total: 19 personas across 6 classes
--   3 executive | 5 steward | 3 governance | 3 onboarding | 2 procurement | 3 degraded-runtime
--
-- USAGE
-- -----
-- This seed expects two psql variables (set via -v):
--   :seed_org_id   — UUID of the seed organization (NOT the default org)
--   :password_hash — Argon2id hash for personas (synthetic placeholder accepted)
--
-- Example (staging):
--   $env:PGPASSWORD = "<staging-pwd>"
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
--       -h <staging-fqdn> -U nzila -d nzila_automation `
--       -v seed_org_id="'00000000-0000-0000-0000-0000000000aa'" `
--       -v password_hash="'\$argon2id\$v=19\$m=65536,t=3,p=4\$persona\$persona'" `
--       -f tooling/seeds/r6-persona-corpus.sql
--
-- The chore PR landing this SQL must include the live seed_org_id values for
-- staging + pilot and a verification SQL run captured under the PR evidence
-- directory. DO NOT seed against the default org.
-- ============================================================================

BEGIN;

-- Verify seed org exists and is NOT the default org. Refuse to proceed otherwise.
DO $$
DECLARE
  default_org_id CONSTANT uuid := '458a56cb-251a-4c91-a0b5-81bb8ac39087';
BEGIN
  IF :'seed_org_id'::uuid = default_org_id THEN
    RAISE EXCEPTION 'R6 seed refused: seed_org_id must NOT equal the default org id';
  END IF;
END $$;

-- Personas (deterministic user_id slugs, synthetic emails, governance-safe).
-- account_source = 'local'; lifecycle_state = 'active'; is_system_admin = false.
INSERT INTO user_management.users (
  user_id, email, email_verified, password_hash,
  first_name, last_name, display_name,
  account_source, lifecycle_state, is_active
) VALUES
  -- Executive personas (3)
  ('r6-exec-001', 'executive_001@persona.unioneyes.app', true, :'password_hash', 'Executive', 'One',   'Executive Persona 001', 'local', 'active', true),
  ('r6-exec-002', 'executive_002@persona.unioneyes.app', true, :'password_hash', 'Executive', 'Two',   'Executive Persona 002', 'local', 'active', true),
  ('r6-exec-003', 'executive_003@persona.unioneyes.app', true, :'password_hash', 'Executive', 'Three', 'Executive Persona 003', 'local', 'active', true),
  -- Steward personas (5)
  ('r6-stwd-001', 'steward_001@persona.unioneyes.app', true, :'password_hash', 'Steward', 'One',   'Steward Persona 001', 'local', 'active', true),
  ('r6-stwd-002', 'steward_002@persona.unioneyes.app', true, :'password_hash', 'Steward', 'Two',   'Steward Persona 002', 'local', 'active', true),
  ('r6-stwd-003', 'steward_003@persona.unioneyes.app', true, :'password_hash', 'Steward', 'Three', 'Steward Persona 003', 'local', 'active', true),
  ('r6-stwd-004', 'steward_004@persona.unioneyes.app', true, :'password_hash', 'Steward', 'Four',  'Steward Persona 004', 'local', 'active', true),
  ('r6-stwd-005', 'steward_005@persona.unioneyes.app', true, :'password_hash', 'Steward', 'Five',  'Steward Persona 005', 'local', 'active', true),
  -- Governance personas (3)
  ('r6-gov-001', 'governance_001@persona.unioneyes.app', true, :'password_hash', 'Governance', 'One',   'Governance Persona 001', 'local', 'active', true),
  ('r6-gov-002', 'governance_002@persona.unioneyes.app', true, :'password_hash', 'Governance', 'Two',   'Governance Persona 002', 'local', 'active', true),
  ('r6-gov-003', 'governance_003@persona.unioneyes.app', true, :'password_hash', 'Governance', 'Three', 'Governance Persona 003', 'local', 'active', true),
  -- Onboarding personas (3)
  ('r6-onb-001', 'onboarding_001@persona.unioneyes.app', true, :'password_hash', 'Onboarding', 'One',   'Onboarding Persona 001', 'local', 'active', true),
  ('r6-onb-002', 'onboarding_002@persona.unioneyes.app', true, :'password_hash', 'Onboarding', 'Two',   'Onboarding Persona 002', 'local', 'active', true),
  ('r6-onb-003', 'onboarding_003@persona.unioneyes.app', true, :'password_hash', 'Onboarding', 'Three', 'Onboarding Persona 003', 'local', 'active', true),
  -- Procurement personas (2)
  ('r6-proc-001', 'procurement_001@persona.unioneyes.app', true, :'password_hash', 'Procurement', 'One', 'Procurement Persona 001', 'local', 'active', true),
  ('r6-proc-002', 'procurement_002@persona.unioneyes.app', true, :'password_hash', 'Procurement', 'Two', 'Procurement Persona 002', 'local', 'active', true),
  -- Degraded-runtime personas (3) — exercise partial-completion / queued / suppressed flows
  ('r6-deg-001', 'degraded_001@persona.unioneyes.app', true, :'password_hash', 'Degraded', 'One',   'Degraded Persona 001', 'local', 'active', true),
  ('r6-deg-002', 'degraded_002@persona.unioneyes.app', true, :'password_hash', 'Degraded', 'Two',   'Degraded Persona 002', 'local', 'active', true),
  ('r6-deg-003', 'degraded_003@persona.unioneyes.app', true, :'password_hash', 'Degraded', 'Three', 'Degraded Persona 003', 'local', 'active', true)
ON CONFLICT (email) DO NOTHING;

-- Org memberships — every persona joins the seed org with a class-appropriate role.
INSERT INTO user_management.organization_users (
  organization_id, user_id, role, is_active, is_primary, invited_by, joined_at
)
SELECT
  :'seed_org_id'::uuid,
  u.user_id,
  CASE
    WHEN u.user_id LIKE 'r6-exec-%'  THEN 'executive'
    WHEN u.user_id LIKE 'r6-stwd-%'  THEN 'steward'
    WHEN u.user_id LIKE 'r6-gov-%'   THEN 'governance'
    WHEN u.user_id LIKE 'r6-onb-%'   THEN 'member'
    WHEN u.user_id LIKE 'r6-proc-%'  THEN 'procurement'
    WHEN u.user_id LIKE 'r6-deg-%'   THEN 'member'
  END AS role,
  true   AS is_active,
  false  AS is_primary,
  'r6-seed-corpus' AS invited_by,
  NOW()  AS joined_at
FROM user_management.users u
WHERE u.email LIKE '%@persona.unioneyes.app'
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Verification (must return 19 rows seeded against the seed org).
SELECT
  CASE
    WHEN email LIKE 'executive_%'    THEN 'executive'
    WHEN email LIKE 'steward_%'      THEN 'steward'
    WHEN email LIKE 'governance_%'   THEN 'governance'
    WHEN email LIKE 'onboarding_%'   THEN 'onboarding'
    WHEN email LIKE 'procurement_%'  THEN 'procurement'
    WHEN email LIKE 'degraded_%'     THEN 'degraded'
  END AS persona_class,
  COUNT(*) AS seeded
FROM user_management.users
WHERE email LIKE '%@persona.unioneyes.app'
GROUP BY 1
ORDER BY 1;

COMMIT;

-- ============================================================
-- 0071: Applications Registry — Multi-App Discriminator
-- ============================================================
-- Introduces a formal `applications` table so every org
-- can be tied to the specific NzilaOS app it belongs to.
-- With 17 apps in the monorepo (and more planned), implicit
-- organization_type conventions no longer scale.
--
-- Design:
--   organizations.app_id  → applications.id  (nullable FK)
--   organization_members inherits via org — no column needed.
--   App-specific tables (zonga_*, etc.) already scope by org_id.
--
-- Each app gets a stable UUID, a machine slug (matches the
-- apps/ folder name), and a human-readable display name.
-- ============================================================

BEGIN;

-- ── 1. Applications Table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,           -- matches apps/ folder name
  display_name  TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','beta','deprecated','archived')),
  default_org_type TEXT,                        -- suggested org type for this app
  settings      JSONB NOT NULL DEFAULT '{}',    -- per-app config (feature gates, theme, etc.)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE applications IS 'Registry of all NzilaOS platform apps. Each organization links to the app it belongs to.';
COMMENT ON COLUMN applications.slug IS 'Machine name matching the apps/ directory (e.g. union-eyes, zonga, cfo)';
COMMENT ON COLUMN applications.default_org_type IS 'Typical organization_type for orgs under this app (e.g. local, platform)';

-- ── 2. Seed All 17 Monorepo Apps ────────────────────────────────────────────

INSERT INTO applications (id, slug, display_name, description, status, default_org_type) VALUES
  -- Labour & Union Management
  ('a0000001-0000-0000-0000-000000000001', 'union-eyes',             'Union Eyes',              'Labour union management — grievances, collective bargaining, member services',                'active',     'local'),
  ('a0000001-0000-0000-0000-000000000002', 'console',                'Console',                 'Platform administration console for NzilaOS operators',                                       'active',     'platform'),
  ('a0000001-0000-0000-0000-000000000003', 'control-plane',          'Control Plane',           'Infrastructure control plane — tenant provisioning, routing, observability',                   'active',     'platform'),
  ('a0000001-0000-0000-0000-000000000004', 'platform-admin',         'Platform Admin',          'Super-admin interface for cross-tenant operations',                                           'active',     'platform'),
  ('a0000001-0000-0000-0000-000000000005', 'web',                    'Web',                     'Public-facing marketing site and documentation portal',                                       'active',     NULL),
  ('a0000001-0000-0000-0000-000000000006', 'orchestrator-api',       'Orchestrator API',        'Backend API orchestration layer — workflow engine and task routing',                           'active',     NULL),

  -- Music & Media
  ('a0000001-0000-0000-0000-000000000007', 'zonga',                  'Zonga',                   'Fair-share African music platform — distribution, streaming, royalties',                      'active',     'platform'),

  -- Finance & Trade
  ('a0000001-0000-0000-0000-000000000008', 'cfo',                    'CFO',                     'Chief Financial Officer — financial planning, budgeting, treasury management',                 'active',     'platform'),
  ('a0000001-0000-0000-0000-000000000009', 'trade',                  'Trade',                   'Cross-border trade facilitation and compliance',                                              'active',     'platform'),

  -- Agriculture & Mobility
  ('a0000001-0000-0000-0000-00000000000a', 'agrimo',                 'Agrimo',                  'Agricultural supply chain intelligence and market access',                                    'active',     'platform'),
  ('a0000001-0000-0000-0000-00000000000b', 'mobility',               'Mobility',                'Transport and logistics management platform',                                                 'active',     'platform'),
  ('a0000001-0000-0000-0000-00000000000c', 'mobility-client-portal', 'Mobility Client Portal',  'Client-facing portal for mobility services',                                                  'active',     'platform'),

  -- Legal, Dispute Resolution & AI
  ('a0000001-0000-0000-0000-00000000000d', 'cora',                   'CORA',                    'Conflict resolution and arbitration management',                                              'active',     'platform'),
  ('a0000001-0000-0000-0000-00000000000e', 'flow',                   'Flow',                    'Workflow automation and business process orchestration',                                       'active',     'platform'),

  -- Partners & Exams
  ('a0000001-0000-0000-0000-00000000000f', 'partners',               'Partners',                'Partnership and channel management portal',                                                   'active',     'platform'),
  ('a0000001-0000-0000-0000-000000000010', 'nacp-exams',             'NACP Exams',              'National accreditation and certification exam platform',                                       'active',     'platform'),

  -- Reporting
  ('a0000001-0000-0000-0000-000000000011', 'abr',                    'ABR',                     'Automated Business Reporting — regulatory filings and compliance reports',                     'active',     'platform')

ON CONFLICT (slug) DO NOTHING;

-- ── 3. Add app_id Column to Organizations ───────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS app_id UUID REFERENCES applications(id);

COMMENT ON COLUMN organizations.app_id IS 'The NzilaOS application this organization primarily belongs to. NULL = shared/platform-level.';

CREATE INDEX IF NOT EXISTS idx_organizations_app_id ON organizations(app_id);

-- ── 4. Back-fill Existing Organizations ─────────────────────────────────────

-- Union Eyes orgs: locals, unions, federations, districts, congress
UPDATE organizations
SET    app_id = 'a0000001-0000-0000-0000-000000000001'
WHERE  organization_type IN ('local', 'union', 'federation', 'district', 'congress')
  AND  app_id IS NULL;

-- Zonga org
UPDATE organizations
SET    app_id = 'a0000001-0000-0000-0000-000000000007'
WHERE  slug = 'afrobeats-records'
  AND  app_id IS NULL;

-- NZILA Ventures (platform/console)
UPDATE organizations
SET    app_id = 'a0000001-0000-0000-0000-000000000002'
WHERE  slug = 'default'
  AND  app_id IS NULL;

-- ── 5. Create View for Quick App ↔ Org ↔ Member Lookups ────────────────────

CREATE OR REPLACE VIEW v_app_org_members AS
SELECT
  a.slug           AS app_slug,
  a.display_name   AS app_name,
  o.id             AS org_id,
  o.name           AS org_name,
  o.organization_type,
  om.id            AS member_id,
  om.user_id,
  om.name          AS member_name,
  om.email         AS member_email,
  om.role          AS member_role,
  om.status        AS member_status
FROM organization_members om
JOIN organizations o  ON o.id = om.organization_id::uuid
LEFT JOIN applications a ON a.id = o.app_id;

COMMENT ON VIEW v_app_org_members IS 'Denormalized view: app → org → member. Use for cross-app queries and audits.';

COMMIT;

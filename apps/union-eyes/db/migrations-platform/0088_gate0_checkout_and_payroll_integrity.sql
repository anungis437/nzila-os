-- PLATFORM_SQL 0088_gate0_checkout_and_payroll_integrity
-- Gate 0 residual closure: opaque workbook checkout intents and one official
-- payroll run per tenant/source batch/run type. Not applied by this file.
--> statement-breakpoint
ALTER TABLE public.grievances ADD COLUMN IF NOT EXISTS demo_seed_id uuid;
ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS demo_seed_id uuid;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS demo_seed_id uuid;
-- Platform migrations run before the cache chain in the governed bootstrap.
-- Establish the provenance arrays here before using them; cache 0057 repeats
-- these additions idempotently for installations that apply that chain alone.
ALTER TABLE public.pilot_demo_seeds ADD COLUMN IF NOT EXISTS employer_ids text[];
ALTER TABLE public.pilot_demo_seeds ADD COLUMN IF NOT EXISTS grievance_ids text[];
-- Preserve the exact provenance of legacy generated rows by joining only the
-- immutable IDs recorded by the seed marker; names and prefixes are never used.
UPDATE public.grievances AS g
SET demo_seed_id = s.id
FROM public.pilot_demo_seeds AS s
WHERE g.organization_id = s.organization_id
  AND g.demo_seed_id IS NULL
  AND g.id::text = ANY(COALESCE(s.grievance_ids, ARRAY[]::text[]));
UPDATE public.employers AS e
SET demo_seed_id = s.id
FROM public.pilot_demo_seeds AS s
WHERE e.organization_id = s.organization_id
  AND e.demo_seed_id IS NULL
  AND e.id::text = ANY(COALESCE(s.employer_ids, ARRAY[]::text[]));
-- Older fixture bootstraps already have exact row provenance in the fixture
-- ledger. Backfill from that ledger only; never infer demo membership from PII.
UPDATE public.organization_members AS m
SET demo_seed_id = f.id
FROM public.pilot_fixture_rows AS f
WHERE f.organization_id = m.organization_id
  AND f.fixture_source = 'api/pilot/bootstrap/cupe'
  AND f.resource_type = 'organization_member'
  AND f.resource_id = m.id
  AND m.demo_seed_id IS NULL;
ALTER TABLE public.grievances DROP CONSTRAINT IF EXISTS grievances_demo_seed_fk;
ALTER TABLE public.grievances ADD CONSTRAINT grievances_demo_seed_fk FOREIGN KEY (demo_seed_id) REFERENCES public.pilot_demo_seeds(id) ON DELETE RESTRICT;
ALTER TABLE public.employers DROP CONSTRAINT IF EXISTS employers_demo_seed_fk;
ALTER TABLE public.employers ADD CONSTRAINT employers_demo_seed_fk FOREIGN KEY (demo_seed_id) REFERENCES public.pilot_demo_seeds(id) ON DELETE RESTRICT;
-- Membership provenance remains an opaque durable marker rather than a
-- foreign key: the older pilot-fixture ledger migration must remain capable
-- of rolling back independently during migration qualification.
CREATE INDEX IF NOT EXISTS idx_grievances_demo_seed ON public.grievances(organization_id, demo_seed_id) WHERE demo_seed_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employers_demo_seed ON public.employers(organization_id, demo_seed_id) WHERE demo_seed_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organization_members_demo_seed ON public.organization_members(organization_id, demo_seed_id) WHERE demo_seed_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.ue_demo_seed_provenance_immutable() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
BEGIN
  IF OLD.demo_seed_id IS DISTINCT FROM NEW.demo_seed_id THEN
    RAISE EXCEPTION 'demo seed provenance is immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
DROP TRIGGER IF EXISTS grievances_demo_seed_immutable ON public.grievances;
CREATE TRIGGER grievances_demo_seed_immutable BEFORE UPDATE ON public.grievances FOR EACH ROW EXECUTE FUNCTION public.ue_demo_seed_provenance_immutable();
DROP TRIGGER IF EXISTS employers_demo_seed_immutable ON public.employers;
CREATE TRIGGER employers_demo_seed_immutable BEFORE UPDATE ON public.employers FOR EACH ROW EXECUTE FUNCTION public.ue_demo_seed_provenance_immutable();
DROP TRIGGER IF EXISTS organization_members_demo_seed_immutable ON public.organization_members;
CREATE TRIGGER organization_members_demo_seed_immutable BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.ue_demo_seed_provenance_immutable();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.workbook_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id uuid NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  public_ref_hash varchar(64) NOT NULL,
  tier_id varchar(64) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'prepared',
  stripe_session_ref varchar(128),
  stripe_payment_ref varchar(128),
  expires_at timestamptz NOT NULL,
  fulfilled_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workbook_checkout_intents_status_check
    CHECK (status IN ('prepared', 'session_created', 'fulfilled', 'redeemed', 'cancelled', 'expired')),
  CONSTRAINT workbook_checkout_intents_fulfilment_check
    CHECK ((fulfilled_at IS NULL) = (stripe_payment_ref IS NULL)),
  CONSTRAINT workbook_checkout_intents_redemption_check
    CHECK (redeemed_at IS NULL OR fulfilled_at IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS workbook_checkout_intents_public_ref_uniq
  ON public.workbook_checkout_intents(public_ref_hash);
CREATE UNIQUE INDEX IF NOT EXISTS workbook_checkout_intents_stripe_session_uniq
  ON public.workbook_checkout_intents(stripe_session_ref) WHERE stripe_session_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS workbook_checkout_intents_workbook_idx
  ON public.workbook_checkout_intents(workbook_id);
--> statement-breakpoint
REVOKE ALL ON TABLE public.workbook_checkout_intents FROM PUBLIC, union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workbook_checkout_intents TO union_eyes_system;
ALTER TABLE public.workbook_checkout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_checkout_intents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workbook_checkout_intents_system_only ON public.workbook_checkout_intents;
CREATE POLICY workbook_checkout_intents_system_only ON public.workbook_checkout_intents
  FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_official_source_uniq
  ON public.employer_payroll_runs(organization_id, source_batch_id, run_type)
  WHERE source_batch_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.document_upload_quarantines (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  principal_user_id varchar(255) NOT NULL,
  storage_key text NOT NULL UNIQUE,
  original_filename varchar(255) NOT NULL,
  declared_mime_type varchar(255) NOT NULL,
  matter_type varchar(64),
  matter_id uuid,
  state varchar(20) NOT NULL DEFAULT 'uploading' CHECK (state IN ('uploading','rejected','promoted')),
  size_bytes bigint,
  content_hash varchar(64),
  scan_status varchar(20),
  scan_signature varchar(255),
  rejection_reason varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT document_upload_quarantine_matter_ck CHECK ((matter_type IS NULL) = (matter_id IS NULL)),
  CONSTRAINT document_upload_quarantine_key_ck CHECK (storage_key LIKE 'documents/' || organization_id::text || '/intake/' || id::text || '/%')
);
CREATE INDEX IF NOT EXISTS document_upload_quarantine_state_idx ON public.document_upload_quarantines(state, created_at);
ALTER TABLE public.document_upload_quarantines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_upload_quarantines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_upload_quarantine_tenant ON public.document_upload_quarantines;
CREATE POLICY document_upload_quarantine_tenant ON public.document_upload_quarantines FOR ALL TO union_eyes_runtime
  USING (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid))
  WITH CHECK (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid));
DROP POLICY IF EXISTS document_upload_quarantine_system ON public.document_upload_quarantines;
CREATE POLICY document_upload_quarantine_system ON public.document_upload_quarantines FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.document_upload_quarantines FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.document_upload_quarantines TO union_eyes_runtime, union_eyes_system;
--> statement-breakpoint
ALTER TABLE public.sso_providers ADD COLUMN IF NOT EXISTS active_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.sso_providers
  ADD COLUMN IF NOT EXISTS approved_by varchar(255),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_reference varchar(255);
CREATE TABLE IF NOT EXISTS public.sso_provider_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.sso_providers(id) ON DELETE CASCADE,
  version integer NOT NULL,
  configuration jsonb NOT NULL,
  created_by varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, version)
);
CREATE TABLE IF NOT EXISTS public.sso_oidc_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.sso_providers(id) ON DELETE CASCADE,
  provider_version integer NOT NULL,
  state_hash varchar(64) NOT NULL UNIQUE,
  nonce_hash varchar(64) NOT NULL,
  encrypted_nonce text NOT NULL,
  encrypted_code_verifier text NOT NULL,
  return_path varchar(500) NOT NULL DEFAULT '/dashboard',
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sso_oidc_attempt_return_path_ck CHECK (return_path ~ '^/[A-Za-z0-9/_?&=.-]*$' AND return_path !~ '^//')
);
CREATE INDEX IF NOT EXISTS sso_oidc_attempt_expiry_idx ON public.sso_oidc_attempts(expires_at) WHERE consumed_at IS NULL;
ALTER TABLE public.sso_provider_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_provider_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sso_oidc_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_oidc_attempts FORCE ROW LEVEL SECURITY;
DO $ue_sso_policies$
DECLARE rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['sso_provider_versions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rel || '_tenant', rel);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO union_eyes_runtime USING (organization_id = COALESCE(NULLIF(current_setting(''app.current_organization_id'',true),'''')::uuid,NULLIF(current_setting(''app.current_org_id'',true),'''')::uuid)) WITH CHECK (organization_id = COALESCE(NULLIF(current_setting(''app.current_organization_id'',true),'''')::uuid,NULLIF(current_setting(''app.current_org_id'',true),'''')::uuid))', rel || '_tenant', rel);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rel || '_system', rel);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', rel || '_system', rel);
  END LOOP;
  DROP POLICY IF EXISTS sso_oidc_attempts_tenant ON public.sso_oidc_attempts;
  DROP POLICY IF EXISTS sso_oidc_attempts_system ON public.sso_oidc_attempts;
  CREATE POLICY sso_oidc_attempts_system ON public.sso_oidc_attempts
    FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
END $ue_sso_policies$;
REVOKE ALL ON TABLE public.sso_provider_versions, public.sso_oidc_attempts FROM PUBLIC;
GRANT SELECT, INSERT ON TABLE public.sso_provider_versions TO union_eyes_runtime, union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sso_oidc_attempts TO union_eyes_system;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.dues_payment_merchant_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connected_account_id varchar(255) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','revoked')),
  mandate_reference varchar(255) NOT NULL,
  created_by varchar(255) NOT NULL,
  approved_by varchar(255),
  approved_at timestamptz,
  activated_by varchar(255),
  activated_at timestamptz,
  revoked_by varchar(255),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dues_payment_merchant_account_shape CHECK (connected_account_id ~ '^acct_[A-Za-z0-9]{8,}$'),
  CONSTRAINT dues_payment_merchant_independent_approval CHECK (approved_by IS NULL OR approved_by <> created_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS dues_payment_merchant_one_active
  ON public.dues_payment_merchant_configs(organization_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS dues_payment_merchant_account_org_uniq
  ON public.dues_payment_merchant_configs(organization_id, connected_account_id) WHERE status <> 'revoked';
CREATE TABLE IF NOT EXISTS public.dues_payment_disclosure_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  member_user_id varchar(255) NOT NULL,
  merchant_config_id uuid NOT NULL REFERENCES public.dues_payment_merchant_configs(id) ON DELETE RESTRICT,
  notice_version varchar(64) NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dues_payment_disclosure_consent_live_uniq
  ON public.dues_payment_disclosure_consents(organization_id, member_user_id, merchant_config_id)
  WHERE revoked_at IS NULL;
ALTER TABLE public.dues_payment_merchant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_payment_merchant_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dues_payment_disclosure_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_payment_disclosure_consents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dues_payment_merchant_tenant ON public.dues_payment_merchant_configs;
CREATE POLICY dues_payment_merchant_tenant ON public.dues_payment_merchant_configs
  FOR ALL TO union_eyes_runtime
  USING (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid))
  WITH CHECK (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid));
DROP POLICY IF EXISTS dues_payment_consent_tenant ON public.dues_payment_disclosure_consents;
CREATE POLICY dues_payment_consent_tenant ON public.dues_payment_disclosure_consents
  FOR ALL TO union_eyes_runtime
  USING (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid))
  WITH CHECK (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid));
DROP POLICY IF EXISTS dues_payment_merchant_system ON public.dues_payment_merchant_configs;
CREATE POLICY dues_payment_merchant_system ON public.dues_payment_merchant_configs FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS dues_payment_consent_system ON public.dues_payment_disclosure_consents;
CREATE POLICY dues_payment_consent_system ON public.dues_payment_disclosure_consents FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.dues_payment_merchant_configs, public.dues_payment_disclosure_consents FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.dues_payment_merchant_configs, public.dues_payment_disclosure_consents TO union_eyes_runtime, union_eyes_system;
--> statement-breakpoint
ALTER TABLE public.member_location_consent
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS scope_kind varchar(16),
  ADD COLUMN IF NOT EXISTS scope_id uuid;
ALTER TABLE public.member_location_consent
  DROP CONSTRAINT IF EXISTS member_location_consent_user_id_unique,
  DROP CONSTRAINT IF EXISTS member_location_consent_user_id_key;
DROP INDEX IF EXISTS public.member_location_consent_user_id_unique;
DROP INDEX IF EXISTS public.member_location_consent_user_id_key;
-- Legacy user-global rows remain non-authorizing because the application now
-- requires all three scope columns and the current notice before use.
CREATE UNIQUE INDEX IF NOT EXISTS member_location_consent_scope_uniq
  ON public.member_location_consent(user_id, organization_id, consent_purpose, scope_kind, scope_id);
ALTER TABLE public.member_location_consent
  DROP CONSTRAINT IF EXISTS member_location_consent_scope_kind_check;
ALTER TABLE public.member_location_consent
  ADD CONSTRAINT member_location_consent_scope_kind_check
  CHECK (scope_kind IS NULL OR scope_kind IN ('strike', 'event'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.voice_usage_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  user_id varchar(255) NOT NULL,
  intent_key_hash varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'reserved',
  reserved_credits integer NOT NULL CHECK (reserved_credits > 0),
  settled_credits integer CHECK (settled_credits >= 0),
  provider_reference varchar(255),
  outcome_reason varchar(255),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_usage_reservations_status_check
    CHECK (status IN ('reserved', 'settled', 'released', 'held')),
  CONSTRAINT voice_usage_reservations_settlement_check
    CHECK ((status IN ('settled', 'released')) = (settled_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS voice_usage_reservations_org_intent_uniq
  ON public.voice_usage_reservations(organization_id, intent_key_hash);
CREATE INDEX IF NOT EXISTS voice_usage_reservations_org_status_idx
  ON public.voice_usage_reservations(organization_id, status, reserved_at);
ALTER TABLE public.voice_usage_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_reservations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS voice_usage_reservations_tenant_policy ON public.voice_usage_reservations;
CREATE POLICY voice_usage_reservations_tenant_policy ON public.voice_usage_reservations
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
DROP POLICY IF EXISTS voice_usage_reservations_system_policy ON public.voice_usage_reservations;
CREATE POLICY voice_usage_reservations_system_policy ON public.voice_usage_reservations
  FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.voice_usage_reservations TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON public.voice_usage_reservations TO union_eyes_system;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.campaign_delivery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  audience_version varchar(64) NOT NULL,
  recipient_id varchar(255) NOT NULL,
  recipient_email varchar(255),
  channel campaign_channel NOT NULL,
  content_snapshot jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamptz NOT NULL,
  next_attempt_at timestamptz NOT NULL,
  claimed_at timestamptz,
  consent_checked_at timestamptz,
  provider varchar(50),
  provider_message_id varchar(255),
  last_error text,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_delivery_outbox_status_check
    CHECK (status IN ('queued', 'sending', 'retry', 'sent', 'suppressed', 'failed', 'held', 'cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_delivery_outbox_audience_recipient_uniq
  ON public.campaign_delivery_outbox(campaign_id, audience_version, recipient_id);
CREATE INDEX IF NOT EXISTS campaign_delivery_outbox_dispatch_idx
  ON public.campaign_delivery_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS campaign_delivery_outbox_org_campaign_idx
  ON public.campaign_delivery_outbox(organization_id, campaign_id);
ALTER TABLE public.campaign_delivery_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_delivery_outbox FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaign_delivery_outbox_tenant_policy ON public.campaign_delivery_outbox;
CREATE POLICY campaign_delivery_outbox_tenant_policy ON public.campaign_delivery_outbox
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
DROP POLICY IF EXISTS campaign_delivery_outbox_system_policy ON public.campaign_delivery_outbox;
CREATE POLICY campaign_delivery_outbox_system_policy ON public.campaign_delivery_outbox
  FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.campaign_delivery_outbox TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON public.campaign_delivery_outbox TO union_eyes_system;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.billing_automation_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'pending',
  cadence varchar(16) NOT NULL DEFAULT 'monthly',
  issued_by varchar(255) NOT NULL,
  approved_by varchar(255),
  approved_at timestamptz,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_automation_mandates_status_check CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  CONSTRAINT billing_automation_mandates_cadence_check CHECK (cadence = 'monthly'),
  CONSTRAINT billing_automation_mandates_validity_check CHECK (valid_until > valid_from),
  CONSTRAINT billing_automation_mandates_dual_control_check CHECK (approved_by IS NULL OR approved_by <> issued_by)
);
CREATE INDEX IF NOT EXISTS billing_automation_mandates_org_status_idx
  ON public.billing_automation_mandates(organization_id, status);
CREATE TABLE IF NOT EXISTS public.billing_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  mandate_id uuid NOT NULL REFERENCES public.billing_automation_mandates(id) ON DELETE RESTRICT,
  period_label varchar(50) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'running',
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  result jsonb,
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_automation_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_automation_runs_org_period_uniq
  ON public.billing_automation_runs(organization_id, period_label);
CREATE INDEX IF NOT EXISTS billing_automation_runs_status_idx ON public.billing_automation_runs(status);
ALTER TABLE public.billing_automation_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_automation_mandates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_automation_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_automation_mandates_tenant_policy ON public.billing_automation_mandates;
CREATE POLICY billing_automation_mandates_tenant_policy ON public.billing_automation_mandates
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
DROP POLICY IF EXISTS billing_automation_mandates_system_policy ON public.billing_automation_mandates;
CREATE POLICY billing_automation_mandates_system_policy ON public.billing_automation_mandates
  FOR SELECT TO union_eyes_system USING (status = 'active');
DROP POLICY IF EXISTS billing_automation_runs_system_policy ON public.billing_automation_runs;
CREATE POLICY billing_automation_runs_system_policy ON public.billing_automation_runs
  FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.billing_automation_mandates TO union_eyes_runtime;
GRANT SELECT ON public.billing_automation_mandates TO union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON public.billing_automation_runs TO union_eyes_system;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.reconciliation_resolution_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  exception_id uuid NOT NULL REFERENCES public.reconciliation_exceptions(id) ON DELETE RESTRICT,
  disposition varchar(24) NOT NULL CHECK (disposition IN ('adjustment', 'write_off')),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  requested_by varchar(255) NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by varchar(255),
  approved_at timestamptz,
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  notes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconciliation_resolution_decisions_dual_control CHECK (approved_by IS NULL OR approved_by <> requested_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_resolution_decisions_exception_uniq
  ON public.reconciliation_resolution_decisions(exception_id);
CREATE INDEX IF NOT EXISTS reconciliation_resolution_decisions_org_status_idx
  ON public.reconciliation_resolution_decisions(organization_id, status);
CREATE TABLE IF NOT EXISTS public.reconciliation_resolution_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  decision_id uuid NOT NULL REFERENCES public.reconciliation_resolution_decisions(id) ON DELETE RESTRICT,
  debit_account varchar(100) NOT NULL,
  credit_account varchar(100) NOT NULL,
  debit_amount_cad numeric(14,2) NOT NULL,
  credit_amount_cad numeric(14,2) NOT NULL,
  reversal_of_id uuid REFERENCES public.reconciliation_resolution_postings(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  posted_by varchar(255) NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconciliation_resolution_postings_balanced CHECK (debit_amount_cad > 0 AND debit_amount_cad = credit_amount_cad),
  CONSTRAINT reconciliation_resolution_postings_accounts CHECK (debit_account <> credit_account)
);
CREATE INDEX IF NOT EXISTS reconciliation_resolution_postings_decision_idx
  ON public.reconciliation_resolution_postings(decision_id);
CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_resolution_postings_reversal_uniq
  ON public.reconciliation_resolution_postings(reversal_of_id) WHERE reversal_of_id IS NOT NULL;
ALTER TABLE public.reconciliation_resolution_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_resolution_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_resolution_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_resolution_postings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reconciliation_resolution_decisions_tenant_policy ON public.reconciliation_resolution_decisions;
CREATE POLICY reconciliation_resolution_decisions_tenant_policy ON public.reconciliation_resolution_decisions
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
DROP POLICY IF EXISTS reconciliation_resolution_postings_tenant_policy ON public.reconciliation_resolution_postings;
CREATE POLICY reconciliation_resolution_postings_tenant_policy ON public.reconciliation_resolution_postings
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON public.reconciliation_resolution_decisions TO union_eyes_runtime;
GRANT SELECT, INSERT ON public.reconciliation_resolution_postings TO union_eyes_runtime;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.report_field_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  principal_user_id varchar(255) NOT NULL,
  data_source_id varchar(100) NOT NULL,
  purpose varchar(100) NOT NULL,
  allowed_fields jsonb NOT NULL,
  allowed_classes jsonb NOT NULL,
  approval_reference varchar(255) NOT NULL,
  approved_by varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_field_grants_fields_array CHECK (jsonb_typeof(allowed_fields) = 'array'),
  CONSTRAINT report_field_grants_classes_array CHECK (jsonb_typeof(allowed_classes) = 'array')
);
CREATE INDEX IF NOT EXISTS report_field_grants_principal_source_idx
  ON public.report_field_grants(organization_id, principal_user_id, data_source_id);
CREATE TABLE IF NOT EXISTS public.report_disclosure_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL REFERENCES public.report_field_grants(id) ON DELETE RESTRICT,
  actor_user_id varchar(255) NOT NULL,
  recipient_user_id varchar(255) NOT NULL,
  purpose varchar(100) NOT NULL,
  data_source_id varchar(100) NOT NULL,
  projected_fields jsonb NOT NULL,
  row_count integer NOT NULL CHECK (row_count >= 0),
  row_set_digest varchar(64) NOT NULL CHECK (row_set_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_disclosure_receipts_fields_array CHECK (jsonb_typeof(projected_fields) = 'array')
);
CREATE INDEX IF NOT EXISTS report_disclosure_receipts_org_created_idx
  ON public.report_disclosure_receipts(organization_id, created_at);
ALTER TABLE public.report_field_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_field_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.report_disclosure_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_disclosure_receipts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_field_grants_tenant_read ON public.report_field_grants;
CREATE POLICY report_field_grants_tenant_read ON public.report_field_grants
  FOR SELECT TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    AND principal_user_id = current_setting('app.current_user_id', true));
-- A grant administrator is not inferred from a role title. Management access is
-- opened only for the directly named holder of a live, accepted (when required),
-- ledger-wide financial approval mandate in this organization.
DROP POLICY IF EXISTS report_field_grants_financial_manager_select ON public.report_field_grants;
CREATE POLICY report_field_grants_financial_manager_select ON public.report_field_grants
  FOR SELECT TO union_eyes_runtime USING (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM public.ue_authority_mandates m
      WHERE m.organization_id = report_field_grants.organization_id
        AND m.principal_user_id = current_setting('app.current_user_id', true)
        AND m.kind = 'financial' AND m.status = 'active' AND m.revoked_at IS NULL
        AND m.effective_at <= now() AND m.expires_at > now()
        AND 'approve' = ANY(m.powers)
        AND COALESCE(m.scope->'resourceIds', '[]'::jsonb) @> jsonb_build_array(report_field_grants.organization_id::text)
        AND (NOT m.requires_acceptance OR EXISTS (
          SELECT 1 FROM public.ue_authority_acceptances a
          WHERE a.organization_id = m.organization_id AND a.instrument_type = 'mandate'
            AND a.instrument_id = m.id AND a.accepted_by = m.principal_user_id
        ))
    )
  );
DROP POLICY IF EXISTS report_field_grants_financial_manager_insert ON public.report_field_grants;
CREATE POLICY report_field_grants_financial_manager_insert ON public.report_field_grants
  FOR INSERT TO union_eyes_runtime WITH CHECK (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    AND approved_by = current_setting('app.current_user_id', true)
    AND principal_user_id <> approved_by
    AND EXISTS (
      SELECT 1 FROM public.ue_authority_mandates m
      WHERE m.organization_id = report_field_grants.organization_id
        AND m.principal_user_id = report_field_grants.approved_by
        AND m.kind = 'financial' AND m.status = 'active' AND m.revoked_at IS NULL
        AND m.effective_at <= now() AND m.expires_at > now()
        AND 'approve' = ANY(m.powers)
        AND COALESCE(m.scope->'resourceIds', '[]'::jsonb) @> jsonb_build_array(report_field_grants.organization_id::text)
        AND (NOT m.requires_acceptance OR EXISTS (
          SELECT 1 FROM public.ue_authority_acceptances a
          WHERE a.organization_id = m.organization_id AND a.instrument_type = 'mandate'
            AND a.instrument_id = m.id AND a.accepted_by = m.principal_user_id
        ))
    )
  );
DROP POLICY IF EXISTS report_field_grants_financial_manager_revoke ON public.report_field_grants;
CREATE POLICY report_field_grants_financial_manager_revoke ON public.report_field_grants
  FOR UPDATE TO union_eyes_runtime
  USING (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM public.ue_authority_mandates m
      WHERE m.organization_id = report_field_grants.organization_id
        AND m.principal_user_id = current_setting('app.current_user_id', true)
        AND m.kind = 'financial' AND m.status = 'active' AND m.revoked_at IS NULL
        AND m.effective_at <= now() AND m.expires_at > now()
        AND 'approve' = ANY(m.powers)
        AND COALESCE(m.scope->'resourceIds', '[]'::jsonb) @> jsonb_build_array(report_field_grants.organization_id::text)
        AND (NOT m.requires_acceptance OR EXISTS (
          SELECT 1 FROM public.ue_authority_acceptances a
          WHERE a.organization_id = m.organization_id AND a.instrument_type = 'mandate'
            AND a.instrument_id = m.id AND a.accepted_by = m.principal_user_id
        ))
    )
  )
  WITH CHECK (
    organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    AND revoked_by = current_setting('app.current_user_id', true) AND revoked_at IS NOT NULL
  );
DROP POLICY IF EXISTS report_disclosure_receipts_tenant_insert ON public.report_disclosure_receipts;
CREATE POLICY report_disclosure_receipts_tenant_insert ON public.report_disclosure_receipts
  FOR INSERT TO union_eyes_runtime
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid
    AND actor_user_id = current_setting('app.current_user_id', true)
    AND recipient_user_id = current_setting('app.current_user_id', true));
GRANT SELECT, INSERT ON public.report_field_grants TO union_eyes_runtime;
GRANT UPDATE (revoked_at, revoked_by) ON public.report_field_grants TO union_eyes_runtime;
GRANT INSERT ON public.report_disclosure_receipts TO union_eyes_runtime;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.pension_trustee_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  plan_id uuid,
  actor_user_id varchar(255) NOT NULL,
  action varchar(100) NOT NULL,
  appointment_reference varchar(255) NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pension_trustee_mandates_validity_check CHECK (valid_until > valid_from)
);
CREATE INDEX IF NOT EXISTS pension_trustee_mandates_actor_scope_idx
  ON public.pension_trustee_mandates(organization_id, actor_user_id, plan_id, action);
CREATE TABLE IF NOT EXISTS public.pension_trustee_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  resource_type varchar(50) NOT NULL,
  resource_id uuid NOT NULL,
  action varchar(100) NOT NULL,
  first_trustee_user_id varchar(255) NOT NULL,
  second_trustee_user_id varchar(255),
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pension_trustee_decisions_dual_control CHECK (second_trustee_user_id IS NULL OR second_trustee_user_id <> first_trustee_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pension_trustee_decisions_resource_action_uniq
  ON public.pension_trustee_decisions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS pension_trustee_decisions_org_status_idx
  ON public.pension_trustee_decisions(organization_id, status);
CREATE TABLE IF NOT EXISTS public.pension_benefit_claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  evidence_type varchar(50) NOT NULL,
  evidence_reference varchar(500) NOT NULL,
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  verified_by varchar(255),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pension_benefit_claim_evidence_claim_idx ON public.pension_benefit_claim_evidence(claim_id);
CREATE TABLE IF NOT EXISTS public.pension_benefit_settlement_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  decision_id uuid NOT NULL REFERENCES public.pension_trustee_decisions(id) ON DELETE RESTRICT,
  idempotency_key varchar(128) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'ready_for_provider')),
  provider_mandate_reference varchar(255),
  created_by varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pension_benefit_settlement_handoffs_claim_uniq ON public.pension_benefit_settlement_handoffs(claim_id);
CREATE UNIQUE INDEX IF NOT EXISTS pension_benefit_settlement_handoffs_key_uniq ON public.pension_benefit_settlement_handoffs(organization_id, idempotency_key);
ALTER TABLE public.pension_trustee_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_trustee_mandates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pension_trustee_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_trustee_decisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pension_benefit_claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_benefit_claim_evidence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pension_benefit_settlement_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_benefit_settlement_handoffs FORCE ROW LEVEL SECURITY;
DO $$
DECLARE rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['pension_trustee_mandates','pension_trustee_decisions','pension_benefit_claim_evidence','pension_benefit_settlement_handoffs']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rel || '_tenant_policy', rel);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO union_eyes_runtime USING (organization_id = nullif(current_setting(''app.current_organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.current_organization_id'', true), '''')::uuid)',
      rel || '_tenant_policy', rel
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO union_eyes_runtime', rel);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.integration_credential_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  secret_ref varchar(255) NOT NULL CHECK (secret_ref ~ '^env://UE_INTEGRATION_[A-Z0-9_]{3,200}$'),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by varchar(255)
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_credential_bindings_org_provider_version_uniq
  ON public.integration_credential_bindings(organization_id, provider, version);
CREATE UNIQUE INDEX IF NOT EXISTS integration_credential_bindings_one_active_uniq
  ON public.integration_credential_bindings(organization_id, provider) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS integration_credential_bindings_active_idx
  ON public.integration_credential_bindings(organization_id, provider, status);
ALTER TABLE public.integration_credential_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credential_bindings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integration_credential_bindings_tenant_policy ON public.integration_credential_bindings;
CREATE POLICY integration_credential_bindings_tenant_policy ON public.integration_credential_bindings
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON public.integration_credential_bindings TO union_eyes_runtime;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.shopify_webhook_secret_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  secret_ref varchar(255) NOT NULL CHECK (secret_ref ~ '^env://UE_SHOPIFY_[A-Z0-9_]{3,200}$'),
  status varchar(16) NOT NULL CHECK (status IN ('active', 'retiring', 'revoked')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  created_by varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by varchar(255),
  CONSTRAINT shopify_webhook_secret_versions_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS shopify_webhook_secret_versions_org_version_uniq
  ON public.shopify_webhook_secret_versions(org_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS shopify_webhook_secret_versions_one_active_uniq
  ON public.shopify_webhook_secret_versions(org_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS shopify_webhook_secret_versions_verify_idx
  ON public.shopify_webhook_secret_versions(org_id, status, valid_from, valid_until);
ALTER TABLE public.shopify_webhook_secret_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_webhook_secret_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shopify_webhook_secret_versions_system_read ON public.shopify_webhook_secret_versions;
CREATE POLICY shopify_webhook_secret_versions_system_read ON public.shopify_webhook_secret_versions
  FOR SELECT TO union_eyes_system USING (true);
DROP POLICY IF EXISTS shopify_webhook_secret_versions_tenant_policy ON public.shopify_webhook_secret_versions;
CREATE POLICY shopify_webhook_secret_versions_tenant_policy ON public.shopify_webhook_secret_versions
  FOR ALL TO union_eyes_runtime
  USING (org_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT ON public.shopify_webhook_secret_versions TO union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON public.shopify_webhook_secret_versions TO union_eyes_runtime;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.statutory_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction varchar(16) NOT NULL,
  category varchar(64) NOT NULL,
  rule_key varchar(128) NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'withdrawn')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  source_uri varchar(1000) NOT NULL,
  source_digest varchar(64) NOT NULL,
  reviewed_by varchar(255),
  reviewed_at timestamptz,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT statutory_rule_versions_digest_check CHECK (source_digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT statutory_rule_versions_interval_check CHECK (effective_until IS NULL OR effective_until > effective_from),
  CONSTRAINT statutory_rule_versions_review_check CHECK (status <> 'reviewed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS statutory_rule_versions_key_version_uniq
  ON public.statutory_rule_versions(jurisdiction, rule_key, version);
CREATE INDEX IF NOT EXISTS statutory_rule_versions_effective_idx
  ON public.statutory_rule_versions(jurisdiction, category, status, effective_from, effective_until);
ALTER TABLE public.statutory_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statutory_rule_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS statutory_rule_versions_reviewed_read ON public.statutory_rule_versions;
CREATE POLICY statutory_rule_versions_reviewed_read ON public.statutory_rule_versions
  FOR SELECT TO union_eyes_runtime USING (status = 'reviewed');
GRANT SELECT ON public.statutory_rule_versions TO union_eyes_runtime;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.employer_replay_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_payroll_run_id uuid NOT NULL REFERENCES public.employer_payroll_runs(id) ON DELETE CASCADE,
  request_key_hash varchar(64) NOT NULL CHECK (request_key_hash ~ '^[a-f0-9]{64}$'),
  request_payload_hash varchar(64) NOT NULL CHECK (request_payload_hash ~ '^[a-f0-9]{64}$'),
  source_revision_hash varchar(64) NOT NULL CHECK (source_revision_hash ~ '^[a-f0-9]{64}$'),
  source_status varchar(40) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'held')),
  replay_id uuid REFERENCES public.employer_execution_replays(id) ON DELETE RESTRICT,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employer_replay_intents_completion_check CHECK ((status = 'completed') = (replay_id IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS employer_replay_intents_source_key_uniq
  ON public.employer_replay_intents(organization_id, source_payroll_run_id, request_key_hash);
CREATE UNIQUE INDEX IF NOT EXISTS employer_replay_intents_replay_uniq
  ON public.employer_replay_intents(replay_id) WHERE replay_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS employer_replay_intents_status_idx
  ON public.employer_replay_intents(organization_id, status, created_at);
ALTER TABLE public.employer_replay_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_replay_intents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employer_replay_intents_tenant_policy ON public.employer_replay_intents;
CREATE POLICY employer_replay_intents_tenant_policy ON public.employer_replay_intents
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON public.employer_replay_intents TO union_eyes_runtime;
--> statement-breakpoint
ALTER TABLE public.employer_remittance_runs
  ADD COLUMN IF NOT EXISTS package_schema_version varchar(40) NOT NULL DEFAULT 'ue-remittance-v1',
  ADD COLUMN IF NOT EXISTS source_revision_hash varchar(64),
  ADD COLUMN IF NOT EXISTS evidence_manifest_hash varchar(64);
UPDATE public.employer_remittance_runs r
SET source_revision_hash = md5(r.id::text || ':' || r.payroll_run_id::text || ':' || r.updated_at::text)
  || md5(r.status::text || ':' || r.total_due::text)
WHERE source_revision_hash IS NULL;
ALTER TABLE public.employer_remittance_runs ALTER COLUMN source_revision_hash SET NOT NULL;
ALTER TABLE public.employer_remittance_runs DROP CONSTRAINT IF EXISTS employer_remittance_runs_source_revision_hash_check;
ALTER TABLE public.employer_remittance_runs ADD CONSTRAINT employer_remittance_runs_source_revision_hash_check CHECK (source_revision_hash ~ '^[a-f0-9]{64}$');
CREATE TABLE IF NOT EXISTS public.employer_remittance_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  remittance_run_id uuid NOT NULL REFERENCES public.employer_remittance_runs(id) ON DELETE RESTRICT,
  idempotency_key_hash varchar(64) NOT NULL CHECK (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  status varchar(20) NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'submitted', 'acknowledged', 'rejected')),
  submission_authority_ref varchar(255) NOT NULL,
  package_digest varchar(64) NOT NULL CHECK (package_digest ~ '^[a-f0-9]{64}$'),
  provider_receipt_ref varchar(255),
  submitted_by text NOT NULL,
  submitted_at timestamptz,
  reconciled_by text,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS employer_remittance_submissions_run_key_uniq
  ON public.employer_remittance_submissions(remittance_run_id, idempotency_key_hash);
CREATE UNIQUE INDEX IF NOT EXISTS employer_remittance_submissions_receipt_uniq
  ON public.employer_remittance_submissions(provider_receipt_ref) WHERE provider_receipt_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS employer_remittance_submissions_org_status_idx
  ON public.employer_remittance_submissions(organization_id, status);
ALTER TABLE public.employer_remittance_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_remittance_submissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employer_remittance_submissions_tenant_policy ON public.employer_remittance_submissions;
CREATE POLICY employer_remittance_submissions_tenant_policy ON public.employer_remittance_submissions
  FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON public.employer_remittance_submissions TO union_eyes_runtime;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.pilot_contact_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pilot_applications(id) ON DELETE CASCADE,
  email_key varchar(320) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'withdrawn')),
  crm_consent_status varchar(20) NOT NULL CHECK (crm_consent_status IN ('granted', 'denied', 'withdrawn')),
  crm_consent_version varchar(100) NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  withdrawn_at timestamptz,
  delivery_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'ambiguous')),
  provider_message_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pilot_contact_verifications_application_idx ON public.pilot_contact_verifications(application_id, status);
CREATE TABLE IF NOT EXISTS public.pilot_crm_disclosure_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pilot_applications(id) ON DELETE CASCADE,
  verification_id uuid NOT NULL REFERENCES public.pilot_contact_verifications(id) ON DELETE RESTRICT UNIQUE,
  provider varchar(50) NOT NULL DEFAULT 'hubspot',
  purpose varchar(100) NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  payload_digest varchar(64) NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  status varchar(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'held', 'cancelled')),
  provider_contact_id varchar(255),
  provider_deal_id varchar(255),
  attempt_count varchar(12) NOT NULL DEFAULT '0',
  last_error varchar(500),
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pilot_crm_disclosure_outbox_dispatch_idx ON public.pilot_crm_disclosure_outbox(status, created_at);
REVOKE ALL ON public.pilot_contact_verifications, public.pilot_crm_disclosure_outbox FROM PUBLIC, union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON public.pilot_contact_verifications, public.pilot_crm_disclosure_outbox TO union_eyes_system;
ALTER TABLE public.pilot_contact_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_contact_verifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_crm_disclosure_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_crm_disclosure_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY pilot_contact_verifications_system_only ON public.pilot_contact_verifications FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
CREATE POLICY pilot_crm_disclosure_outbox_system_only ON public.pilot_crm_disclosure_outbox FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.organizing_form_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction varchar(16) NOT NULL,
  template_key varchar(100) NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  title varchar(255) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'withdrawn')),
  field_spec jsonb NOT NULL CHECK (jsonb_typeof(field_spec) = 'array'),
  source_uri text NOT NULL,
  source_digest varchar(64) NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizing_form_template_versions_digest_check CHECK (source_digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT organizing_form_template_versions_review_check CHECK (status <> 'reviewed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT organizing_form_template_versions_interval_check CHECK (effective_until IS NULL OR effective_until > effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS organizing_form_template_versions_key_version_uniq ON public.organizing_form_template_versions(jurisdiction, template_key, version);
CREATE INDEX IF NOT EXISTS organizing_form_template_versions_lookup_idx ON public.organizing_form_template_versions(jurisdiction, status, effective_from);
CREATE TABLE IF NOT EXISTS public.organizing_form_generation_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  campaign_id uuid NOT NULL REFERENCES public.organizing_campaigns(id) ON DELETE RESTRICT,
  template_version_id uuid NOT NULL REFERENCES public.organizing_form_template_versions(id) ON DELETE RESTRICT,
  generated_by text NOT NULL,
  input_digest varchar(64) NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  pdf_digest varchar(64) NOT NULL CHECK (pdf_digest ~ '^[a-f0-9]{64}$'),
  file_name varchar(255) NOT NULL,
  valid_pdf_header boolean NOT NULL,
  byte_length integer NOT NULL CHECK (byte_length > 0 AND byte_length <= 5242880),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizing_form_generation_receipts_campaign_idx ON public.organizing_form_generation_receipts(organization_id, campaign_id, created_at);
ALTER TABLE public.organizing_form_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizing_form_template_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organizing_form_generation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizing_form_generation_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY organizing_form_template_versions_reviewed_read ON public.organizing_form_template_versions FOR SELECT TO union_eyes_runtime USING (status = 'reviewed');
CREATE POLICY organizing_form_generation_receipts_tenant_policy ON public.organizing_form_generation_receipts FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT ON public.organizing_form_template_versions TO union_eyes_runtime;
GRANT SELECT, INSERT ON public.organizing_form_generation_receipts TO union_eyes_runtime;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.pilot_commercial_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pilot_applications(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  currency varchar(3) NOT NULL DEFAULT 'CAD',
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  pricing_basis varchar(100) NOT NULL,
  member_count_basis integer NOT NULL CHECK (member_count_basis > 0),
  member_count_evidence_ref varchar(500) NOT NULL,
  terms jsonb NOT NULL CHECK (jsonb_typeof(terms) = 'object'),
  terms_digest varchar(64) NOT NULL CHECK (terms_digest ~ '^[a-f0-9]{64}$'),
  status varchar(20) NOT NULL CHECK (status IN ('offered', 'accepted', 'superseded', 'withdrawn', 'expired')),
  issued_by text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  superseded_by_id uuid REFERENCES public.pilot_commercial_offers(id) ON DELETE RESTRICT,
  withdrawn_at timestamptz,
  UNIQUE(application_id, version),
  CONSTRAINT pilot_commercial_offers_interval_check CHECK (expires_at > issued_at)
);
CREATE INDEX IF NOT EXISTS pilot_commercial_offers_active_idx ON public.pilot_commercial_offers(application_id, status, expires_at);
CREATE INDEX IF NOT EXISTS pilot_commercial_offers_organization_idx ON public.pilot_commercial_offers(organization_id, application_id);
CREATE TABLE IF NOT EXISTS public.pilot_commercial_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL UNIQUE REFERENCES public.pilot_commercial_offers(id) ON DELETE RESTRICT,
  application_id uuid NOT NULL REFERENCES public.pilot_applications(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  accepted_by text NOT NULL,
  representative_role varchar(100) NOT NULL,
  authority_evidence_ref varchar(500) NOT NULL,
  accepted_terms_digest varchar(64) NOT NULL CHECK (accepted_terms_digest ~ '^[a-f0-9]{64}$'),
  notice_version varchar(100) NOT NULL,
  request_id varchar(255) NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(organization_id, request_id)
);
CREATE INDEX IF NOT EXISTS pilot_commercial_acceptances_application_idx ON public.pilot_commercial_acceptances(application_id, accepted_at);
CREATE TABLE IF NOT EXISTS public.pilot_evidence_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.pilot_applications(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  dimension varchar(40) NOT NULL CHECK (dimension IN ('adoption', 'activity', 'champion', 'risk', 'readiness', 'fit', 'revenue', 'strategic_value')),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  evidence_type varchar(80) NOT NULL,
  evidence_ref varchar(500) NOT NULL,
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  methodology_version varchar(100) NOT NULL,
  observed_at timestamptz NOT NULL,
  observed_by text NOT NULL,
  reviewed_by text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  superseded_at timestamptz,
  CONSTRAINT pilot_evidence_assessments_expiry_check CHECK (expires_at IS NULL OR expires_at > reviewed_at)
  ,CONSTRAINT pilot_evidence_assessments_independent_review_check CHECK (observed_by <> reviewed_by)
);
CREATE INDEX IF NOT EXISTS pilot_evidence_assessments_application_dimension_idx ON public.pilot_evidence_assessments(application_id, dimension, reviewed_at);
CREATE INDEX IF NOT EXISTS pilot_evidence_assessments_organization_idx ON public.pilot_evidence_assessments(organization_id, application_id);
REVOKE ALL ON public.pilot_commercial_offers, public.pilot_commercial_acceptances, public.pilot_evidence_assessments FROM PUBLIC, union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON public.pilot_commercial_offers, public.pilot_commercial_acceptances, public.pilot_evidence_assessments TO union_eyes_system;
ALTER TABLE public.pilot_commercial_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_commercial_offers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_commercial_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_commercial_acceptances FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_evidence_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_evidence_assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY pilot_commercial_offers_system_only ON public.pilot_commercial_offers FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
CREATE POLICY pilot_commercial_acceptances_system_only ON public.pilot_commercial_acceptances FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
CREATE POLICY pilot_evidence_assessments_system_only ON public.pilot_evidence_assessments FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.survey_questionnaire_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content_digest varchar(64) NOT NULL CHECK (content_digest ~ '^[a-f0-9]{64}$'),
  questions jsonb NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, version),
  UNIQUE(survey_id, content_digest)
);
CREATE INDEX IF NOT EXISTS survey_questionnaire_versions_organization_idx ON public.survey_questionnaire_versions(organization_id, survey_id);
INSERT INTO public.survey_questionnaire_versions (organization_id, survey_id, version, content_digest, questions)
SELECT s.organization_id, s.id, 1,
  encode(digest(COALESCE(q.snapshot, '[]'::jsonb)::text, 'sha256'), 'hex'),
  COALESCE(q.snapshot, '[]'::jsonb)
FROM public.surveys s
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', sq.id, 'questionText', sq.question_text, 'questionType', sq.question_type,
      'description', sq.description, 'orderIndex', sq.order_index, 'section', sq.section,
      'required', sq.required, 'choices', sq.choices, 'allowOther', sq.allow_other,
      'minChoices', sq.min_choices, 'maxChoices', sq.max_choices,
      'ratingMin', sq.rating_min, 'ratingMax', sq.rating_max,
      'minLength', sq.min_length, 'maxLength', sq.max_length,
      'placeholder', sq.placeholder, 'showIf', sq.show_if
    ) ORDER BY sq.order_index, sq.id
  ) AS snapshot
  FROM public.survey_questions sq WHERE sq.survey_id = s.id
) q ON true
ON CONFLICT (survey_id, content_digest) DO NOTHING;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS questionnaire_version_id uuid;
UPDATE public.survey_responses sr SET questionnaire_version_id = v.id
FROM public.survey_questionnaire_versions v
WHERE v.survey_id = sr.survey_id AND v.version = 1 AND sr.questionnaire_version_id IS NULL;
ALTER TABLE public.survey_responses ALTER COLUMN questionnaire_version_id SET NOT NULL;
ALTER TABLE public.survey_responses DROP CONSTRAINT IF EXISTS survey_responses_questionnaire_version_id_fkey;
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_questionnaire_version_id_fkey FOREIGN KEY (questionnaire_version_id) REFERENCES public.survey_questionnaire_versions(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_survey_responses_questionnaire_version ON public.survey_responses(questionnaire_version_id);
CREATE TABLE IF NOT EXISTS public.survey_anonymous_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  principal_digest varchar(64) NOT NULL CHECK (principal_digest ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, principal_digest)
);
CREATE INDEX IF NOT EXISTS survey_anonymous_participations_organization_idx ON public.survey_anonymous_participations(organization_id, survey_id);
ALTER TABLE public.survey_questionnaire_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questionnaire_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.survey_anonymous_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_anonymous_participations FORCE ROW LEVEL SECURITY;
CREATE POLICY survey_questionnaire_versions_tenant_policy ON public.survey_questionnaire_versions FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
CREATE POLICY survey_anonymous_participations_tenant_policy ON public.survey_anonymous_participations FOR ALL TO union_eyes_runtime
  USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT, INSERT ON public.survey_questionnaire_versions, public.survey_anonymous_participations TO union_eyes_runtime;
--> statement-breakpoint
ALTER TABLE public.employer_reports
  ADD COLUMN IF NOT EXISTS source_event_type varchar(80),
  ADD COLUMN IF NOT EXISTS source_event_id uuid,
  ADD COLUMN IF NOT EXISTS source_revision varchar(64),
  ADD COLUMN IF NOT EXISTS evaluator_version varchar(100),
  ADD COLUMN IF NOT EXISTS rule_version_id uuid,
  ADD COLUMN IF NOT EXISTS evaluation_status varchar(20);
UPDATE public.employer_reports SET
  source_event_type = COALESCE(source_event_type, 'legacy_unproven'),
  source_event_id = COALESCE(source_event_id, gen_random_uuid()),
  source_revision = COALESCE(source_revision, repeat('0', 64)),
  evaluator_version = COALESCE(evaluator_version, 'legacy-unproven-v0'),
  evaluation_status = COALESCE(evaluation_status, 'unknown');
ALTER TABLE public.employer_reports
  ALTER COLUMN source_event_type SET NOT NULL,
  ALTER COLUMN source_event_id SET NOT NULL,
  ALTER COLUMN source_revision SET NOT NULL,
  ALTER COLUMN evaluator_version SET NOT NULL,
  ALTER COLUMN evaluation_status SET NOT NULL,
  ADD CONSTRAINT employer_reports_evaluation_status_check CHECK (evaluation_status IN ('governed', 'unknown'));
CREATE UNIQUE INDEX IF NOT EXISTS employer_reports_source_evaluator_uniq ON public.employer_reports(employer_id, source_event_type, source_event_id, source_revision, evaluator_version);
ALTER TABLE public.compliance_alerts
  ADD COLUMN IF NOT EXISTS source_event_type varchar(80),
  ADD COLUMN IF NOT EXISTS source_event_id uuid,
  ADD COLUMN IF NOT EXISTS source_revision varchar(64),
  ADD COLUMN IF NOT EXISTS evaluator_version varchar(100),
  ADD COLUMN IF NOT EXISTS rule_version_id uuid;
UPDATE public.compliance_alerts SET
  source_event_type = COALESCE(source_event_type, 'legacy_unproven'),
  source_event_id = COALESCE(source_event_id, gen_random_uuid()),
  source_revision = COALESCE(source_revision, repeat('0', 64)),
  evaluator_version = COALESCE(evaluator_version, 'legacy-unproven-v0');
ALTER TABLE public.compliance_alerts
  ALTER COLUMN source_event_type SET NOT NULL,
  ALTER COLUMN source_event_id SET NOT NULL,
  ALTER COLUMN source_revision SET NOT NULL,
  ALTER COLUMN evaluator_version SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS compliance_alerts_source_evaluator_type_uniq ON public.compliance_alerts(org_id, source_event_type, source_event_id, source_revision, evaluator_version, alert_type);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.equity_consent_notice_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purpose varchar(100) NOT NULL, version integer NOT NULL CHECK (version > 0),
  notice jsonb NOT NULL CHECK (jsonb_typeof(notice) = 'object'), status varchar(20) NOT NULL CHECK (status IN ('draft','reviewed','withdrawn')),
  reviewed_by text, reviewed_at timestamptz, effective_from timestamptz NOT NULL, effective_until timestamptz,
  retention_days integer NOT NULL CHECK (retention_days > 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(purpose, version), CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (status <> 'reviewed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS equity_consent_notice_versions_current_idx ON public.equity_consent_notice_versions(purpose, status, effective_from);
CREATE TABLE IF NOT EXISTS public.equity_purpose_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  subject_user_id text NOT NULL, purpose varchar(100) NOT NULL,
  notice_version_id uuid NOT NULL REFERENCES public.equity_consent_notice_versions(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL CHECK (status IN ('active','withdrawn','expired')), granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, withdrawn_at timestamptz, withdrawal_reason varchar(500)
);
CREATE UNIQUE INDEX IF NOT EXISTS equity_purpose_consents_one_active_uniq ON public.equity_purpose_consents(organization_id, subject_user_id, purpose) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS equity_purpose_consents_active_lookup_idx ON public.equity_purpose_consents(organization_id, subject_user_id, purpose, status);
CREATE TABLE IF NOT EXISTS public.equity_self_identification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  subject_user_id text NOT NULL, purpose varchar(100) NOT NULL,
  consent_id uuid NOT NULL REFERENCES public.equity_purpose_consents(id) ON DELETE RESTRICT,
  encrypted_payload jsonb, payload_digest varchar(64) NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'), key_version varchar(255),
  retention_until timestamptz NOT NULL, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, subject_user_id, purpose)
);
CREATE INDEX IF NOT EXISTS equity_self_identification_retention_idx ON public.equity_self_identification_records(retention_until, deleted_at);
CREATE TABLE IF NOT EXISTS public.equity_disclosure_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  grantee_user_id text NOT NULL, purpose varchar(100) NOT NULL, aggregate_only boolean NOT NULL DEFAULT true,
  minimum_cell_size integer NOT NULL DEFAULT 10 CHECK (minimum_cell_size >= 10), granted_by text NOT NULL,
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS equity_disclosure_grants_lookup_idx ON public.equity_disclosure_grants(organization_id, grantee_user_id, purpose, expires_at);
ALTER TABLE public.equity_consent_notice_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.equity_consent_notice_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.equity_purpose_consents ENABLE ROW LEVEL SECURITY; ALTER TABLE public.equity_purpose_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.equity_self_identification_records ENABLE ROW LEVEL SECURITY; ALTER TABLE public.equity_self_identification_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.equity_disclosure_grants ENABLE ROW LEVEL SECURITY; ALTER TABLE public.equity_disclosure_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY equity_consent_notice_versions_reviewed_read ON public.equity_consent_notice_versions FOR SELECT TO union_eyes_runtime USING (status = 'reviewed');
CREATE POLICY equity_purpose_consents_tenant_policy ON public.equity_purpose_consents FOR ALL TO union_eyes_runtime USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
CREATE POLICY equity_self_identification_records_tenant_policy ON public.equity_self_identification_records FOR ALL TO union_eyes_runtime USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
CREATE POLICY equity_disclosure_grants_tenant_policy ON public.equity_disclosure_grants FOR ALL TO union_eyes_runtime USING (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid) WITH CHECK (organization_id = nullif(current_setting('app.current_organization_id', true), '')::uuid);
GRANT SELECT ON public.equity_consent_notice_versions TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON public.equity_purpose_consents, public.equity_self_identification_records, public.equity_disclosure_grants TO union_eyes_runtime;
GRANT SELECT, UPDATE ON public.equity_purpose_consents, public.equity_self_identification_records TO union_eyes_system;
CREATE POLICY equity_purpose_consents_system_retention ON public.equity_purpose_consents FOR SELECT TO union_eyes_system USING (true);
CREATE POLICY equity_purpose_consents_system_retention_update ON public.equity_purpose_consents FOR UPDATE TO union_eyes_system USING (true) WITH CHECK (true);
CREATE POLICY equity_self_identification_records_system_retention ON public.equity_self_identification_records FOR SELECT TO union_eyes_system USING (true);
CREATE POLICY equity_self_identification_records_system_retention_update ON public.equity_self_identification_records FOR UPDATE TO union_eyes_system USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE public.integration_configs ADD COLUMN IF NOT EXISTS active_version integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS public.integration_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), integration_id uuid NOT NULL REFERENCES public.integration_configs(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE, version integer NOT NULL CHECK (version > 0),
  type integration_type NOT NULL, provider integration_provider NOT NULL, credential_binding_id uuid,
  settings jsonb, webhook_url text, enabled boolean NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_id, version)
);
CREATE INDEX IF NOT EXISTS integration_config_versions_org_idx ON public.integration_config_versions(organization_id, integration_id);
INSERT INTO public.integration_config_versions (integration_id, organization_id, version, type, provider, settings, webhook_url, enabled, created_by)
SELECT id, organization_id, active_version, type, provider, settings, webhook_url, COALESCE(enabled, false), 'system:migration-0088'
FROM public.integration_configs ON CONFLICT (integration_id, version) DO NOTHING;
ALTER TABLE public.integration_config_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_config_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY integration_config_versions_tenant_policy ON public.integration_config_versions FOR ALL TO union_eyes_runtime
  USING (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid))
  WITH CHECK (organization_id = COALESCE(NULLIF(current_setting('app.current_organization_id', true), '')::uuid, NULLIF(current_setting('app.current_org_id', true), '')::uuid));
GRANT SELECT, INSERT ON public.integration_config_versions TO union_eyes_runtime;

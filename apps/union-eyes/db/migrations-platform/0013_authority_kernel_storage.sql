--+ ============================================================================
-- Post-freeze PLATFORM_SQL SCHEMA_CREATION
-- Root: apps/union-eyes/db/migrations-platform/
-- File: 0013_authority_kernel_storage.sql
-- Owner: PLATFORM_SQL_OWNED (exactly one owner each)
-- Relations: ue_authority_mandates, ue_authority_resource_relationships,
--   ue_authority_delegations, ue_authority_recusals,
--   ue_authority_disclosure_consents, ue_authority_approval_requests,
--   ue_authority_approval_decisions, ue_authority_events
-- Evidence:
--   - Authoritative storage for the Institutional Authority Kernel
--     (apps/union-eyes/lib/authority). The kernel is pure and decides only from
--     facts; these relations are where those facts live.
--   - Tenant ownership is organization_id uuid NOT NULL (canonical contract).
--     RLS (FORCE) lives in migrations-cache/0020. Grants come from the
--     storage-authority manifest at activation.
--   - No foreign key to identity or organization relations. Principals are the
--     canonical INTERNAL user id (user_management.users.user_id /
--     platform_identity_bindings.platform_user_id), which is varchar(255) and NOT
--     a uuid (legacy rows carry non-uuid ids). It is never an external provider
--     subject; provider subjects resolve to it only through a verified binding in
--     lib/authority/store/identity.ts. Membership is verified by the fact loader
--     at decision time, never inferred from these rows.
--   - Revised before any deployment or approval (principals were uuid in the
--     first local draft, 3a999601b). The prior bytes hash to
--     cf53ce455254a0fc913d7e255ae2f21836564025ffb8e48f91d1c5986ac0215a (git blob).
-- Integrity rules enforced HERE, independent of any caller:
--   * every mandate, delegation and consent expires (expires_at NOT NULL);
--   * the grantor differs from the holder; emergency access is read-only,
--     at most 24h, justified and independently approved;
--   * authority rows are append-only: revocation or lifting is the only update
--     and is terminal (renewal is a new row);
--   * one person, one vote, per approval request (unique authority line);
--   * self-approval, recusal, adverse party and invalid delegation are refused
--     by the decision trigger, which serializes concurrent decisions with a
--     row lock on the request;
--   * every insert and update is recorded in ue_authority_events by a trigger
--     in the SAME transaction, so a mutation cannot commit without its record.
-- Forward-only. Does not modify frozen lineage.
--+ ============================================================================

-- Internal principal identifier: 1..255 characters, no surrounding whitespace, no control characters.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ue_authority_principal' AND typnamespace = 'public'::regnamespace) THEN
    CREATE DOMAIN ue_authority_principal AS text
      CONSTRAINT ue_authority_principal_chk CHECK (length(VALUE) BETWEEN 1 AND 255 AND VALUE = btrim(VALUE) AND VALUE !~ '[[:cntrl:]]');
  END IF;
END $$;
--> statement-breakpoint

-- Order-insensitive distinctness helper used by CHECK constraints.
CREATE OR REPLACE FUNCTION ue_authority_distinct_text(items text[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $fn$
  SELECT COALESCE(array_agg(DISTINCT i), '{}'::text[]) FROM unnest(items) AS i
$fn$;
--> statement-breakpoint

-- Versioned, provenance-backed institutional authorization policy: WHO may issue,
-- amend, suspend, revoke or lift WHICH authority, with what ceilings. Rules are
-- institution-configured and INACTIVE until activated; activation requires a real
-- source instrument (bylaw, constitution, resolution) and two approvers other than
-- the drafter. Without an active rule, no authority of that domain can be issued.
CREATE TABLE IF NOT EXISTS ue_authority_issuance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  domain text NOT NULL,
  operation text NOT NULL,
  issuer_capacities text[] NOT NULL DEFAULT '{}'::text[],
  issuer_mandate_kind text,
  issuer_mandate_power text,
  allowed_powers text[] NOT NULL DEFAULT '{}'::text[],
  max_term_days integer,
  requires_acceptance boolean NOT NULL DEFAULT false,
  required_independent_approvals integer NOT NULL DEFAULT 0,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  source_instrument text NOT NULL,
  drafted_by ue_authority_principal NOT NULL,
  approved_by ue_authority_principal[] NOT NULL DEFAULT '{}'::ue_authority_principal[],
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_rule_domain_chk CHECK (domain IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access', 'delegation', 'case_assignment', 'recusal')),
  CONSTRAINT ue_authority_rule_operation_chk CHECK (operation IN ('issue', 'amend', 'suspend', 'revoke', 'lift')),
  CONSTRAINT ue_authority_rule_status_chk CHECK (status IN ('draft', 'active', 'retired')),
  CONSTRAINT ue_authority_rule_issuer_chk CHECK ((issuer_mandate_kind IS NULL) = (issuer_mandate_power IS NULL) AND (cardinality(issuer_capacities) > 0 OR issuer_mandate_kind IS NOT NULL)),
  CONSTRAINT ue_authority_rule_term_chk CHECK (max_term_days IS NULL OR max_term_days > 0),
  CONSTRAINT ue_authority_rule_issue_term_chk CHECK (operation <> 'issue' OR domain IN ('case_assignment', 'recusal') OR max_term_days IS NOT NULL),
  CONSTRAINT ue_authority_rule_approvals_chk CHECK (required_independent_approvals >= 0),
  -- Money and emergency authority always need independent approval; emergency is short and read-only.
  CONSTRAINT ue_authority_rule_financial_chk CHECK (NOT (operation = 'issue' AND domain = 'financial') OR required_independent_approvals >= 1),
  CONSTRAINT ue_authority_rule_emergency_chk CHECK (domain <> 'emergency_access' OR operation <> 'issue' OR (required_independent_approvals >= 1 AND max_term_days <= 1 AND allowed_powers <@ ARRAY['read']::text[])),
  CONSTRAINT ue_authority_rule_approvers_chk CHECK (cardinality(approved_by) = cardinality(ue_authority_distinct_text(approved_by::text[]))),
  CONSTRAINT ue_authority_rule_activation_chk CHECK (
    status = 'draft' OR (
      activated_at IS NOT NULL
      AND length(btrim(source_instrument)) > 0
      AND source_instrument <> 'PENDING_INSTITUTIONAL_SOURCE'
      AND cardinality(approved_by) >= 2
      AND NOT (drafted_by = ANY (approved_by))
    )
  ),
  CONSTRAINT ue_authority_rule_retired_chk CHECK ((status = 'retired') = (retired_at IS NOT NULL)),
  CONSTRAINT ue_authority_rule_version_uq UNIQUE (organization_id, domain, operation, version)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_rule_active_uq ON ue_authority_issuance_rules (organization_id, domain, operation) WHERE status = 'active';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  principal_user_id ue_authority_principal NOT NULL,
  kind text NOT NULL,
  powers text[] NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  monetary_limit_minor bigint,
  currency text,
  source_instrument text NOT NULL,
  granted_by ue_authority_principal NOT NULL,
  approved_by ue_authority_principal,
  justification text,
  status text NOT NULL DEFAULT 'active',
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by ue_authority_principal,
  issuance_rule_id uuid,
  approval_request_id uuid,
  supersedes_id uuid,
  requires_acceptance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_mandates_kind_chk CHECK (kind IN ('supervisory', 'financial', 'governance_review', 'executive_office', 'emergency_access')),
  CONSTRAINT ue_authority_mandates_status_chk CHECK (status IN ('active', 'suspended', 'revoked')),
  CONSTRAINT ue_authority_mandates_powers_chk CHECK (cardinality(powers) > 0),
  CONSTRAINT ue_authority_mandates_instrument_chk CHECK (length(btrim(source_instrument)) > 0),
  CONSTRAINT ue_authority_mandates_grantor_chk CHECK (granted_by <> principal_user_id),
  CONSTRAINT ue_authority_mandates_term_chk CHECK (expires_at > effective_at),
  CONSTRAINT ue_authority_mandates_limit_chk CHECK (monetary_limit_minor IS NULL OR (monetary_limit_minor >= 0 AND currency IS NOT NULL AND length(currency) = 3)),
  CONSTRAINT ue_authority_mandates_revocation_chk CHECK ((status = 'revoked') = (revoked_at IS NOT NULL) AND (revoked_at IS NULL OR revoked_by IS NOT NULL)),
  CONSTRAINT ue_authority_mandates_emergency_chk CHECK (
    kind <> 'emergency_access' OR (
      approved_by IS NOT NULL
      AND approved_by <> principal_user_id
      AND justification IS NOT NULL AND length(btrim(justification)) >= 20
      AND expires_at <= effective_at + interval '24 hours'
      AND powers <@ ARRAY['read']::text[]
    )
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_mandates_principal_idx ON ue_authority_mandates (organization_id, principal_user_id, kind) WHERE status = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_mandates_active_uq ON ue_authority_mandates (organization_id, principal_user_id, kind, source_instrument) WHERE status = 'active';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_resource_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  principal_user_id ue_authority_principal NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  relation text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  privileged_access boolean NOT NULL DEFAULT false,
  origin text NOT NULL,
  granted_by ue_authority_principal,
  status text NOT NULL DEFAULT 'active',
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by ue_authority_principal,
  issuance_rule_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_rel_resource_chk CHECK (resource_type IN ('case', 'financial_transaction', 'member_financial_record', 'approval_request', 'governance_review', 'workaid_matter')),
  CONSTRAINT ue_authority_rel_relation_chk CHECK (relation IN ('creator', 'owner', 'assignee', 'collaborator', 'represented_member')),
  CONSTRAINT ue_authority_rel_origin_chk CHECK (origin IN ('derived', 'explicit')),
  CONSTRAINT ue_authority_rel_status_chk CHECK (status IN ('active', 'revoked')),
  -- A collaborator or a privileged grant is never implied: it must be explicit and named.
  CONSTRAINT ue_authority_rel_explicit_chk CHECK ((relation <> 'collaborator' AND NOT privileged_access) OR (origin = 'explicit' AND granted_by IS NOT NULL AND granted_by <> principal_user_id)),
  CONSTRAINT ue_authority_rel_term_chk CHECK (expires_at IS NULL OR expires_at > effective_at),
  CONSTRAINT ue_authority_rel_revocation_chk CHECK ((status = 'revoked') = (revoked_at IS NOT NULL) AND (revoked_at IS NULL OR revoked_by IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_rel_resource_idx ON ue_authority_resource_relationships (organization_id, resource_type, resource_id) WHERE status = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_rel_active_uq ON ue_authority_resource_relationships (organization_id, principal_user_id, resource_type, resource_id, relation) WHERE status = 'active';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  delegator_user_id ue_authority_principal NOT NULL,
  delegate_user_id ue_authority_principal NOT NULL,
  office text NOT NULL,
  actions text[] NOT NULL,
  resource_types text[] NOT NULL,
  status text NOT NULL DEFAULT 'active',
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by ue_authority_principal,
  issuance_rule_id uuid,
  approval_request_id uuid,
  requires_acceptance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_deleg_self_chk CHECK (delegator_user_id <> delegate_user_id),
  CONSTRAINT ue_authority_deleg_office_chk CHECK (length(btrim(office)) > 0),
  CONSTRAINT ue_authority_deleg_actions_chk CHECK (cardinality(actions) > 0 AND cardinality(resource_types) > 0),
  -- Financial duties, oversight powers and counsel material are never delegable.
  CONSTRAINT ue_authority_deleg_nondelegable_chk CHECK (NOT (actions && ARRAY[
    'finance:view', 'finance:prepare', 'finance:approve', 'finance:execute', 'finance:reconcile', 'finance:audit',
    'case:read_privileged', 'review:monitor', 'review:access_evidence', 'review:issue_finding',
    'review:request_corrective_action', 'review:enforce', 'review:verify_remediation',
    'workaid:refer', 'workaid:receive_disclosure', 'workaid:read_counsel_material'
  ]::text[])),
  CONSTRAINT ue_authority_deleg_status_chk CHECK (status IN ('active', 'revoked')),
  CONSTRAINT ue_authority_deleg_term_chk CHECK (expires_at > effective_at),
  CONSTRAINT ue_authority_deleg_revocation_chk CHECK ((status = 'revoked') = (revoked_at IS NOT NULL) AND (revoked_at IS NULL OR revoked_by IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_deleg_delegate_idx ON ue_authority_delegations (organization_id, delegate_user_id) WHERE status = 'active';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_recusals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  principal_user_id ue_authority_principal NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  reason text NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by ue_authority_principal,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_recusal_resource_chk CHECK (resource_type IN ('case', 'financial_transaction', 'member_financial_record', 'approval_request', 'governance_review', 'workaid_matter')),
  CONSTRAINT ue_authority_recusal_reason_chk CHECK (length(btrim(reason)) > 0),
  -- A recusal is absolute: the recused person can never lift their own.
  CONSTRAINT ue_authority_recusal_lift_chk CHECK ((lifted_at IS NULL AND lifted_by IS NULL) OR (lifted_at IS NOT NULL AND lifted_by IS NOT NULL AND lifted_by <> principal_user_id))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_recusal_resource_idx ON ue_authority_recusals (organization_id, resource_type, resource_id) WHERE lifted_at IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_disclosure_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  member_user_id ue_authority_principal NOT NULL,
  matter_id uuid NOT NULL,
  direction text NOT NULL,
  issuer text NOT NULL,
  issued_by ue_authority_principal NOT NULL,
  categories text[] NOT NULL,
  recipient_user_id ue_authority_principal,
  purpose text NOT NULL,
  granted_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by ue_authority_principal,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_consent_direction_chk CHECK (direction IN ('union_to_workaid', 'workaid_to_union')),
  CONSTRAINT ue_authority_consent_issuer_chk CHECK (issuer IN ('member', 'counsel')),
  CONSTRAINT ue_authority_consent_categories_chk CHECK (cardinality(categories) > 0),
  CONSTRAINT ue_authority_consent_purpose_chk CHECK (length(btrim(purpose)) > 0),
  CONSTRAINT ue_authority_consent_term_chk CHECK (expires_at > granted_at),
  -- Union-side referral consent is the member's own act; counsel material reaches the
  -- union only through a counsel-issued record naming a specific recipient.
  CONSTRAINT ue_authority_consent_shape_chk CHECK (
    (direction = 'union_to_workaid' AND issuer = 'member' AND issued_by = member_user_id)
    OR (direction = 'workaid_to_union' AND issuer = 'counsel' AND recipient_user_id IS NOT NULL AND issued_by <> member_user_id)
  ),
  CONSTRAINT ue_authority_consent_revocation_chk CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_consent_matter_idx ON ue_authority_disclosure_consents (organization_id, matter_id) WHERE revoked_at IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  proposed_by ue_authority_principal NOT NULL,
  subject_author_id ue_authority_principal,
  required_approvals integer NOT NULL,
  risk_class text NOT NULL,
  named_approver_ids ue_authority_principal[] NOT NULL DEFAULT '{}'::ue_authority_principal[],
  eligible_capacities text[] NOT NULL DEFAULT '{}'::text[],
  adverse_user_ids ue_authority_principal[] NOT NULL DEFAULT '{}'::ue_authority_principal[],
  status text NOT NULL DEFAULT 'open',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_req_status_chk CHECK (status IN ('open', 'satisfied', 'rejected', 'withdrawn')),
  CONSTRAINT ue_authority_req_risk_chk CHECK (risk_class IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT ue_authority_req_required_chk CHECK (required_approvals >= 1 AND (risk_class IN ('low', 'medium') OR required_approvals >= 2)),
  CONSTRAINT ue_authority_req_decided_chk CHECK ((status = 'open') = (decided_at IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_req_subject_idx ON ue_authority_approval_requests (organization_id, subject_type, subject_id);
--> statement-breakpoint
-- One live adoption ceremony per rule, so the approvers saw the exact instrument pinned for it.
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_req_rule_adoption_uq ON ue_authority_approval_requests (organization_id, subject_id) WHERE subject_type = 'rule_adoption' AND status IN ('open', 'satisfied');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  approval_request_id uuid NOT NULL REFERENCES ue_authority_approval_requests (id),
  approver_user_id ue_authority_principal NOT NULL,
  authority_line_user_id ue_authority_principal NOT NULL,
  delegation_id uuid REFERENCES ue_authority_delegations (id),
  decision text NOT NULL,
  rationale text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_dec_decision_chk CHECK (decision IN ('approved', 'rejected')),
  CONSTRAINT ue_authority_dec_line_chk CHECK ((delegation_id IS NULL AND authority_line_user_id = approver_user_id) OR (delegation_id IS NOT NULL AND authority_line_user_id <> approver_user_id)),
  CONSTRAINT ue_authority_dec_one_vote_uq UNIQUE (organization_id, approval_request_id, authority_line_user_id),
  CONSTRAINT ue_authority_dec_one_approver_uq UNIQUE (organization_id, approval_request_id, approver_user_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  event_seq bigint GENERATED ALWAYS AS IDENTITY,
  organization_id uuid NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  operation text NOT NULL,
  actor_user_id text,
  row_before jsonb,
  row_after jsonb NOT NULL,
  txid bigint NOT NULL DEFAULT txid_current(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ue_authority_events_op_chk CHECK (operation IN ('INSERT', 'UPDATE')),
  CONSTRAINT ue_authority_events_table_chk CHECK (source_table LIKE 'ue_authority\_%' AND source_table <> 'ue_authority_events')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_authority_events_source_idx ON ue_authority_events (organization_id, source_table, source_id);
--> statement-breakpoint

-- Append-only: no DELETE or TRUNCATE on any authority relation, ever.
CREATE OR REPLACE FUNCTION ue_authority_block_mutation() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'authority records are append-only: % on % is not permitted', TG_OP, TG_TABLE_NAME USING ERRCODE = '42501';
END;
$fn$;
--> statement-breakpoint

-- UPDATE guard. TG_ARGV[0] = terminal column (a non-null value freezes the row),
-- TG_ARGV[1] = comma-separated columns that may change. Everything else is immutable.
CREATE OR REPLACE FUNCTION ue_authority_guard_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  mutable_cols text[] := string_to_array(TG_ARGV[1], ',');
BEGIN
  IF (to_jsonb(OLD) ->> TG_ARGV[0]) IS NOT NULL THEN
    RAISE EXCEPTION '% row % is terminal (%): create a new record instead', TG_TABLE_NAME, OLD.id, TG_ARGV[0] USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(OLD) - mutable_cols) IS DISTINCT FROM (to_jsonb(NEW) - mutable_cols) THEN
    RAISE EXCEPTION '% row % may only change: %', TG_TABLE_NAME, OLD.id, TG_ARGV[1] USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- Approval requests change state only as a consequence of a decision row.
CREATE OR REPLACE FUNCTION ue_authority_guard_request_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF pg_trigger_depth() < 2 AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('satisfied', 'rejected') THEN
    RAISE EXCEPTION 'approval request status can only be resolved by recording a decision' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'open' THEN
    RAISE EXCEPTION 'approval request % is already %', OLD.id, OLD.status USING ERRCODE = '42501';
  END IF;
  IF NEW.status NOT IN ('satisfied', 'rejected', 'withdrawn') OR (to_jsonb(OLD) - ARRAY['status', 'decided_at']) IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['status', 'decided_at']) THEN
    RAISE EXCEPTION 'approval request % may only be resolved', OLD.id USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- In-transaction durable record of every authority mutation.
CREATE OR REPLACE FUNCTION ue_authority_record_event() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO ue_authority_events (organization_id, source_table, source_id, operation, actor_user_id, row_before, row_after)
  VALUES (
    NEW.organization_id,
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    nullif(current_setting('app.current_user_id', true), ''),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,
    to_jsonb(NEW)
  );
  RETURN NULL;
END;
$fn$;
--> statement-breakpoint

-- Events may only be written by the recording trigger, never directly.
CREATE OR REPLACE FUNCTION ue_authority_guard_event_insert() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'ue_authority_events can only be written by the authority recording trigger' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- Decision integrity: serialised on the request row, then validated against live facts.
CREATE OR REPLACE FUNCTION ue_authority_guard_decision() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  r ue_authority_approval_requests%ROWTYPE;
  approvals integer;
BEGIN
  SELECT * INTO r FROM ue_authority_approval_requests WHERE id = NEW.approval_request_id FOR UPDATE;
  IF NOT FOUND OR r.organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'approval request not found in this organization' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'open' THEN
    RAISE EXCEPTION 'ALREADY_DECIDED: approval request is %', r.status USING ERRCODE = '42501';
  END IF;
  IF NEW.authority_line_user_id = ANY (r.adverse_user_ids) OR NEW.approver_user_id = ANY (r.adverse_user_ids) THEN
    RAISE EXCEPTION 'ADVERSE_PARTY: approver is a party to the matter' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM ue_authority_recusals rc
    WHERE rc.organization_id = NEW.organization_id
      AND rc.resource_type = 'approval_request'
      AND rc.resource_id = r.id
      AND rc.lifted_at IS NULL
      AND rc.principal_user_id IN (NEW.approver_user_id, NEW.authority_line_user_id)
  ) THEN
    RAISE EXCEPTION 'RECUSED: approver is recused from this request' USING ERRCODE = '42501';
  END IF;
  IF NEW.decision = 'approved' AND (NEW.authority_line_user_id = r.proposed_by OR NEW.approver_user_id = r.proposed_by
       OR NEW.authority_line_user_id = r.subject_author_id OR NEW.approver_user_id = r.subject_author_id) THEN
    RAISE EXCEPTION 'SELF_APPROVAL: the proposer or author of the subject cannot approve it' USING ERRCODE = '42501';
  END IF;
  IF cardinality(r.named_approver_ids) > 0 AND NOT (NEW.authority_line_user_id = ANY (r.named_approver_ids)) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE_APPROVER: approver is not named for this request' USING ERRCODE = '42501';
  END IF;
  IF NEW.delegation_id IS NOT NULL THEN
    IF r.risk_class IN ('high', 'critical') THEN
      RAISE EXCEPTION 'DELEGATION_INVALID: high-risk approvals cannot be delegated' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM ue_authority_delegations d
      WHERE d.id = NEW.delegation_id
        AND d.organization_id = NEW.organization_id
        AND d.delegate_user_id = NEW.approver_user_id
        AND d.delegator_user_id = NEW.authority_line_user_id
        AND d.status = 'active'
        AND d.revoked_at IS NULL
        AND d.effective_at <= now()
        AND d.expires_at > now()
        AND 'governance:approve' = ANY (d.actions)
        AND 'approval_request' = ANY (d.resource_types)
    ) THEN
      RAISE EXCEPTION 'DELEGATION_INVALID: delegation is not live or does not cover this approval' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.decision = 'rejected' THEN
    UPDATE ue_authority_approval_requests SET status = 'rejected', decided_at = now() WHERE id = r.id;
  ELSE
    SELECT count(*) INTO approvals FROM ue_authority_approval_decisions
      WHERE approval_request_id = r.id AND decision = 'approved';
    IF approvals + 1 >= r.required_approvals THEN
      UPDATE ue_authority_approval_requests SET status = 'satisfied', decided_at = now() WHERE id = r.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('ue_authority_mandates', 'revoked_at', 'status,revoked_at,revoked_by'),
      ('ue_authority_resource_relationships', 'revoked_at', 'status,revoked_at,revoked_by'),
      ('ue_authority_delegations', 'revoked_at', 'status,revoked_at,revoked_by'),
      ('ue_authority_recusals', 'lifted_at', 'lifted_at,lifted_by'),
      ('ue_authority_disclosure_consents', 'revoked_at', 'revoked_at,revoked_by')
    ) AS t (tbl, terminal_col, mutable_cols)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_guard_update ON %I', spec.tbl);
    EXECUTE format(
      'CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_update(%L, %L)',
      spec.tbl, spec.terminal_col, spec.mutable_cols
    );
  END LOOP;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ue_authority_mandates', 'ue_authority_resource_relationships', 'ue_authority_delegations',
    'ue_authority_recusals', 'ue_authority_disclosure_consents', 'ue_authority_approval_requests',
    'ue_authority_approval_decisions', 'ue_authority_events'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_no_delete ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation()', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_no_truncate ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION ue_authority_block_mutation()', tbl);
    IF tbl <> 'ue_authority_events' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_record_event ON %I', tbl);
      EXECUTE format('CREATE TRIGGER ue_authority_record_event AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_record_event()', tbl);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_events;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_events FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_insert ON ue_authority_events;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_insert BEFORE INSERT ON ue_authority_events FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_event_insert();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_approval_requests;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_approval_requests FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_request_update();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_approval_decisions;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_approval_decisions FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_decision ON ue_authority_approval_decisions;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_decision BEFORE INSERT ON ue_authority_approval_decisions FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_decision();
--> statement-breakpoint

-- ============================================================================
-- Lifecycle, acceptance, idempotency, resource registers, canonical-audit link
-- ============================================================================

-- A case or office assignment rule is not approval-gated; it is a scoped act.
ALTER TABLE ue_authority_issuance_rules DROP CONSTRAINT IF EXISTS ue_authority_rule_unapproved_domains_chk;
--> statement-breakpoint
ALTER TABLE ue_authority_issuance_rules ADD CONSTRAINT ue_authority_rule_unapproved_domains_chk
  CHECK (domain NOT IN ('case_assignment', 'recusal') OR required_independent_approvals = 0);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  instrument_type text NOT NULL,
  instrument_id uuid NOT NULL,
  accepted_by ue_authority_principal NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_accept_type_chk CHECK (instrument_type IN ('mandate', 'delegation')),
  CONSTRAINT ue_authority_accept_once_uq UNIQUE (organization_id, instrument_type, instrument_id)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  operation text NOT NULL,
  request_hash text NOT NULL,
  actor ue_authority_principal NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_req_key_chk CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  CONSTRAINT ue_authority_req_key_uq UNIQUE (organization_id, idempotency_key)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_financial_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  subject_type text NOT NULL DEFAULT 'payment',
  subject_id uuid NOT NULL,
  step text NOT NULL,
  actor ue_authority_principal NOT NULL,
  account_id uuid,
  required_approvals integer,
  amount_minor bigint,
  currency text,
  at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_fin_subject_chk CHECK (subject_type = 'payment'),
  CONSTRAINT ue_authority_fin_step_chk CHECK (step IN ('registered', 'prepared', 'approved', 'executed', 'reconciled', 'voided')),
  -- The registration snapshots the amount: a later change to the source amount makes the facts contradictory.
  CONSTRAINT ue_authority_fin_shape_chk CHECK (
    (step = 'registered' AND account_id IS NOT NULL AND required_approvals >= 1 AND amount_minor >= 0 AND length(currency) = 3)
    OR (step <> 'registered' AND account_id IS NULL AND required_approvals IS NULL AND amount_minor IS NULL AND currency IS NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_fin_step_uq ON ue_authority_financial_steps (organization_id, subject_type, subject_id, step) WHERE step <> 'approved';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_fin_approver_uq ON ue_authority_financial_steps (organization_id, subject_type, subject_id, actor) WHERE step = 'approved';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ue_authority_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  review_type text NOT NULL,
  complainant_user_id ue_authority_principal,
  adverse_user_ids ue_authority_principal[] NOT NULL DEFAULT '{}'::ue_authority_principal[],
  classification text NOT NULL DEFAULT 'standard',
  remediation_owner_user_id ue_authority_principal,
  opened_by ue_authority_principal NOT NULL,
  status text NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_authority_review_type_chk CHECK (length(btrim(review_type)) > 0),
  CONSTRAINT ue_authority_review_class_chk CHECK (classification IN ('standard', 'privileged')),
  CONSTRAINT ue_authority_review_status_chk CHECK (status IN ('open', 'closed') AND (status = 'closed') = (closed_at IS NOT NULL))
);
--> statement-breakpoint

-- Union-side referral register only. It holds references, never counsel content.
CREATE TABLE IF NOT EXISTS ue_authority_workaid_matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  member_user_id ue_authority_principal NOT NULL,
  case_id uuid NOT NULL,
  referred_by ue_authority_principal NOT NULL,
  referred_at timestamptz NOT NULL DEFAULT now(),
  counsel_accepted_at timestamptz,
  counsel_accepted_by ue_authority_principal,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Counsel's acceptance names counsel, who is neither the member nor the union referrer.
  CONSTRAINT ue_authority_workaid_acceptor_chk CHECK (
    (counsel_accepted_at IS NULL) = (counsel_accepted_by IS NULL)
    AND (counsel_accepted_by IS NULL OR (counsel_accepted_by <> member_user_id AND counsel_accepted_by <> referred_by))
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_workaid_case_uq ON ue_authority_workaid_matters (organization_id, case_id) WHERE withdrawn_at IS NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ue_authority_mandates_rule_fk') THEN
    ALTER TABLE ue_authority_mandates ADD CONSTRAINT ue_authority_mandates_rule_fk FOREIGN KEY (issuance_rule_id) REFERENCES ue_authority_issuance_rules (id);
    ALTER TABLE ue_authority_mandates ADD CONSTRAINT ue_authority_mandates_request_fk FOREIGN KEY (approval_request_id) REFERENCES ue_authority_approval_requests (id);
    ALTER TABLE ue_authority_mandates ADD CONSTRAINT ue_authority_mandates_supersedes_fk FOREIGN KEY (supersedes_id) REFERENCES ue_authority_mandates (id);
    ALTER TABLE ue_authority_delegations ADD CONSTRAINT ue_authority_deleg_rule_fk FOREIGN KEY (issuance_rule_id) REFERENCES ue_authority_issuance_rules (id);
    ALTER TABLE ue_authority_delegations ADD CONSTRAINT ue_authority_deleg_request_fk FOREIGN KEY (approval_request_id) REFERENCES ue_authority_approval_requests (id);
    ALTER TABLE ue_authority_resource_relationships ADD CONSTRAINT ue_authority_rel_rule_fk FOREIGN KEY (issuance_rule_id) REFERENCES ue_authority_issuance_rules (id);
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_mandates_request_uq ON ue_authority_mandates (approval_request_id) WHERE approval_request_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_authority_deleg_request_uq ON ue_authority_delegations (approval_request_id) WHERE approval_request_id IS NOT NULL;
--> statement-breakpoint

-- Issuance guard: nothing can be issued without an ACTIVE, matching, in-organization
-- rule; the rule's ceilings and approval requirement are enforced here, whoever the caller is.
CREATE OR REPLACE FUNCTION ue_authority_guard_issuance() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  dom text;
  holder text;
  issuer text;
  items text[];
  req_id uuid;
  r ue_authority_issuance_rules%ROWTYPE;
  ar ue_authority_approval_requests%ROWTYPE;
  approving integer;
BEGIN
  IF TG_TABLE_NAME = 'ue_authority_mandates' THEN
    dom := NEW.kind; holder := NEW.principal_user_id; issuer := NEW.granted_by; items := NEW.powers; req_id := NEW.approval_request_id;
  ELSIF TG_TABLE_NAME = 'ue_authority_delegations' THEN
    dom := 'delegation'; holder := NEW.delegate_user_id; issuer := NEW.delegator_user_id; items := NEW.actions; req_id := NEW.approval_request_id;
  ELSE
    -- Derived relationships are projections of source records; only explicit grants are issued authority.
    IF NEW.origin <> 'explicit' THEN RETURN NEW; END IF;
    dom := 'case_assignment'; holder := NEW.principal_user_id; issuer := NEW.granted_by; items := NEW.permissions; req_id := NULL;
  END IF;

  IF NEW.issuance_rule_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_ISSUANCE_RULE: % requires an active institutional issuance rule', dom USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM ue_authority_issuance_rules
    WHERE id = NEW.issuance_rule_id AND organization_id = NEW.organization_id FOR SHARE;
  IF NOT FOUND OR r.status <> 'active' OR r.operation <> 'issue' OR r.domain <> dom THEN
    RAISE EXCEPTION 'NO_ACTIVE_ISSUANCE_RULE: rule is absent, inactive or for another domain (%)', dom USING ERRCODE = '42501';
  END IF;
  IF r.max_term_days IS NOT NULL AND (NEW.expires_at IS NULL OR NEW.expires_at - NEW.effective_at > make_interval(days => r.max_term_days)) THEN
    RAISE EXCEPTION 'TERM_EXCEEDS_RULE: term exceeds % day(s)', r.max_term_days USING ERRCODE = '42501';
  END IF;
  IF (dom <> 'case_assignment' OR cardinality(items) > 0) AND NOT (items <@ r.allowed_powers) THEN
    RAISE EXCEPTION 'POWERS_EXCEED_RULE: requested powers exceed the rule ceiling' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME <> 'ue_authority_resource_relationships' THEN
    NEW.requires_acceptance := r.requires_acceptance;
  END IF;

  IF r.required_independent_approvals > 0 THEN
    SELECT * INTO ar FROM ue_authority_approval_requests WHERE id = req_id AND organization_id = NEW.organization_id;
    IF NOT FOUND OR ar.status <> 'satisfied' OR ar.subject_type <> 'issuance:' || dom OR ar.subject_id <> NEW.id
       OR ar.proposed_by <> issuer OR ar.subject_author_id IS DISTINCT FROM holder
       OR ar.required_approvals < r.required_independent_approvals THEN
      RAISE EXCEPTION 'APPROVAL_NOT_SATISFIED: a satisfied approval request bound to this exact issuance is required' USING ERRCODE = '42501';
    END IF;
    SELECT count(DISTINCT d.authority_line_user_id) INTO approving FROM ue_authority_approval_decisions d
      WHERE d.approval_request_id = ar.id AND d.decision = 'approved'
        AND d.authority_line_user_id NOT IN (issuer, holder) AND d.approver_user_id NOT IN (issuer, holder);
    IF approving < r.required_independent_approvals THEN
      RAISE EXCEPTION 'APPROVAL_NOT_SATISFIED: % independent approval(s) required, % found', r.required_independent_approvals, approving USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'ue_authority_mandates' THEN
    IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM ue_authority_mandates o
      WHERE o.id = NEW.supersedes_id AND o.organization_id = NEW.organization_id
        AND o.principal_user_id = NEW.principal_user_id AND o.kind = NEW.kind AND o.status = 'revoked'
    ) THEN
      RAISE EXCEPTION 'SUPERSEDES_INVALID: an amendment must supersede a revoked mandate of the same holder and kind' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ue_authority_guard_rule_update() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION 'issuance rule % is retired: create a new version instead', OLD.id USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(OLD) - ARRAY['status', 'approved_by', 'activated_at', 'retired_at', 'source_instrument']) IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['status', 'approved_by', 'activated_at', 'retired_at', 'source_instrument']) THEN
    RAISE EXCEPTION 'issuance rule content is immutable: create a new version instead' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'draft' AND NEW.source_instrument IS DISTINCT FROM OLD.source_instrument THEN
    RAISE EXCEPTION 'the source instrument of a non-draft issuance rule is immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'active' AND (NEW.status <> 'retired' OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.activated_at IS DISTINCT FROM OLD.activated_at) THEN
    RAISE EXCEPTION 'an active issuance rule may only be retired' USING ERRCODE = '42501';
  END IF;
  -- Adoption is the approvers' act, not the activator's claim: approved_by must be exactly the
  -- authority lines that APPROVED a satisfied rule_adoption request bound to this rule.
  IF OLD.status = 'draft' AND NEW.status = 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM ue_authority_approval_requests r
      WHERE r.organization_id = NEW.organization_id AND r.subject_type = 'rule_adoption' AND r.subject_id = NEW.id
        AND r.status = 'satisfied' AND r.required_approvals >= 2
    ) THEN
      RAISE EXCEPTION 'RULE_ADOPTION_NOT_APPROVED: activation needs a satisfied rule_adoption approval bound to this rule' USING ERRCODE = '42501';
    END IF;
    IF (
      SELECT coalesce(array_agg(d.authority_line_user_id::text ORDER BY d.authority_line_user_id::text), ARRAY[]::text[])
        FROM ue_authority_approval_decisions d
        JOIN ue_authority_approval_requests r ON r.id = d.approval_request_id
       WHERE r.organization_id = NEW.organization_id AND r.subject_type = 'rule_adoption' AND r.subject_id = NEW.id
         AND r.status = 'satisfied' AND d.decision = 'approved'
    ) IS DISTINCT FROM (SELECT coalesce(array_agg(a ORDER BY a), ARRAY[]::text[]) FROM unnest(NEW.approved_by::text[]) a) THEN
      RAISE EXCEPTION 'RULE_ADOPTION_NOT_APPROVED: approved_by must equal the recorded approvers' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ue_authority_guard_acceptance() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  holder text; st text; exp timestamptz; eff timestamptz; req boolean;
BEGIN
  IF NEW.instrument_type = 'mandate' THEN
    SELECT principal_user_id, status, expires_at, effective_at, requires_acceptance INTO holder, st, exp, eff, req
      FROM ue_authority_mandates WHERE id = NEW.instrument_id AND organization_id = NEW.organization_id;
  ELSE
    SELECT delegate_user_id, status, expires_at, effective_at, requires_acceptance INTO holder, st, exp, eff, req
      FROM ue_authority_delegations WHERE id = NEW.instrument_id AND organization_id = NEW.organization_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'instrument not found in this organization' USING ERRCODE = '42501'; END IF;
  IF NOT req THEN RAISE EXCEPTION 'ACCEPTANCE_NOT_REQUIRED: this instrument does not require acceptance' USING ERRCODE = '42501'; END IF;
  IF NEW.accepted_by <> holder THEN RAISE EXCEPTION 'ONLY_THE_HOLDER_MAY_ACCEPT' USING ERRCODE = '42501'; END IF;
  IF st <> 'active' OR exp <= now() THEN RAISE EXCEPTION 'INSTRUMENT_NOT_LIVE: cannot accept a revoked, suspended or expired instrument' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ue_authority_guard_request_result() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.result IS NOT NULL OR (to_jsonb(OLD) - 'result') IS DISTINCT FROM (to_jsonb(NEW) - 'result') THEN
    RAISE EXCEPTION 'an idempotency record may only receive its result once' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- Financial workflow ledger: ordering and segregation of duties, serialised on the registration row.
CREATE OR REPLACE FUNCTION ue_authority_guard_financial_step() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  reg ue_authority_financial_steps%ROWTYPE;
  prep text; executor text; approvers text[]; n integer; has_exec boolean; has_void boolean;
BEGIN
  IF NEW.step = 'registered' THEN RETURN NEW; END IF;
  -- Serialise per transaction subject without needing UPDATE privilege (the ledger is append-only).
  PERFORM pg_advisory_xact_lock(hashtextextended('ue_authority_fin:' || NEW.organization_id::text || ':' || NEW.subject_id::text, 0));
  SELECT * INTO reg FROM ue_authority_financial_steps
    WHERE organization_id = NEW.organization_id AND subject_type = NEW.subject_type AND subject_id = NEW.subject_id AND step = 'registered';
  IF NOT FOUND THEN RAISE EXCEPTION 'STATE_NOT_ELIGIBLE: transaction is not registered' USING ERRCODE = '42501'; END IF;
  SELECT actor INTO prep FROM ue_authority_financial_steps WHERE organization_id = NEW.organization_id AND subject_type = NEW.subject_type AND subject_id = NEW.subject_id AND step = 'prepared';
  SELECT actor INTO executor FROM ue_authority_financial_steps WHERE organization_id = NEW.organization_id AND subject_type = NEW.subject_type AND subject_id = NEW.subject_id AND step = 'executed';
  SELECT COALESCE(array_agg(actor), '{}'::text[]) INTO approvers FROM ue_authority_financial_steps WHERE organization_id = NEW.organization_id AND subject_type = NEW.subject_type AND subject_id = NEW.subject_id AND step = 'approved';
  n := cardinality(approvers);
  has_exec := executor IS NOT NULL;
  SELECT EXISTS (SELECT 1 FROM ue_authority_financial_steps WHERE organization_id = NEW.organization_id AND subject_type = NEW.subject_type AND subject_id = NEW.subject_id AND step = 'voided') INTO has_void;
  IF has_void THEN RAISE EXCEPTION 'STATE_NOT_ELIGIBLE: transaction is void' USING ERRCODE = '42501'; END IF;

  IF NEW.step = 'prepared' THEN
    RETURN NEW;
  ELSIF NEW.step = 'approved' THEN
    IF prep IS NULL OR has_exec THEN RAISE EXCEPTION 'STATE_NOT_ELIGIBLE: cannot approve in this state' USING ERRCODE = '42501'; END IF;
    IF NEW.actor = prep THEN RAISE EXCEPTION 'SEGREGATION_OF_DUTIES: the preparer cannot approve' USING ERRCODE = '42501'; END IF;
  ELSIF NEW.step = 'executed' THEN
    IF prep IS NULL OR n < reg.required_approvals THEN RAISE EXCEPTION 'STATE_NOT_ELIGIBLE: required approvals not met' USING ERRCODE = '42501'; END IF;
    IF NEW.actor = prep OR NEW.actor = ANY (approvers) THEN RAISE EXCEPTION 'SEGREGATION_OF_DUTIES: the executor must be independent of the preparer and approvers' USING ERRCODE = '42501'; END IF;
  ELSIF NEW.step = 'reconciled' THEN
    IF NOT has_exec THEN RAISE EXCEPTION 'STATE_NOT_ELIGIBLE: not executed' USING ERRCODE = '42501'; END IF;
    IF NEW.actor = prep OR NEW.actor = executor OR NEW.actor = ANY (approvers) THEN RAISE EXCEPTION 'SEGREGATION_OF_DUTIES: the reconciler must be independent of every other participant' USING ERRCODE = '42501'; END IF;
  ELSIF NEW.step = 'voided' THEN
    IF has_exec THEN RAISE EXCEPTION 'STATE_NOT_ELIGIBLE: an executed transaction cannot be voided' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

-- A mutation cannot COMMIT unless the canonical hash-chained audit_logs holds a record that
-- names this very authority event. Checked at commit (deferred), so it cannot be skipped
-- by ordering and cannot be satisfied by an unrelated audit row.
CREATE OR REPLACE FUNCTION ue_authority_require_canonical_audit() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs a
    WHERE a.organization_id = NEW.organization_id
      AND a.created_at >= NEW.occurred_at
      AND a.action LIKE 'authority.%'
      AND (a.details -> 'authorityEventIds') ? NEW.id::text
  ) THEN
    RAISE EXCEPTION 'AUDIT_LINK_MISSING: authority event % has no canonical audit record', NEW.id USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$fn$;
--> statement-breakpoint

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'ue_authority_issuance_rules', 'ue_authority_acceptances', 'ue_authority_requests',
    'ue_authority_financial_steps', 'ue_authority_reviews', 'ue_authority_workaid_matters'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_no_delete ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation()', tbl);
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_no_truncate ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION ue_authority_block_mutation()', tbl);
    IF tbl <> 'ue_authority_requests' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_record_event ON %I', tbl);
      EXECUTE format('CREATE TRIGGER ue_authority_record_event AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_record_event()', tbl);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_issuance_rules;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_issuance_rules FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_rule_update();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_acceptances;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_acceptances FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_insert ON ue_authority_acceptances;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_insert BEFORE INSERT ON ue_authority_acceptances FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_acceptance();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_requests;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_requests FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_request_result();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_financial_steps;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_financial_steps FOR EACH ROW EXECUTE FUNCTION ue_authority_block_mutation();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_insert ON ue_authority_financial_steps;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_insert BEFORE INSERT ON ue_authority_financial_steps FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_financial_step();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_reviews;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_reviews FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_update('closed_at', 'status,closed_at,remediation_owner_user_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_authority_guard_update ON ue_authority_workaid_matters;
--> statement-breakpoint
CREATE TRIGGER ue_authority_guard_update BEFORE UPDATE ON ue_authority_workaid_matters FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_update('withdrawn_at', 'counsel_accepted_at,counsel_accepted_by,withdrawn_at');
--> statement-breakpoint

-- Actor binding. Whoever a row says acted MUST be the authenticated principal of the
-- transaction (app.current_user_id). TG_ARGV[0]: columns bound on INSERT; TG_ARGV[1]:
-- columns bound when set or changed by an UPDATE. With no authenticated principal it refuses.
CREATE OR REPLACE FUNCTION ue_authority_guard_actor() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  actor text := nullif(current_setting('app.current_user_id', true), '');
  cols text;
  col text;
  new_j jsonb := to_jsonb(NEW);
  old_j jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    cols := TG_ARGV[0];
  ELSE
    cols := TG_ARGV[1];
    old_j := to_jsonb(OLD);
  END IF;
  IF cols IS NULL OR cols = '' THEN
    RETURN NEW;
  END IF;
  FOREACH col IN ARRAY string_to_array(cols, ',') LOOP
    IF (new_j ->> col) IS NULL THEN
      CONTINUE;
    END IF;
    IF TG_OP = 'UPDATE' AND (new_j ->> col) IS NOT DISTINCT FROM (old_j ->> col) THEN
      CONTINUE;
    END IF;
    IF actor IS NULL OR (new_j ->> col) <> actor THEN
      RAISE EXCEPTION 'ACTOR_NOT_SESSION: % on % must be the authenticated principal of this transaction', col, TG_TABLE_NAME USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;
--> statement-breakpoint

DO $$
DECLARE
  spec text[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['ue_authority_issuance_rules', 'drafted_by', ''],
    ARRAY['ue_authority_mandates', 'granted_by', 'revoked_by'],
    ARRAY['ue_authority_resource_relationships', 'granted_by', 'revoked_by'],
    ARRAY['ue_authority_delegations', 'delegator_user_id', 'revoked_by'],
    ARRAY['ue_authority_recusals', 'principal_user_id', 'lifted_by'],
    ARRAY['ue_authority_disclosure_consents', 'issued_by', 'revoked_by'],
    ARRAY['ue_authority_approval_requests', 'proposed_by', ''],
    ARRAY['ue_authority_approval_decisions', 'approver_user_id', ''],
    ARRAY['ue_authority_acceptances', 'accepted_by', ''],
    ARRAY['ue_authority_requests', 'actor', ''],
    ARRAY['ue_authority_financial_steps', 'actor', ''],
    ARRAY['ue_authority_reviews', 'opened_by', ''],
    ARRAY['ue_authority_workaid_matters', 'referred_by', 'counsel_accepted_by']
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_guard_actor ON %I', spec[1]);
    EXECUTE format('CREATE TRIGGER ue_authority_guard_actor BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_actor(%L, %L)', spec[1], spec[2], spec[3]);
  END LOOP;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ue_authority_mandates', 'ue_authority_delegations', 'ue_authority_resource_relationships'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ue_authority_guard_issuance ON %I', tbl);
    EXECUTE format('CREATE TRIGGER ue_authority_guard_issuance BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION ue_authority_guard_issuance()', tbl);
  END LOOP;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS ue_authority_audit_link ON ue_authority_events;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER ue_authority_audit_link AFTER INSERT ON ue_authority_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ue_authority_require_canonical_audit();

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
--   - No foreign key to identity or organization relations: user ids are the
--     canonical internal user uuid; membership is verified by the fact loader
--     at decision time, never inferred from these rows.
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

CREATE TABLE IF NOT EXISTS ue_authority_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  principal_user_id uuid NOT NULL,
  kind text NOT NULL,
  powers text[] NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  monetary_limit_minor bigint,
  currency text,
  source_instrument text NOT NULL,
  granted_by uuid NOT NULL,
  approved_by uuid,
  justification text,
  status text NOT NULL DEFAULT 'active',
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
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
  principal_user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  relation text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  privileged_access boolean NOT NULL DEFAULT false,
  origin text NOT NULL,
  granted_by uuid,
  status text NOT NULL DEFAULT 'active',
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
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
  delegator_user_id uuid NOT NULL,
  delegate_user_id uuid NOT NULL,
  office text NOT NULL,
  actions text[] NOT NULL,
  resource_types text[] NOT NULL,
  status text NOT NULL DEFAULT 'active',
  effective_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
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
  principal_user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  reason text NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid,
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
  member_user_id uuid NOT NULL,
  matter_id uuid NOT NULL,
  direction text NOT NULL,
  issuer text NOT NULL,
  issued_by uuid NOT NULL,
  categories text[] NOT NULL,
  recipient_user_id uuid,
  purpose text NOT NULL,
  granted_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
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
  proposed_by uuid NOT NULL,
  subject_author_id uuid,
  required_approvals integer NOT NULL,
  risk_class text NOT NULL,
  named_approver_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  eligible_capacities text[] NOT NULL DEFAULT '{}'::text[],
  adverse_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
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

CREATE TABLE IF NOT EXISTS ue_authority_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  approval_request_id uuid NOT NULL REFERENCES ue_authority_approval_requests (id),
  approver_user_id uuid NOT NULL,
  authority_line_user_id uuid NOT NULL,
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

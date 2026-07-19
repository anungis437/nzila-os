-- Migration 0039: SAGE Phase 8A — secure recipient delivery
--
-- Extends the immutable internal export-package workflow (Phase 7) into
-- CONTROLLED external access. An authorized human requests delivery of an
-- existing immutable package to ONE verified recipient for a bounded period; a
-- DIFFERENT authorized human approves the exact package↔recipient pairing,
-- freezing the package hashes, recipient identity hash, policy version, and
-- access conditions. The system issues a short-lived, one-time invitation; the
-- verified recipient claims it and receives a GRANT-SCOPED session — never
-- workspace membership. Every access rechecks the active grant + recipient
-- identity and is durably receipted before bytes stream. Access is revocable
-- and expiring.
--
-- Security posture:
--   • invitation + session tokens are stored ONLY as SHA-256 hashes;
--   • recipient email is never stored in audit/receipt payloads — only a
--     deterministic normalized_email_hash is persisted for approval binding
--     (optional encrypted_email is reserved for the encrypted-PII pattern);
--   • grant state transitions are compare-and-set only;
--   • approvals and receipts are append-only (immutability triggers);
--   • DELETE is intentionally left open for a future privileged Phase 8B
--     destruction path — retention/legal-hold/destruction are NOT in 8A.

-- ── Verified external recipient ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sage_delivery_recipient (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               text NOT NULL,
  workspace_id         uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  display_name         text NOT NULL,
  identity_provider    text NOT NULL,
  identity_subject     text NOT NULL,
  normalized_email_hash text NOT NULL,
  -- Reserved for the repository encrypted-PII pattern when an email must be
  -- retained for delivery; NULL when the provider retains contact detail.
  encrypted_email      text,
  verification_status  text NOT NULL DEFAULT 'unverified',
  verified_at          timestamptz,
  created_by           text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, identity_provider, identity_subject)
);

CREATE INDEX IF NOT EXISTS sage_delivery_recipient_ws_idx
  ON sage_delivery_recipient (workspace_id, org_id);

-- ── Delivery request (one immutable package ↔ one verified recipient) ─────────
CREATE TABLE IF NOT EXISTS sage_delivery_request (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    text NOT NULL,
  workspace_id              uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  export_package_id         uuid NOT NULL REFERENCES sage_export_package (id) ON DELETE CASCADE,
  recipient_id              uuid NOT NULL REFERENCES sage_delivery_recipient (id) ON DELETE CASCADE,
  requested_by              text NOT NULL,
  purpose                   text,
  status                    text NOT NULL DEFAULT 'requested',
  -- Frozen-at-request values; approval recomputes and compares each of these.
  package_content_hash      text NOT NULL,
  package_manifest_hash     text NOT NULL,
  recipient_identity_hash   text NOT NULL,
  policy_version            text NOT NULL,
  requested_access_expires_at timestamptz NOT NULL,
  requested_max_accesses    integer NOT NULL,
  requested_at              timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sage_delivery_request_ws_idx
  ON sage_delivery_request (workspace_id, org_id);
CREATE INDEX IF NOT EXISTS sage_delivery_request_pkg_idx
  ON sage_delivery_request (export_package_id);

-- ── Independent approval / denial (frozen decision) ──────────────────────────
CREATE TABLE IF NOT EXISTS sage_delivery_approval (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                          text NOT NULL,
  workspace_id                    uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  delivery_request_id             uuid NOT NULL REFERENCES sage_delivery_request (id) ON DELETE CASCADE,
  decision                        text NOT NULL,
  approver_id                     text NOT NULL,
  rationale                       text,
  approved_package_content_hash   text NOT NULL,
  approved_manifest_hash          text NOT NULL,
  approved_recipient_identity_hash text NOT NULL,
  approved_policy_version         text NOT NULL,
  approved_access_expires_at      timestamptz NOT NULL,
  approved_max_accesses           integer NOT NULL,
  decided_at                      timestamptz NOT NULL DEFAULT now(),
  -- One decision per request (CAS + this constraint = at-most-one).
  UNIQUE (delivery_request_id)
);

-- ── Invitation + grant-scoped access (compare-and-set state machine) ─────────
CREATE TABLE IF NOT EXISTS sage_delivery_grant (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    text NOT NULL,
  workspace_id              uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  delivery_request_id       uuid NOT NULL REFERENCES sage_delivery_request (id) ON DELETE CASCADE,
  export_package_id         uuid NOT NULL REFERENCES sage_export_package (id) ON DELETE CASCADE,
  recipient_id              uuid NOT NULL REFERENCES sage_delivery_recipient (id) ON DELETE CASCADE,
  status                    text NOT NULL DEFAULT 'issued',
  -- Invitation token is stored ONLY as a hash; plaintext is returned once.
  invitation_token_hash     text NOT NULL UNIQUE,
  invitation_expires_at     timestamptz NOT NULL,
  -- Recipient session credential minted at claim (hash only). Grant-scoped —
  -- never a workspace/org session.
  session_token_hash        text,
  claimed_identity_provider text,
  claimed_identity_subject  text,
  claimed_at                timestamptz,
  access_expires_at         timestamptz NOT NULL,
  max_accesses              integer NOT NULL,
  access_count              integer NOT NULL DEFAULT 0,
  issued_by                 text NOT NULL,
  issued_at                 timestamptz NOT NULL DEFAULT now(),
  revoked_by                text,
  revoked_at                timestamptz,
  revocation_reason_code    text,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  -- Exactly one grant per approved request.
  UNIQUE (delivery_request_id)
);

CREATE INDEX IF NOT EXISTS sage_delivery_grant_ws_idx
  ON sage_delivery_grant (workspace_id, org_id);
-- Read-time expiry sweeps: issued invitations + active grants past their clocks.
CREATE INDEX IF NOT EXISTS sage_delivery_grant_expiry_idx
  ON sage_delivery_grant (status, invitation_expires_at, access_expires_at);

-- ── Durable delivery receipts (append-only) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS sage_delivery_receipt (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            text NOT NULL UNIQUE,
  org_id              text NOT NULL,
  workspace_id        uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  delivery_request_id uuid,
  grant_id            uuid,
  package_id          uuid,
  recipient_id        uuid,
  event_type          text NOT NULL,
  safe_reason_code    text,
  occurred_at         timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sage_delivery_receipt_grant_idx
  ON sage_delivery_receipt (grant_id, occurred_at);
CREATE INDEX IF NOT EXISTS sage_delivery_receipt_request_idx
  ON sage_delivery_receipt (delivery_request_id, occurred_at);

-- ── Append-only immutability (reuse the Phase 7 reject-update trigger fn) ─────
-- Approvals and receipts are evidence: insert-only. Requests and grants use
-- compare-and-set UPDATEs and are intentionally NOT frozen here.
DROP TRIGGER IF EXISTS sage_delivery_approval_no_update ON sage_delivery_approval;
CREATE TRIGGER sage_delivery_approval_no_update
  BEFORE UPDATE ON sage_delivery_approval
  FOR EACH ROW EXECUTE FUNCTION sage_reject_row_update();

DROP TRIGGER IF EXISTS sage_delivery_receipt_no_update ON sage_delivery_receipt;
CREATE TRIGGER sage_delivery_receipt_no_update
  BEFORE UPDATE ON sage_delivery_receipt
  FOR EACH ROW EXECUTE FUNCTION sage_reject_row_update();

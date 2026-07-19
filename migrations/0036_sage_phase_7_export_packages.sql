-- Migration 0036: SAGE Phase 7 — controlled export packages
--
-- Extends the Phase 1 export request/approval tables with a reviewable, hashable
-- scope and an independent-approval hash freeze, and adds an immutable generated
-- package record. External delivery remains DISABLED: there is no recipient,
-- public URL, delivery destination, or transmission column anywhere here.
--
-- Additive + backfill-safe. Does not modify merged migrations.

-- ── New independent-export role ──────────────────────────────────────────────
-- A dedicated SAGE role for independent export approval + package generation.
-- Generic platform/org administration never confers export authority.
ALTER TYPE sage_application_role ADD VALUE IF NOT EXISTS 'export_approver';

-- ── Export request: reviewable scope + freeze metadata ───────────────────────

ALTER TABLE sage_export_request
  ADD COLUMN IF NOT EXISTS purpose               text,
  ADD COLUMN IF NOT EXISTS package_type          text NOT NULL DEFAULT 'internal_review_bundle',
  ADD COLUMN IF NOT EXISTS requested_scope_json  jsonb,
  ADD COLUMN IF NOT EXISTS requested_scope_hash  text,
  ADD COLUMN IF NOT EXISTS policy_version        text,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz NOT NULL DEFAULT now();

-- ── Export approval: frozen approved scope hash ──────────────────────────────

ALTER TABLE sage_export_approval
  ADD COLUMN IF NOT EXISTS approved_scope_hash text;

-- ── Immutable generated package ──────────────────────────────────────────────
-- One finalized package per export request. Metadata only: the manifest records
-- inclusion decisions + hashes (never narrative); package bytes live in private
-- storage referenced by storage_reference. No public URL / recipient column.

CREATE TABLE IF NOT EXISTS sage_export_package (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             text NOT NULL,
  workspace_id       uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  export_request_id  uuid NOT NULL REFERENCES sage_export_request (id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'generated',
  package_type       text NOT NULL,
  manifest_json      jsonb NOT NULL,
  manifest_hash      text NOT NULL,
  content_hash       text NOT NULL,
  storage_reference  text NOT NULL,
  media_type         text NOT NULL,
  size_bytes         bigint NOT NULL,
  policy_version     text NOT NULL,
  item_count         integer NOT NULL DEFAULT 0,
  excluded_count     integer NOT NULL DEFAULT 0,
  generated_by       text NOT NULL,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- One finalized package per export request (compare-and-set / idempotent generation).
CREATE UNIQUE INDEX IF NOT EXISTS sage_export_package_request_uidx
  ON sage_export_package (export_request_id);
CREATE INDEX IF NOT EXISTS sage_export_package_workspace_idx
  ON sage_export_package (org_id, workspace_id);
CREATE INDEX IF NOT EXISTS sage_export_package_generated_idx
  ON sage_export_package (workspace_id, generated_at DESC);

-- ── Private package object store ─────────────────────────────────────────────
-- Package BYTES live here, PRIVATE by construction: no public URL, no ACL, no
-- unauthenticated access. Retrieval is server-side only via storage_reference.
-- The canonical package is JSON, so it is stored as text (UTF-8).

CREATE TABLE IF NOT EXISTS sage_export_package_object (
  storage_reference text PRIMARY KEY,
  media_type        text NOT NULL,
  content_hash      text NOT NULL,
  content_text      text NOT NULL,
  size_bytes        bigint NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);


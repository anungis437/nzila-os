-- Migration 0032: Audit Events Canonical Hash Fields (CourtLens Gap 3 audit-integrity repair)
--
-- Adds two persisted columns required to make the SHA-256 audit hash
-- independently reconstructable from the row itself:
--
--   * occurred_at   timestamptz  — the exact ISO-8601 timestamp the writer
--                                   generated and included in the canonical
--                                   payload. Distinct from created_at
--                                   (server-side clock at INSERT time).
--   * hash_version  text         — the canonicalisation format version. New
--                                   rows written by the repaired writer are
--                                   tagged 'canonical-v1'. Rows written under
--                                   the previous (defective) writer are
--                                   tagged 'linkage-only-v0': their hash
--                                   chain linkage remains verifiable but
--                                   full canonical recomputation does not
--                                   apply.
--
-- Enterprise compliance note:
--   Together with the append-only trigger from migration 0004, this
--   guarantees that any auditor can (a) verify the SHA-256 chain by walking
--   previous_hash and (b) for canonical-v1 rows, independently reconstruct
--   the exact canonical JSON payload from the persisted columns and prove
--   equality with the stored hash byte-for-byte. See
--   apps/abr/lib/audit-log.ts for the canonicalisation contract.

--> statement-breakpoint

ALTER TABLE "audit_events"
  ADD COLUMN "occurred_at" timestamptz NOT NULL DEFAULT now();

--> statement-breakpoint

ALTER TABLE "audit_events"
  ADD COLUMN "hash_version" text NOT NULL DEFAULT 'linkage-only-v0';

--> statement-breakpoint

-- After migration, the writer must supply both columns explicitly for every
-- INSERT and must tag rows as 'canonical-v1'. The defaults above exist only
-- to preserve back-fill semantics for the pre-existing rows.
CREATE INDEX IF NOT EXISTS "audit_events_org_occurred_idx"
  ON "audit_events" ("org_id", "occurred_at");

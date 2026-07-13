-- Migration 0038: SAGE Phase 7 — audit-outbox claim/lease (concurrency-safe dispatch)
--
-- The Phase 7 audit outbox guaranteed durability (no lost audit intent) but its
-- dispatcher SELECTed pending rows without an atomic claim, so two workers could
-- deliver the same event concurrently. This migration adds a leased dispatch
-- claim so a live event can be owned by exactly one dispatcher at a time, with
-- stale-claim reclamation and owner fencing.
--
-- Delivery semantics remain AT-LEAST-ONCE: the downstream NAR-sealed audit sink
-- does not deduplicate by event_id, so a crash after the sink accepts an event
-- but before the outbox row is marked 'dispatched' can redeliver the SAME
-- event_id. The stable event_id is preserved across retries for downstream
-- deduplication. Additive only.

ALTER TABLE sage_audit_outbox
  ADD COLUMN IF NOT EXISTS dispatch_owner    text,
  ADD COLUMN IF NOT EXISTS lease_expires_at  timestamptz;

-- The dispatcher scans claimable rows: pending, or a 'dispatching' claim whose
-- lease has expired (the previous owner is presumed dead).
CREATE INDEX IF NOT EXISTS sage_audit_outbox_claimable_idx
  ON sage_audit_outbox (status, lease_expires_at, created_at);

-- Migration 0031: Idempotency reservation lease (crash recovery + fencing)
--
-- Adds `reservation_owner` to `idempotency_cache` to support LEASED, atomically
-- reclaimable in-flight reservations. Combined with the existing `expires_at`
-- column (which doubles as the LEASE deadline while `status = 0`), this lets a
-- crashed/terminated worker's stale reservation be reclaimed by a later retry
-- instead of orphaning the key in `in_progress` forever.
--
-- `finalize`/`release` are fenced on `reservation_owner`, so a worker whose
-- lease was reclaimed cannot overwrite the new owner's state. The column is
-- NULL for completed entries and carries the current holder's fencing token
-- while a reservation is in flight.

ALTER TABLE "idempotency_cache"
  ADD COLUMN IF NOT EXISTS "reservation_owner" varchar(64);

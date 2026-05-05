-- Align claims table with current Drizzle schema expectations.
-- Legacy databases may still use claim_id as the sole identifier.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS idempotency_hash varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_id_unique ON claims (id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_idempotency_hash_unique ON claims (idempotency_hash) WHERE idempotency_hash IS NOT NULL;

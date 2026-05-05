-- Migration 0099: Restore claim_updates table dropped in 0019
-- This migration recreates the claim_updates table that was dropped in migration 0019.
-- The table is required for claim lifecycle tracking and is actively used by Union Eyes services.

BEGIN;

-- Create visibility_scope enum if it doesn't exist
DO $$
BEGIN
  CREATE TYPE visibility_scope AS ENUM ('member', 'staff', 'admin', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create claim_updates table if it doesn't exist
CREATE TABLE IF NOT EXISTS claim_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid UNIQUE DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL,
  update_type varchar(50),
  message text,
  created_by varchar(255),
  is_internal boolean DEFAULT false,
  visibility_scope visibility_scope DEFAULT 'member' NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (claim_id) REFERENCES claims(claim_id) ON DELETE CASCADE
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_claim_updates_claim_id ON claim_updates(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_updates_created_at ON claim_updates(created_at DESC);

COMMIT;

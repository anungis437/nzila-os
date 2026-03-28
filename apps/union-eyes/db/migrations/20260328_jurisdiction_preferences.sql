-- Migration: Create member_jurisdiction_preferences table
-- Purpose: Stores per-user jurisdiction preferences for precedent filtering
-- Date: 2026-03-28

CREATE TABLE IF NOT EXISTS member_jurisdiction_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  preferred_jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_levels JSONB NOT NULL DEFAULT '[]'::jsonb,
  include_national BOOLEAN NOT NULL DEFAULT true,
  auto_apply BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Index for fast lookup by user + org
CREATE INDEX IF NOT EXISTS idx_member_jurisdiction_prefs_user_org
  ON member_jurisdiction_preferences(user_id, organization_id);

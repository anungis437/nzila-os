-- Console integrations compatibility: platform_integration_connections
-- Creates missing integration enums and connection table used by data freshness.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_integration_provider') THEN
    CREATE TYPE platform_integration_provider AS ENUM (
      'resend',
      'sendgrid',
      'mailgun',
      'twilio',
      'firebase',
      'slack',
      'teams',
      'hubspot',
      'm365',
      'google-workspace',
      'webhooks'
    );
  ELSE
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'resend';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'sendgrid';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'mailgun';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'twilio';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'firebase';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'slack';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'teams';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'hubspot';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'm365';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'google-workspace';
    ALTER TYPE platform_integration_provider ADD VALUE IF NOT EXISTS 'webhooks';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_integration_connection_status') THEN
    CREATE TYPE platform_integration_connection_status AS ENUM (
      'connected',
      'degraded',
      'error',
      'disconnected'
    );
  ELSE
    ALTER TYPE platform_integration_connection_status ADD VALUE IF NOT EXISTS 'connected';
    ALTER TYPE platform_integration_connection_status ADD VALUE IF NOT EXISTS 'degraded';
    ALTER TYPE platform_integration_connection_status ADD VALUE IF NOT EXISTS 'error';
    ALTER TYPE platform_integration_connection_status ADD VALUE IF NOT EXISTS 'disconnected';
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS platform_integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  provider platform_integration_provider NOT NULL,
  status platform_integration_connection_status NOT NULL DEFAULT 'disconnected',
  secrets_encrypted TEXT NOT NULL,
  secrets_fingerprint VARCHAR(128) NOT NULL,
  last_validated_at TIMESTAMPTZ,
  last_validation_ok BOOLEAN NOT NULL DEFAULT false,
  last_validation_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_integration_connections_org_provider_uq
  ON platform_integration_connections (org_id, provider);

CREATE INDEX IF NOT EXISTS platform_integration_connections_provider_status_validated_idx
  ON platform_integration_connections (provider, status, last_validated_at DESC);

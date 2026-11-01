-- PLATFORM_SQL 0053_email_address_suppressions
--
-- A complaint or provider suppression suppressed the recipient in the ONE organization named on the message, so the same address stayed
-- emailable from every other organization on the platform, and the next organization to write to it drew another complaint against the
-- shared sending domain. This migration adds the platform-wide, system-only list that the single sending function consults before it
-- sends.
--
--   * address_sha256 is the SHA-256 of the lower-cased, trimmed address: the table holds no plaintext address, and a lookup is by hash.
--   * It is a DELIVERY suppression, not consent. It stops this platform sending to an address that complained or that the provider
--     suppressed; it does not revoke the recipient's consent anywhere (the organization-scoped consent records still do that).
--   * A suppression is lifted only by a platform administrator through an audited route, which sets lifted_at, lifted_by and
--     lift_reason; the row is kept. A new complaint on a later message clears the lift (the webhook updates the same row).
--
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION. RLS is cache 0043.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'email address suppressions fail-closed: public.organizations does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.email_address_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_sha256 varchar(64) NOT NULL,
  reason varchar(30) NOT NULL,
  source_organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  first_provider_event_id varchar(255),
  last_provider_event_id varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by varchar(255),
  lift_reason text,
  CONSTRAINT email_address_suppressions_hash_uq UNIQUE (address_sha256),
  CONSTRAINT email_address_suppressions_hash_check CHECK (address_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT email_address_suppressions_reason_check CHECK (reason IN ('complaint', 'provider_suppressed')),
  CONSTRAINT email_address_suppressions_lift_check CHECK ((lifted_at IS NULL) = (lifted_by IS NULL))
);
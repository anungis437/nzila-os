-- UE Gate 0 (DEF-0B6-SYS-RESEND-MESSAGE-ID-LOOKUP-UNINDEXED-AND-NOT-UNIQUE): the Resend webhook selects message_log by
-- provider_message_id on every event, so the column needs an index, and a provider's message id identifies exactly one message.
-- Idempotent on PostgreSQL 15 and 16; requires migration-owner privileges.
-- Existing data decides the shape: when no (provider, provider_message_id) pair repeats, the index is UNIQUE; when pairs already
-- repeat it is created non-unique and the duplicate count is reported, so the migration never fails on or rewrites history. The
-- webhook refuses to guess the organization of an id carried by more than one row either way.
DO $$
DECLARE
  duplicate_pairs integer;
BEGIN
  SELECT count(*) INTO duplicate_pairs
  FROM (
    SELECT provider, provider_message_id
    FROM message_log
    WHERE provider_message_id IS NOT NULL
    GROUP BY provider, provider_message_id
    HAVING count(*) > 1
  ) repeated;

  IF duplicate_pairs = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_message_log_provider_message
      ON message_log (provider, provider_message_id)
      WHERE provider_message_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'message_log has % repeated (provider, provider_message_id) pairs; created a non-unique index, resolve the duplicates before enforcing uniqueness', duplicate_pairs;
    CREATE INDEX IF NOT EXISTS idx_message_log_provider_message_id
      ON message_log (provider_message_id)
      WHERE provider_message_id IS NOT NULL;
  END IF;
END
$$;

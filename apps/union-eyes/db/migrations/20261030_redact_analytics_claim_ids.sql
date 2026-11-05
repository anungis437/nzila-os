-- UE Gate 0: permanently remove historical claim identifiers from member-readable
-- aggregate analytics metadata. This is an intentionally irreversible privacy
-- redaction; do not restore claim identifiers in a rollback.
-- Idempotent on PostgreSQL 15 and 16; requires migration-owner privileges.
UPDATE analytics_metrics
SET metadata = metadata - 'claimIds',
    updated_at = NOW()
WHERE metric_type = 'claims_volume'
  AND jsonb_typeof(metadata) = 'object'
  AND metadata ? 'claimIds';
